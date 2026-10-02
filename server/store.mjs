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
import {dirname, join, resolve, sep} from 'node:path';
import {RequestError} from './body.mjs';
import {etagOf} from './etag.mjs';

const ID_SEQUENCE = 'sequence.json';
const JOURNAL = 'journal.json';

export class Store {
  constructor({dataDir, seedDir, log}) {
    this.dataDir = resolve(dataDir);
    this.seedDir = seedDir === null ? null : resolve(seedDir);
    this.log = log;
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
    for (const dir of ['project', 'script', 'session', 'recordingfile', 'uploads', 'uploads/tmp']) {
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

  createSession(id, {project, script, type = 'NORM'}) {
    const session = {
      sessionId: coerceId(id),
      type,
      project,
      script,
      status: 'CREATED',
      debugMode: false,
    };
    this.writeJson(this.sessionPath(id), session);
    return session;
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
    const target = this.scriptDraftPath(id);
    const tmp = `${target}.tmp-${process.pid}`;
    writeFileSync(tmp, text);
    renameSync(tmp, target);
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

  /** The library list, optionally narrowed to one project. */
  listScripts(project = null) {
    const out = [];
    for (const id of this.scriptIds()) {
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
          : (meta.publishedVersion > 0 && meta.draftVersion <= meta.publishedVersion ? 'PUBLISHED' : 'DRAFT'),
        publishedVersion: meta.publishedVersion ?? 0,
        draftVersion: meta.draftVersion ?? 0,
        ...scriptCounts(doc),
        modified: meta.modified ?? null,
      });
    }
    return out;
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
  for (const section of doc?.sections ?? []) {
    sections += 1;
    for (const group of section.groups ?? []) {
      fixedItems += (group.promptItems ?? []).length;
    }
  }
  return {sections, fixedItems, drawnItems: 0};
}
