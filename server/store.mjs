/**
 * File backed store for the receiver.
 *
 * The layout mirrors `src/test`, the fixture tree the application uses with
 * `apiType: 'files'`, so a recording written by this server is readable as a fixture and the
 * whole data directory can be inspected, diffed or archived with ordinary file tools:
 *
 *   <data>/project/<id>.json            project configuration
 *   <data>/project/<id>/<resource>      project resources (images referenced by the script)
 *   <data>/script/<id>.json             recording script
 *   <data>/session/<id>.json            session, patched by the client during the session
 *   <data>/recordingfile/<id>.json      recording file metadata
 *   <data>/recordingfile/<id>.wav       recording audio
 *   <data>/uploads/...                  runtime state: idempotency journal, chunk sessions, ids
 */
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {dirname, join, resolve, sep} from 'node:path';
import {RequestError} from './body.mjs';
import {resolveBankSources} from './draw.mjs';
import {etagOf} from './etag.mjs';
import {RECORDER_VERSION, supportsRecorderVersion} from './feature-versions.mjs';
import {MEDIA_DIR, mimeTypeFor, referencedResources} from './media.mjs';

const ID_SEQUENCE = 'sequence.json';
const JOURNAL = 'journal.json';

export class Store {
  constructor({dataDir, seedDir, log, recorderVersion = RECORDER_VERSION}) {
    this.dataDir = resolve(dataDir);
    this.seedDir = seedDir === null ? null : resolve(seedDir);
    this.log = log;
    this.recorderVersion = recorderVersion;
    this.uploadsDir = join(this.dataDir, 'uploads');
    this.tmpDir = join(this.uploadsDir, 'tmp');
    this._sequence = null;
    this._journal = null;
  }

  /** Creates the data directory, seeded from the fixture tree on first run. */
  open() {
    const seeded = this.seedDir !== null && existsSync(this.seedDir) && !existsSync(join(this.dataDir, 'session'));
    if (seeded) {
      mkdirSync(this.dataDir, {recursive: true});
      cpSync(this.seedDir, this.dataDir, {recursive: true});
      this.log(`seeded ${this.dataDir} from ${this.seedDir}`);
    }
    for (const dir of ['project', 'script', 'session', 'recordingfile', 'bank', 'uploads', 'uploads/tmp']) {
      mkdirSync(join(this.dataDir, dir), {recursive: true});
    }
    return this;
  }

  // ---------------------------------------------------------------- ids and paths

  /** Rejects ids that would escape the data directory: they arrive from the URL. */
  segment(id) {
    const value = String(id ?? '');
    if (value === '' || value === '.' || value === '..' || value.includes('/') || value.includes('\\') || value.includes('\0')) {
      throw new RequestError(400, `invalid identifier "${value}"`);
    }
    return value;
  }

  projectPath(id) {
    return join(this.dataDir, 'project', `${this.segment(id)}.json`);
  }

  projectResourcePath(id, relPath) {
    const base = join(this.dataDir, 'project', this.segment(id));
    const target = resolve(base, relPath);
    if (target !== base && !target.startsWith(base + sep)) {
      throw new RequestError(400, `resource path escapes the project directory: ${relPath}`);
    }
    return target;
  }

  scriptPath(id) {
    return join(this.dataDir, 'script', `${this.segment(id)}.json`);
  }

  sessionPath(id) {
    return join(this.dataDir, 'session', `${this.segment(id)}.json`);
  }

  recordingFilePath(id) {
    return join(this.dataDir, 'recordingfile', `${this.segment(id)}.json`);
  }

  recordingFileAudioPath(id) {
    return join(this.dataDir, 'recordingfile', `${this.segment(id)}.wav`);
  }

  // ---------------------------------------------------------------- reads

  project(id) {
    return this.readJson(this.projectPath(id));
  }

  /** The published script: `published.json` in the script directory, else the legacy flat file. */
  script(id) {
    return this.readJson(this.scriptPublishedPath(id)) ?? this.readJson(this.scriptPath(id));
  }

  session(id) {
    return this.readJson(this.sessionPath(id));
  }

  recordingFile(id) {
    return this.readJson(this.recordingFilePath(id));
  }

  /** All recording files of a session, oldest first. */
  recordingFilesOfSession(sessionId, {project = null} = {}) {
    const dir = join(this.dataDir, 'recordingfile');
    const out = [];
    const seen = new Set();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) {
        continue;
      }
      const meta = this.readJson(join(dir, name));
      if (meta === null) {
        continue;
      }
      if (String(meta.session ?? '') !== String(sessionId ?? '')) {
        continue;
      }
      if (project !== null && meta.project !== undefined && meta.project !== project) {
        continue;
      }
      meta.recordingFileId ??= name.slice(0, -'.json'.length);
      seen.add(String(meta.recordingFileId));
      out.push(meta);
    }
    // A legacy server kept the list of a session next to its audio
    // (`project/<p>/session/<s>/recfile.json`); the fixture tree still has such sessions.
    for (const entry of this.legacySessionIndex(project, sessionId)) {
      const id = String(entry.recordingFileId ?? '');
      if (id === '' || seen.has(id)) {
        continue;
      }
      const meta = this.recordingFile(id) ?? {...entry, session: coerceId(sessionId)};
      meta.recordingFileId ??= coerceId(id);
      seen.add(id);
      out.push(meta);
    }
    return out.sort((a, b) => compareIds(a.recordingFileId, b.recordingFileId));
  }

  /** Entries of the legacy per-session recording index, or an empty list. */
  legacySessionIndex(projectId, sessionId) {
    if (projectId === null) {
      return [];
    }
    const path = this.projectResourcePath(projectId, join('session', String(sessionId), 'recfile.json'));
    const index = this.readJson(path);
    return Array.isArray(index) ? index : [];
  }

  /** Audio of a recording a legacy server stored as `recfile/<itemcode>/<version>.wav`. */
  legacyAudioPath(projectId, sessionId, itemcode, version) {
    if (projectId === null) {
      return null;
    }
    const path = this.projectResourcePath(projectId, join('session', String(sessionId), 'recfile', String(itemcode), `${version}.wav`));
    return existsSync(path) ? path : null;
  }

  recordingFileByUuid(uuid) {
    return this.recordingFiles().find((meta) => meta.uuid === uuid) ?? null;
  }

  recordingFiles() {
    const dir = join(this.dataDir, 'recordingfile');
    const out = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) {
        continue;
      }
      const meta = this.readJson(join(dir, name));
      if (meta !== null) {
        meta.recordingFileId ??= name.slice(0, -'.json'.length);
        out.push(meta);
      }
    }
    return out.sort((a, b) => compareIds(a.recordingFileId, b.recordingFileId));
  }

  sessionIds() {
    return this.listJsonIds('session');
  }

  projectIds() {
    return this.listJsonIds('project');
  }

  scriptIds() {
    const dir = join(this.dataDir, 'script');
    const ids = new Set();
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.json')) {
        ids.add(name.slice(0, -'.json'.length));
      } else if (statSync(join(dir, name)).isDirectory()) {
        ids.add(name);
      }
    }
    return [...ids].sort(compareIds);
  }

  /** The prompt item of a recording script, used to embed the prompt in the metadata. */
  promptItem(scriptId, itemcode) {
    const script = this.script(scriptId);
    if (script === null || itemcode === null || itemcode === undefined) {
      return null;
    }
    for (const section of script.sections ?? []) {
      for (const group of section.groups ?? []) {
        for (const item of group.promptItems ?? []) {
          if (item.itemcode === itemcode) {
            return item;
          }
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- writes

  /** Merges the patch into the stored session and returns the stored object. */
  patchSession(id, patch) {
    const session = this.session(id);
    if (session === null) {
      return null;
    }
    const updated = {...session, ...patch, sessionId: session.sessionId ?? id};
    this.writeJson(this.sessionPath(id), updated);
    return updated;
  }

  /**
   * Refuses a script this receiver's recorder cannot run (L4/C8): a stale cached recorder bundle
   * cannot check anything, so the server checks when the session is created.
   */
  requireRecorderVersion(scriptId, floor = undefined) {
    const required = floor === undefined ? (this.script(scriptId)?.minRecorderVersion ?? null) : floor;
    if (supportsRecorderVersion(required, this.recorderVersion)) {
      return;
    }
    throw new RequestError(409, `script ${scriptId} needs recorder ${required}; this receiver serves ${this.recorderVersion}`, {
      code: 'RECORDER_VERSION_TOO_OLD',
      details: {required, actual: this.recorderVersion},
    });
  }

  createSession(id, {project, script, type = 'NORM', speaker = null}) {
    if (script !== null && script !== undefined) {
      this.requireRecorderVersion(script);
    }
    let session = {
      sessionId: coerceId(id),
      type,
      project,
      script,
      status: 'CREATED',
      debugMode: false,
      // Provenance (rest-api §2.1/§4.2): which published version this session ran, so the library
      // list can say which versions sessions use.
      scriptVersion: script === null || script === undefined
        ? null
        : (this.scriptMeta(String(script))?.publishedVersion ?? null),
      ...(speaker === null || speaker === undefined ? {} : {speaker}),
    };
    const resolved = this.resolveSessionDraws(session);
    if (resolved !== null) {
      session = {...session, ...resolved, drawnDate: new Date().toISOString()};
    }
    this.writeJson(this.sessionPath(id), session);
    return session;
  }

  /**
   * Resolves the bank sources of the session's script (D-W): the chosen items go into a
   * materialised script the recorder reads, and the trace is stored on the session. Returns null
   * when the script has no bank source.
   */
  resolveSessionDraws(session, {sourceDoc = null} = {}) {
    // Re-resolution (for example a redraw) must start from the original script, not the
    // materialised copy, which no longer carries the bank sources. A preview passes the draft or
    // version it copied, because that document may carry a bank source the published one lacks.
    const scriptId = session?.scriptSource ?? session?.script;
    if (scriptId === null || scriptId === undefined) {
      return null;
    }
    const doc = sourceDoc ?? this.script(scriptId);
    if (doc === null) {
      return null;
    }
    const meta = this.scriptMeta(String(scriptId));
    const recorded = session.speaker === null || session.speaker === undefined
      ? new Set()
      : this.recordedBankItemIds({project: session.project, speaker: session.speaker});
    let resolved;
    try {
      resolved = resolveBankSources(doc, {
        lookupBank: (bankId) => this.bank(bankId),
        // A redraw bumps `session.redraw`, which changes the seed (the stored trace stays the truth).
        sessionId: session.redraw === undefined || session.redraw === null || session.redraw === 0
          ? session.sessionId
          : `${session.sessionId}#${session.redraw}`,
        speaker: session.speaker ?? null,
        scriptId: coerceId(scriptId),
        scriptVersion: meta?.publishedVersion ?? null,
        recordedBankItemIds: recorded,
      });
    } catch (err) {
      throw new RequestError(409, `cannot resolve the session's bank sources: ${err.message}`, {code: 'BANK_SOURCE_UNRESOLVED'});
    }
    if (resolved.trace === null) {
      return null;
    }
    return {
      script: coerceId(this.materialiseScript(session.sessionId, resolved.script)),
      bankDraws: resolved.trace,
      scriptSource: coerceId(scriptId),
    };
  }

  /** The bank item ids this speaker already has a recording for, within the project. */
  recordedBankItemIds({project = null, speaker = null}) {
    if (speaker === null || speaker === undefined) {
      return new Set();
    }
    const sessions = new Set(this.sessionIds().filter((id) => {
      const candidate = this.session(id);
      return candidate?.speaker === speaker && (project === null || candidate?.project === project);
    }));
    const ids = new Set();
    for (const meta of this.recordingFiles()) {
      if (!sessions.has(String(meta.session ?? ''))) {
        continue;
      }
      const bankItemId = meta.recording?.bankItemId ?? meta.bankItemId;
      if (bankItemId !== undefined && bankItemId !== null) {
        ids.add(String(bankItemId));
      }
    }
    return ids;
  }

  /** Merges the patch into the stored metadata and returns the stored object. */
  patchRecordingFile(id, patch) {
    const meta = this.recordingFile(id);
    if (meta === null) {
      return null;
    }
    const updated = {...meta, ...patch, recordingFileId: meta.recordingFileId ?? coerceId(id)};
    this.writeJson(this.recordingFilePath(id), updated);
    return updated;
  }

  /**
   * Publishes an uploaded WAVE file as a recording file: allocates the id, assigns the next
   * version of that prompt item (or of that recording UUID for the UUID keyed API), moves the
   * audio into place and writes the metadata.
   */
  addRecording({sessionId, itemcode = null, uuid = null, startedDate = null, project = null, wavPath, wavMeta}) {
    const id = this.nextRecordingFileId();
    const existing = this.recordingFilesOfSession(sessionId);
    const version = existing.filter((meta) => (itemcode !== null
      ? meta.recording?.itemcode === itemcode
      : meta.uuid === uuid)).length;
    const audioPath = this.recordingFileAudioPath(id);
    this.move(wavPath, audioPath);
    const session = this.session(sessionId);
    const script = session?.script ?? null;
    const promptItem = itemcode === null ? null : (this.promptItem(script, itemcode) ?? {itemcode, mediaitems: []});
    const meta = {
      recordingFileId: coerceId(id),
      session: session?.sessionId ?? coerceId(sessionId),
      version,
      date: new Date().toISOString(),
      startedDate: startedDate ?? new Date().toISOString(),
      channels: wavMeta.channels,
      frames: wavMeta.frames,
      samplerate: wavMeta.sampleRate,
      bytes: statSync(audioPath).size,
      format: 'WAVE',
      encoding: wavMeta.encoding,
      quantisation: wavMeta.quantisation,
      ...(project === null ? {} : {project}),
      ...(uuid === null ? {} : {uuid}),
      ...(itemcode === null ? {} : {itemcode}),
      ...(promptItem === null ? {} : {recording: promptItem}),
    };
    this.writeJson(this.recordingFilePath(id), meta);
    return meta;
  }

  /** Allocates the next recording file id; the sequence survives restarts. */
  nextRecordingFileId() {
    if (this._sequence === null) {
      const stored = this.readJson(join(this.uploadsDir, ID_SEQUENCE));
      const highest = this.recordingFiles()
        .map((meta) => Number(meta.recordingFileId))
        .filter((id) => Number.isFinite(id))
        .reduce((max, id) => Math.max(max, id), 100000000);
      this._sequence = Math.max(highest + 1, Number(stored?.next ?? 0) || 0);
    }
    const id = this._sequence++;
    this.writeJson(join(this.uploadsDir, ID_SEQUENCE), {next: this._sequence});
    return id;
  }

  // ---------------------------------------------------------------- chunk sessions

  chunkDir(uuid) {
    return join(this.uploadsDir, `chunk-${this.segment(uuid)}`);
  }

  chunkMetaPath(uuid) {
    return join(this.chunkDir(uuid), 'meta.json');
  }

  chunkPath(uuid, chunkIdx) {
    return join(this.chunkDir(uuid), `${this.segment(chunkIdx)}.wav`);
  }

  chunkSession(uuid) {
    return this.readJson(this.chunkMetaPath(uuid));
  }

  /** Creates the chunk session if it does not exist yet; prepares may arrive after chunks. */
  upsertChunkSession(uuid, patch) {
    const existing = this.chunkSession(uuid) ?? {uuid, createdAt: new Date().toISOString(), chunks: {}};
    const updated = {...existing, ...patch, uuid, chunks: existing.chunks ?? {}};
    this.writeJson(this.chunkMetaPath(uuid), updated);
    return updated;
  }

  addChunk(uuid, chunkIdx, tmpPath) {
    mkdirSync(this.chunkDir(uuid), {recursive: true});
    const target = this.chunkPath(uuid, chunkIdx);
    this.move(tmpPath, target);
    const session = this.upsertChunkSession(uuid, {});
    session.chunks[String(chunkIdx)] = statSync(target).size;
    this.writeJson(this.chunkMetaPath(uuid), session);
    return target;
  }

  chunkIndices(uuid) {
    const session = this.chunkSession(uuid);
    if (session === null) {
      return [];
    }
    return Object.keys(session.chunks ?? {})
      .map((key) => Number(key))
      .filter((value) => Number.isInteger(value))
      .sort((a, b) => a - b);
  }

  /**
   * Closes a chunk session after its recording was published: the chunk files are deleted, the
   * metadata keeps the publication so a repeated concat request can be answered from it.
   */
  markChunkSessionFinalized(uuid, published) {
    const session = this.chunkSession(uuid) ?? {uuid, createdAt: new Date().toISOString(), chunks: {}};
    for (const chunkIdx of Object.keys(session.chunks ?? {})) {
      rmSync(this.chunkPath(uuid, chunkIdx), {force: true});
    }
    session.chunks = {};
    session.finalizedRecording = {
      recordingFileId: published.recordingFileId,
      session: published.session,
      version: published.version,
      chunks: published.chunks,
      frames: published.frames,
      samplerate: published.samplerate,
      channels: published.channels,
      date: published.date,
    };
    this.writeJson(this.chunkMetaPath(uuid), session);
    return session;
  }

  // ---------------------------------------------------------------- idempotency

  /**
   * The journal maps an `Idempotency-Key` to the response that was sent for it. A retry of a
   * request whose response the client never saw (timeout after the server stored the payload)
   * then returns the original answer instead of storing the recording twice.
   */
  idempotencyLookup(key) {
    if (key === undefined || key === null || key === '') {
      return null;
    }
    return this.journal()[key] ?? null;
  }

  idempotencyRemember(key, entry) {
    if (key === undefined || key === null || key === '') {
      return;
    }
    const journal = this.journal();
    journal[key] = entry;
    this.writeJson(join(this.uploadsDir, JOURNAL), journal);
  }

  journal() {
    this._journal ??= this.readJson(join(this.uploadsDir, JOURNAL)) ?? {};
    return this._journal;
  }

  // ---------------------------------------------------------------- scripts and drafts

  /**
   * One directory per script (layout §10.1 of the doc/script-editor plan): meta, published, draft,
   * versions and revisions. The legacy flat `script/<id>.json` is still read as the published
   * script and is never written again after migration.
   */
  scriptDir(id) {
    return join(this.dataDir, 'script', this.segment(id));
  }

  scriptPublishedPath(id) {
    return join(this.scriptDir(id), 'published.json');
  }

  scriptDraftPath(id) {
    return join(this.scriptDir(id), 'draft.json');
  }

  scriptMetaPath(id) {
    return join(this.scriptDir(id), 'meta.json');
  }

  scriptVersionPath(id, n) {
    return join(this.scriptDir(id), 'versions', `${this.segment(n)}.json`);
  }

  scriptRevisionPath(id, n) {
    return join(this.scriptDir(id), 'revisions', `${this.segment(n)}.json`);
  }

  scriptMeta(id) {
    return this.readJson(this.scriptMetaPath(id));
  }

  /** The current draft as raw text, for the ETag; null when the script has no draft. */
  draftBytes(id) {
    const path = this.scriptDraftPath(id);
    return existsSync(path) ? readFileSync(path) : null;
  }

  draft(id) {
    return this.readJson(this.scriptDraftPath(id));
  }

  /** Published version numbers, ascending. */
  versions(id) {
    const dir = join(this.scriptDir(id), 'versions');
    if (!existsSync(dir)) {
      return [];
    }
    return readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => Number(name.slice(0, -'.json'.length)))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
  }

  version(id, n) {
    return this.readJson(this.scriptVersionPath(id, n));
  }

  /** The published version index (newest first), stored beside the version files. */
  scriptVersionsPath(id) {
    return join(this.scriptDir(id), 'versions.json');
  }

  versionsIndex(id) {
    return this.readJson(this.scriptVersionsPath(id))?.versions ?? [];
  }

  /** Raw published version bytes, or null. */
  versionText(id, n) {
    const path = this.scriptVersionPath(id, n);
    return existsSync(path) ? readFileSync(path) : null;
  }

  /** Raw published-script bytes: `published.json`, else the legacy flat file, else null. */
  publishedText(id) {
    const published = this.scriptPublishedPath(id);
    if (existsSync(published)) {
      return readFileSync(published);
    }
    const legacy = this.scriptPath(id);
    return existsSync(legacy) ? readFileSync(legacy) : null;
  }

  /**
   * Freezes the current draft as the next published version: the version file first, then the
   * recorder-facing `published.json` (atomic rename), then the metadata. A crash between the steps
   * is repaired by publishing again, and the recorder's path is only ever swapped atomically.
   *
   * @returns {{version: number, publishedDate: string, minRecorderVersion: string|null}}
   */
  publish(id, {text, note = null, minRecorderVersion = null}) {
    const meta = this.ensureScriptMeta(id);
    const version = (meta.publishedVersion ?? 0) + 1;
    this.writeText(this.scriptVersionPath(id, version), text);
    this.writeText(this.scriptPublishedPath(id), text);
    const publishedDate = new Date().toISOString();
    const index = this.versionsIndex(id).filter((entry) => entry.version !== version);
    index.push({version, publishedDate, note, minRecorderVersion});
    index.sort((a, b) => b.version - a.version);
    this.writeJson(this.scriptVersionsPath(id), {versions: index});
    this.writeJson(this.scriptMetaPath(id), {
      ...meta,
      publishedVersion: version,
      publishedDraftVersion: meta.draftVersion ?? 0,
      publishedDate,
      publishedNote: note,
      minRecorderVersion,
      modified: publishedDate,
    });
    return {version, publishedDate, minRecorderVersion};
  }

  /** Copies a published version back into the draft: a new draft revision, not a publish. */
  restoreVersion(id, n) {
    const text = this.versionText(id, n);
    if (text === null) {
      throw new RequestError(404, `version ${n} of script ${id} does not exist`);
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new RequestError(500, `stored version ${n} of script ${id} is not valid JSON`);
    }
    return this.writeDraft(id, text, value);
  }

  /** Writes bytes verbatim through temp+rename; the ETag hashes exactly this text. */
  writeText(path, text) {
    mkdirSync(dirname(path), {recursive: true});
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, text);
    renameSync(tmp, path);
  }

  /** Creates the metadata for a script, importing a legacy flat file as published version 1. */
  ensureScriptMeta(id) {
    const existing = this.scriptMeta(id);
    if (existing !== null) {
      return existing;
    }
    const legacy = this.readJson(this.scriptPath(id));
    mkdirSync(join(this.scriptDir(id), 'revisions'), {recursive: true});
    if (legacy !== null) {
      mkdirSync(join(this.scriptDir(id), 'versions'), {recursive: true});
      if (!existsSync(this.scriptVersionPath(id, 1))) {
        this.writeJson(this.scriptVersionPath(id, 1), legacy);
      }
    }
    const now = new Date().toISOString();
    const meta = {
      scriptId: coerceId(id),
      name: legacy?.name ?? null,
      project: legacy?.project ?? null,
      archived: false,
      publishedVersion: legacy === null ? 0 : 1,
      draftVersion: 0,
      layoutVersion: 1,
      created: now,
      modified: now,
    };
    this.writeJson(this.scriptMetaPath(id), meta);
    return meta;
  }

  /**
   * Stores the draft bytes verbatim (D-S: the ETag hashes exactly what was sent), snapshots a
   * revision and bumps `draftVersion`.
   *
   * @returns {{etag: string, draftVersion: number}}
   */
  writeDraft(id, text, value) {
    const meta = this.ensureScriptMeta(id);
    mkdirSync(join(this.scriptDir(id), 'revisions'), {recursive: true});
    this.writeText(this.scriptDraftPath(id), text);
    const draftVersion = (meta.draftVersion ?? 0) + 1;
    this.writeJson(this.scriptRevisionPath(id, draftVersion), value);
    this.writeJson(this.scriptMetaPath(id), {...meta, draftVersion, modified: new Date().toISOString()});
    return {etag: etagOf(text), draftVersion};
  }

  /** The next free numeric script id; non-numeric fixture ids are ignored. */
  nextScriptId() {
    const highest = this.scriptIds()
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 1000);
    return String(highest + 1);
  }

  /** Creates a script with its first draft; nothing is published yet. */
  createScript({name = null, project = null, value, text}) {
    const id = this.nextScriptId();
    const now = new Date().toISOString();
    this.writeJson(this.scriptMetaPath(id), {
      scriptId: coerceId(id),
      name,
      project,
      archived: false,
      publishedVersion: 0,
      draftVersion: 0,
      layoutVersion: 1,
      created: now,
      modified: now,
    });
    const stored = this.writeDraft(id, text, value);
    return {scriptId: coerceId(id), ...stored};
  }

  /** Name and archive flag live on the metadata and are mirrored into the script documents. */
  patchScriptMeta(id, patch) {
    const meta = this.ensureScriptMeta(id);
    const updated = {
      ...meta,
      ...(patch.name === undefined ? {} : {name: patch.name}),
      ...(patch.archived === undefined ? {} : {archived: patch.archived === true}),
      modified: new Date().toISOString(),
    };
    this.writeJson(this.scriptMetaPath(id), updated);
    if (patch.name !== undefined) {
      for (const path of [this.scriptPublishedPath(id), this.scriptDraftPath(id)]) {
        const doc = this.readJson(path);
        if (doc !== null) {
          this.writeJson(path, {...doc, name: patch.name});
        }
      }
    }
    return updated;
  }

  /** The library list, optionally narrowed to one project. Materialised session scripts are internal. */
  listScripts(project = null) {
    const out = [];
    const usage = this.sessionUsageByScript(project);
    for (const id of this.scriptIds()) {
      const flat = this.readJson(this.scriptPath(id));
      if (flat !== null && flat.internal === true) {
        continue;
      }
      const meta = this.scriptMeta(id) ?? this.ensureScriptMeta(id);
      if (project !== null && meta.project !== null && meta.project !== project) {
        continue;
      }
      const doc = this.script(id) ?? this.draft(id);
      out.push({
        scriptId: meta.scriptId,
        name: meta.name,
        archived: meta.archived === true,
        status: meta.archived === true
          ? 'ARCHIVED'
          : (meta.publishedVersion > 0 && (meta.publishedDraftVersion ?? 0) === (meta.draftVersion ?? 0)
            ? 'PUBLISHED'
            : 'DRAFT'),
        publishedVersion: meta.publishedVersion ?? 0,
        draftVersion: meta.draftVersion ?? 0,
        ...scriptCounts(doc),
        sessions: usage[String(meta.scriptId)] ?? {total: 0, started: 0, byVersion: {}},
        modified: meta.modified ?? null,
        modifiedBy: meta.modifiedBy ?? null,
      });
    }
    return out;
  }

  /**
   * How sessions are spread over scripts and script versions (rest-api §2.1), in one pass so the
   * library list stays linear. Sessions of a materialised draw point at their source through
   * `scriptSource`; preview sessions never count.
   */
  sessionUsageByScript(project = null) {
    const usage = {};
    for (const id of this.sessionIds()) {
      const session = this.session(id);
      if (session === null || session.type === 'TEST') {
        continue;
      }
      if (project !== null && project !== undefined && session.project !== null && session.project !== undefined
        && String(session.project) !== String(project)) {
        continue;
      }
      const scriptId = String(session.scriptSource ?? session.script ?? '');
      if (scriptId === '') {
        continue;
      }
      const entry = usage[scriptId] ?? {total: 0, started: 0, byVersion: {}};
      entry.total += 1;
      if (session.status !== undefined && session.status !== null && session.status !== 'CREATED') {
        entry.started += 1;
      }
      const version = session.scriptVersion;
      if (version !== null && version !== undefined && version !== 0) {
        entry.byVersion[String(version)] = (entry.byVersion[String(version)] ?? 0) + 1;
      }
      usage[scriptId] = entry;
    }
    return usage;
  }

  // ---------------------------------------------------------------- sessions

  /**
   * Writes the script a session runs to the path the recorder reads (`script/<id>`), so nothing in
   * the recorder changes: `Session.script` points at this materialised document, which is internal
   * and therefore kept out of the library list.
   */
  materialiseScript(sessionId, doc) {
    const id = `sess-${this.segment(sessionId)}`;
    this.writeJson(this.scriptPath(id), {
      ...doc,
      scriptId: coerceId(id),
      internal: true,
      materialisedFor: coerceId(sessionId),
    });
    return id;
  }

  /**
   * A tier-2 dry run: an ephemeral `TEST` session bound to a materialised copy of a draft or a
   * published version. Recordings are refused for it (see the API guard), so nothing can reach
   * storage even if the recorder ignores the flag.
   */
  createPreviewSession({project, scriptId, version = 'draft', ttlMs = 2 * 60 * 60 * 1000}) {
    const source = version === 'draft' || version === null || version === undefined
      ? this.draft(scriptId)
      : this.version(scriptId, String(version));
    if (source === null || source === undefined) {
      throw new RequestError(404, `script ${scriptId} has no ${version} to preview`);
    }
    this.requireRecorderVersion(scriptId, source.minRecorderVersion ?? null);
    const sessionId = `preview-${randomBytes(6).toString('hex')}`;
    const expires = new Date(Date.now() + ttlMs).toISOString();
    let session = {
      sessionId,
      type: 'TEST',
      project,
      script: coerceId(this.materialiseScript(sessionId, source)),
      scriptSource: coerceId(scriptId),
      status: 'CREATED',
      previewOf: {scriptId: coerceId(scriptId), version: version ?? 'draft'},
      expires,
    };
    const resolved = this.resolveSessionDraws(session, {sourceDoc: source});
    if (resolved !== null) {
      session = {...session, ...resolved, drawnDate: new Date().toISOString()};
    }
    this.writeJson(this.sessionPath(sessionId), session);
    return session;
  }

  /** Sessions that may be listed: preview (`TEST`) sessions are excluded unless asked for. */
  sessionIdsExceptPreview(includePreview = false) {
    return this.sessionIds().filter((id) => includePreview || this.session(id)?.type !== 'TEST');
  }

  // ---------------------------------------------------------------- project media

  mediaDir(projectId) {
    return join(this.dataDir, 'project', this.segment(projectId), 'media');
  }

  mediaPath(projectId, name) {
    return join(this.mediaDir(projectId), this.segment(name));
  }

  mediaIndexPath(projectId) {
    return join(this.mediaDir(projectId), 'index.json');
  }

  mediaIndex(projectId) {
    return this.readJson(this.mediaIndexPath(projectId))?.files ?? [];
  }

  /** The project's media files, merged with the recorded metadata (duration, MIME type). */
  listMedia(projectId) {
    const dir = this.mediaDir(projectId);
    if (!existsSync(dir)) {
      return [];
    }
    const recorded = new Map(this.mediaIndex(projectId).map((entry) => [entry.name, entry]));
    return readdirSync(dir)
      .filter((name) => name !== 'index.json' && statSync(join(dir, name)).isFile())
      .sort()
      .map((name) => {
        const meta = recorded.get(name) ?? {};
        return {
          src: `${MEDIA_DIR}/${name}`,
          name,
          mimetype: meta.mimetype ?? mimeTypeFor(name),
          durationMs: meta.durationMs ?? null,
          bytes: statSync(join(dir, name)).size,
          updated: meta.updated ?? null,
        };
      });
  }

  ensureMediaDir(projectId) {
    mkdirSync(this.mediaDir(projectId), {recursive: true});
  }

  recordMedia(projectId, entry) {
    const files = this.mediaIndex(projectId).filter((item) => item.name !== entry.name);
    files.push(entry);
    files.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    this.writeJson(this.mediaIndexPath(projectId), {files});
    return entry;
  }

  removeMedia(projectId, name) {
    const files = this.mediaIndex(projectId).filter((item) => item.name !== name);
    this.writeJson(this.mediaIndexPath(projectId), {files});
  }

  /**
   * The project resources a script draft or published version refers to, mapped to their owners:
   * `{scriptId, draft: true}` for a draft and `{scriptId, version: n}` for a published version.
   * Legacy flat scripts have no versions yet and are reported as version 1.
   */
  resourceReferences(projectId = null) {
    const refs = new Map();
    const add = (src, owner) => {
      const owners = refs.get(src) ?? [];
      owners.push(owner);
      refs.set(src, owners);
    };
    for (const id of this.scriptIds()) {
      const meta = this.scriptMeta(id);
      if (projectId !== null && meta !== null && meta.project !== null && meta.project !== undefined && meta.project !== projectId) {
        continue;
      }
      const scriptId = meta?.scriptId ?? coerceId(id);
      const draft = this.draft(id);
      if (draft !== null) {
        for (const src of referencedResources(draft)) {
          add(src, {scriptId, draft: true});
        }
      }
      for (const version of this.versions(id)) {
        const doc = this.version(id, version);
        if (doc !== null) {
          for (const src of referencedResources(doc)) {
            add(src, {scriptId, version});
          }
        }
      }
      if (meta === null) {
        const legacy = this.readJson(this.scriptPath(id));
        if (legacy !== null) {
          for (const src of referencedResources(legacy)) {
            add(src, {scriptId, version: 1});
          }
        }
      }
    }
    return refs;
  }

  // ---------------------------------------------------------------- banks

  bankPath(id) {
    return join(this.dataDir, 'bank', `${this.segment(id)}.json`);
  }

  /** One bank, with `itemCount` normalised from the stored items. */
  bank(id) {
    const doc = this.readJson(this.bankPath(id));
    return doc === null ? null : {...doc, itemCount: (doc.items ?? []).length};
  }

  /** Every bank, with `itemCount` normalised. */
  banks() {
    const dir = join(this.dataDir, 'bank');
    if (!existsSync(dir)) {
      return [];
    }
    return readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => this.readJson(join(dir, name)))
      .filter((doc) => doc !== null)
      .map((doc) => ({...doc, itemCount: (doc.items ?? []).length}))
      .sort((a, b) => String(a.bankId).localeCompare(String(b.bankId)));
  }

  writeBank(id, doc) {
    this.writeJson(this.bankPath(id), {...doc, bankId: id});
    return this.bank(id);
  }

  /** The next free `item-NNNN` id for a bank. */
  nextBankItemId(bank) {
    const highest = (bank?.items ?? [])
      .map((item) => Number(/^item-(\d+)$/.exec(String(item.bankItemId ?? ''))?.[1] ?? NaN))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0);
    return `item-${String(highest + 1).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------- maintenance

  /** Creates the per-script layout for every legacy flat script (idempotent). */
  migrateLegacyTrees() {
    const summary = {scripts: 0, imported: 0};
    for (const id of this.scriptIds()) {
      const before = this.scriptMeta(id);
      const meta = this.ensureScriptMeta(id);
      summary.scripts += 1;
      if (before === null && meta.publishedVersion > 0) {
        summary.imported += 1;
      }
    }
    return summary;
  }

  /** Keeps the newest `keep` draft revisions per script and drops anything older than `maxAgeDays`. */
  pruneDraftRevisions({keep = 50, maxAgeDays = 30} = {}) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const id of this.scriptIds()) {
      const dir = join(this.scriptDir(id), 'revisions');
      if (!existsSync(dir)) {
        continue;
      }
      const entries = readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => ({
          name,
          number: Number(name.slice(0, -'.json'.length)),
          mtime: statSync(join(dir, name)).mtimeMs,
        }))
        .filter((entry) => Number.isFinite(entry.number))
        .sort((a, b) => b.number - a.number);
      entries.forEach((entry, index) => {
        if (index < keep && entry.mtime >= cutoff) {
          return;
        }
        rmSync(join(dir, entry.name), {force: true});
        removed += 1;
      });
    }
    return {removed};
  }

  /** Preview sessions whose `expires` has passed. */
  expiredPreviews(now = Date.now()) {
    const expired = [];
    for (const id of this.sessionIds()) {
      const session = this.session(id);
      if (session?.type !== 'TEST' || session.expires === undefined || session.expires === null) {
        continue;
      }
      const expiry = Date.parse(session.expires);
      if (!Number.isFinite(expiry) || expiry > now) {
        continue;
      }
      expired.push({sessionId: session.sessionId, script: session.script ?? null});
    }
    return expired;
  }

  /** Removes a session and its materialised script (the source script is never touched). */
  removeSession(sessionId, {materialised = true} = {}) {
    const session = this.session(sessionId);
    rmSync(this.sessionPath(sessionId), {force: true});
    if (materialised && session?.script !== null && session?.script !== undefined) {
      rmSync(this.scriptPath(String(session.script)), {force: true});
    }
    return session;
  }

  /** Media no draft or published version references. */
  orphanMedia(projectId = null) {
    const references = this.resourceReferences(projectId);
    const orphans = [];
    for (const project of this.projectIds()) {
      if (projectId !== null && String(project) !== String(projectId)) {
        continue;
      }
      for (const entry of this.listMedia(String(project))) {
        if ((references.get(entry.src) ?? []).length === 0) {
          orphans.push({project: String(project), ...entry});
        }
      }
    }
    return orphans;
  }

  /**
   * Housekeeping: draft revisions per policy, expired preview sessions, and (only when asked)
   * unreferenced media. Published versions and recordings are never touched.
   */
  gc({keep = 50, maxAgeDays = 30, media = false, now = Date.now()} = {}) {
    const revisions = this.pruneDraftRevisions({keep, maxAgeDays});
    const expired = this.expiredPreviews(now);
    for (const entry of expired) {
      this.removeSession(entry.sessionId);
    }
    const orphans = this.orphanMedia();
    if (media) {
      for (const orphan of orphans) {
        rmSync(this.mediaPath(orphan.project, orphan.name), {force: true});
        this.removeMedia(orphan.project, orphan.name);
      }
    }
    return {
      revisionsRemoved: revisions.removed,
      previewsRemoved: expired.length,
      orphansFound: orphans.length,
      mediaRemoved: media ? orphans.length : 0,
    };
  }

  // ---------------------------------------------------------------- json io

  readJson(path) {
    if (!existsSync(path)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      throw new RequestError(500, `${path} is not valid JSON: ${err.message}`);
    }
  }

  /** Writes atomically: a crash must never leave a half written metadata file behind. */
  writeJson(path, value) {
    mkdirSync(dirname(path), {recursive: true});
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(tmp, path);
  }

  move(from, to) {
    try {
      renameSync(from, to);
    } catch (err) {
      if (err.code !== 'EXDEV') {
        throw err;
      }
      cpSync(from, to);
      unlinkSync(from);
    }
  }

  listJsonIds(kind) {
    const ids = [];
    for (const name of readdirSync(join(this.dataDir, kind))) {
      if (name.endsWith('.json')) {
        ids.push(name.slice(0, -'.json'.length));
      }
    }
    return ids.sort();
  }
}

/** Numeric ids sort numerically, string ids (UUIDs) after them, lexicographically. */
function compareIds(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return na - nb;
  }
  return String(a).localeCompare(String(b));
}

/** Session and project ids that are all digits are numbers in the fixtures and in the client. */
export function coerceId(id) {
  return /^\d+$/.test(String(id)) ? Number(id) : String(id);
}

/** Summary counts for the library list. Drawn sources are counted once the D-W schema lands. */
function scriptCounts(doc) {
  let sections = 0;
  let fixedItems = 0;
  let drawnItems = 0;
  for (const section of doc?.sections ?? []) {
    sections += 1;
    for (const group of section.groups ?? []) {
      for (const item of group.promptItems ?? []) {
        const drawn = item?.prefill?.bank;
        if (drawn === undefined || drawn === null) {
          fixedItems += 1;
        } else {
          // A placeholder stands for the items one session draws from that bank (rest-api §2.1).
          drawnItems += Number.isFinite(Number(drawn.count)) ? Number(drawn.count) : 0;
        }
      }
    }
  }
  return {sections, fixedItems, drawnItems};
}
