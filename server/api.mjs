/**
 * SpeechRecorder REST API receiver.
 *
 * Implements the server side of the API the recorder client speaks (REST API v1 and v2), as
 * described in `projects/speechrecorderng/README.md` and as the client actually calls it:
 *
 *   GET    {base}project/{projectId}                                  project configuration
 *   GET    {base}project/{projectId}/{resource}                       project resources (images)
 *   GET    {base}script/{scriptId}                                    recording script
 *   GET    {base}session/{sessionId}                                  session
 *   PATCH  {base}session/{sessionId}                                  session status/dates
 *   PATCH  {base}project/{p}/session/{s}                              same, project scoped
 *   GET    {base}project/{p}/session/{s}/recfile                      recording file list
 *   GET    {base}project/{p}/session/{s}/recfile/{id}                 recording audio
 *   GET    {base}project/{p}/session/{s}/recfile/{itemcode}/{version} recording audio (v1)
 *   GET    {base}recordingfile/{id}                                   metadata, or WAVE with Accept: audio/wav
 *   POST   {base}recordingfile/{id}                                   metadata
 *   PATCH  {base}recordingfile/{id}                                   edit selection
 *   POST   {base}session/{s}/recfile/{itemcode}                       upload a recording (v1, raw WAVE)
 *   POST   {base}session/{s}/recfile/{uuid}                           upload a recording (v2, multipart)
 *   POST   {base}session/{s}/recfile/{uuid}/prepareChunksRequest       open a chunked upload
 *   POST   {base}session/{s}/recfile/{uuid}/{chunkIdx}                 upload one chunk
 *   GET    {base}session/{s}/recfile/{uuid}/{chunkIdx}                 does the server hold that chunk?
 *   POST   {base}session/{s}/recfile/{uuid}/concatChunksRequest        close a chunked upload
 *
 * The `spr` recorder variant prefixes chunk paths with the prompt item code:
 * `session/{s}/recfile/{itemcode}/{uuid}/{chunkIdx}`.
 *
 * Uploads answer `{"stored":true,...}`: the client accepts any 2xx but can be configured to
 * require that body (`uploadConfig.requireStoredAck`). Every upload POST is idempotent: the
 * `Idempotency-Key` header of a request that was already answered returns the stored answer,
 * so a retry after a client side timeout cannot store a recording twice.
 */
import {createReadStream, existsSync, statSync, unlinkSync} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {extname, join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {RequestError, readJsonBody, streamToFile} from './body.mjs';
import {multipartBoundary, readMultipart} from './multipart.mjs';
import {concatWavFiles, probeWav, readWavSection, WavError} from './wav.mjs';

const AUDIO_TYPES = {'.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg'};

/** How long a deferred concat may stay incomplete before the log warns about it. */
const PENDING_WARN_MS = 60_000;

export function createApiHandler({store, base, maxBody, log, autoCreateSession, concatWaitMs}) {
  const tmpFile = (kind) => join(store.tmpDir, `${kind}-${process.pid}-${randomBytes(6).toString('hex')}.wav`);

  function respondToError(req, res, err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = err instanceof RequestError ? err.status : (err instanceof WavError ? 400 : 500);
    const message = err instanceof Error ? err.message : String(err);
    if (status >= 500) {
      log(`${req.method} ${req.url} failed: ${err instanceof Error ? err.stack : message}`);
    } else if (status >= 400 && status !== 404) {
      // 404 is the documented answer of several endpoints (no recording yet, chunk not stored).
      log(`${req.method} ${req.url} rejected with ${status}: ${message}`);
    }
    sendJson(res, status, {error: message});
  }

  /** @returns true when the request was handled by the API. */
  return async function handle(req, res, url) {
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
      return false;
    }
    const segments = url.pathname
      .slice(base.length)
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
    try {
      await route(req, res, url, segments);
    } catch (err) {
      respondToError(req, res, err);
    }
    return true;

    async function route(req, res, url, segments) {
      const [head, ...rest] = segments;
      switch (head) {
        case 'project':
          return projectRoutes(req, res, url, rest);
        case 'script':
          return await sendJson(res, 200, requireFound(store.script(one(rest, 'script id')), `script ${rest[0]}`));
        case 'session':
          return sessionRoutes(req, res, url, rest);
        case 'recordingfile':
          return recordingFileRoutes(req, res, url, rest);
        default:
          throw new RequestError(404, `unknown API resource "${head ?? ''}"`);
      }
    }

    // -------------------------------------------------------------- project

    async function projectRoutes(req, res, url, rest) {
      const projectId = one(rest, 'project id');
      if (rest.length === 1) {
        return await sendJson(res, 200, requireFound(store.project(projectId), `project ${projectId}`));
      }
      if (rest[1] === 'session') {
        const sessionId = two(rest, 2, 'session id');
        if (rest.length === 4 && rest[3] === 'recfile') {
          return recFileList(projectId, sessionId);
        }
        if (rest.length > 4 && rest[3] === 'recfile') {
          return recFileItem(req, res, url, projectId, sessionId, rest.slice(4));
        }
        if (rest.length === 3 && (req.method === 'PATCH' || req.method === 'PUT')) {
          return sessionPatch(req, res, sessionId, projectId);
        }
        throw new RequestError(404, `unsupported session route ${rest.join('/')}`);
      }
      return await sendProjectResource(projectId, rest.slice(1).join('/'));
    }

    function sessionRoutes(req, res, url, rest) {
      const sessionId = one(rest, 'session id');
      if (rest.length === 1) {
        if (req.method === 'GET') {
          return getSession(sessionId);
        }
        if (req.method === 'PATCH' || req.method === 'PUT') {
          return sessionPatch(req, res, sessionId, null);
        }
        throw new RequestError(405, `${req.method} is not supported on session/{sessionId}`);
      }
      if (rest[1] === 'recfile') {
        return recFileUploadOrAudio(req, res, url, sessionId, rest.slice(2));
      }
      throw new RequestError(404, `unsupported session route ${rest.join('/')}`);
    }

    function getSession(sessionId) {
      const session = store.session(sessionId) ?? autoCreate(sessionId);
      return sendJson(res, 200, requireFound(session, `session ${sessionId}`));
    }

    /**
     * The API has no endpoint to create a session: sessions are planned outside the recorder.
     * For evaluating the recorder, an unknown id is created on first load with the configured
     * project and script, so any session id in the URL can be recorded.
     */
    function autoCreate(sessionId) {
      if (!autoCreateSession.enabled) {
        return null;
      }
      if (autoCreateSession.project === null) {
        throw new RequestError(404, `session ${sessionId} does not exist and no --project is configured to create one`);
      }
      const session = store.createSession(sessionId, {project: autoCreateSession.project, script: autoCreateSession.script});
      log(`created session ${sessionId} (project ${autoCreateSession.project}, script ${autoCreateSession.script ?? 'none'})`);
      return session;
    }

    async function sessionPatch(req, res, sessionId, projectId) {
      const session = store.session(sessionId);
      if (session === null) {
        throw new RequestError(404, `session ${sessionId} does not exist`);
      }
      if (projectId !== null && String(session.project) !== projectId) {
        throw new RequestError(404, `session ${sessionId} does not belong to project ${projectId}`);
      }
      const patch = await readJsonBody(req);
      const updated = store.patchSession(sessionId, patch);
      log(`patched session ${sessionId}: ${JSON.stringify(patch)}`);
      return await sendJson(res, 200, updated);
    }

    // -------------------------------------------------------------- recording file list and audio

    async function recFileList(projectId, sessionId) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      return await sendJson(res, 200, store.recordingFilesOfSession(sessionId, {project: projectId}));
    }

    async function recFileItem(req, res, url, projectId, sessionId, segments) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      if (segments.length === 1) {
        return await sendRecordingAudio(req, res, url, resolveRecordingInSession(segments[0], sessionId));
      }
      if (segments.length === 2) {
        const [itemcode, version] = segments;
        const recording = store
          .recordingFilesOfSession(sessionId, {project: projectId})
          .filter((meta) => meta.recording?.itemcode === itemcode && String(meta.version ?? 0) === String(version))
          .pop();
        if (recording !== undefined) {
          return await sendRecordingAudio(req, res, url, recording);
        }
        // Sessions recorded by a legacy server keep their audio next to the session, without metadata.
        const legacy = store.legacyAudioPath(projectId, sessionId, itemcode, version);
        if (legacy !== null) {
          return sendFile(res, 200, legacy, 'audio/wav');
        }
        throw new RequestError(404, `recording file of item ${itemcode} version ${version} in session ${sessionId} does not exist`);
      }
      throw new RequestError(404, `unsupported recording file route ${segments.join('/')}`);
    }

    // -------------------------------------------------------------- uploads

    async function recFileUploadOrAudio(req, res, url, sessionId, segments) {
      if (segments.length === 0) {
        throw new RequestError(404, 'recording file id missing');
      }
      const last = segments[segments.length - 1];
      if (req.method === 'POST' && last === 'prepareChunksRequest') {
        return await prepareChunkedUpload(req, res, sessionId, segments.slice(0, -1));
      }
      if (req.method === 'POST' && last === 'concatChunksRequest') {
        return await concatChunkedUpload(req, res, sessionId, segments.slice(0, -1));
      }
      if (segments.length === 1) {
        if (req.method === 'POST') {
          return await uploadRecording(req, res, sessionId, {itemcode: segments[0]});
        }
        if (req.method === 'GET') {
          return await sendRecordingAudio(req, res, url, resolveRecordingInSession(segments[0], sessionId));
        }
        throw new RequestError(405, `${req.method} is not supported on session/{sessionId}/recfile/{id}`);
      }
      if (isChunkIndex(last)) {
        const chunkIdx = last;
        const uuid = segments[segments.length - 2];
        const itemcode = segments.length > 2 ? segments[segments.length - 3] : null;
        if (req.method === 'POST') {
          return await uploadChunk(req, res, sessionId, {uuid, itemcode, chunkIdx});
        }
        if (req.method === 'GET') {
          return chunkStored(uuid, chunkIdx);
        }
      }
      throw new RequestError(404, `unsupported upload route ${segments.join('/')}`);
    }

    /** v1 upload: the body is the WAVE file itself. v2 upload: multipart with a `uuid` field. */
    async function uploadRecording(req, res, sessionId, {itemcode}) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      if (multipartBoundary(req.headers['content-type']) !== null) {
        const {fields, files} = await readMultipart(req, {tmpDir: store.tmpDir, maxBytes: maxBody});
        try {
          const audio = files.get('audio') ?? [...files.values()][0];
          if (audio === undefined) {
            throw new RequestError(400, 'multipart upload without an audio part');
          }
          const uuid = fields.uuid ?? null;
          return await storeRecording(req, res, {
            sessionId,
            uuid,
            itemcode: fields.itemcode ?? null,
            startedDate: fields.startedDate ?? null,
            wavPath: audio.path,
            note: `upload uuid=${uuid ?? '-'}`,
          });
        } finally {
          await removeAll(files);
        }
      }
      const wavPath = tmpFile('upload');
      await streamToFile(req, wavPath, {maxBytes: maxBody});
      try {
        return await storeRecording(req, res, {
          sessionId,
          uuid: null,
          itemcode,
          startedDate: null,
          wavPath,
          note: `upload item=${itemcode}`,
        });
      } finally {
        removeIfPresent(wavPath);
      }
    }

    async function storeRecording(req, res, {sessionId, uuid, itemcode, startedDate, wavPath, note}) {
      return await idempotent(req, res, note, async () => {
        const wavMeta = probeWav(wavPath);
        const session = store.session(sessionId);
        const recording = store.addRecording({
          sessionId,
          itemcode,
          uuid,
          startedDate,
          project: session?.project ?? null,
          wavPath,
          wavMeta,
        });
        log(`${note}: stored recordingfile ${recording.recordingFileId} (session ${sessionId}, version ${recording.version}, ${recording.frames} frames, ${recording.bytes} bytes)`);
        return {
          status: 201,
          body: {
            stored: true,
            recordingFileId: recording.recordingFileId,
            session: recording.session,
            version: recording.version,
            itemcode: recording.itemcode ?? null,
            uuid: recording.uuid ?? null,
            frames: recording.frames,
            samplerate: recording.samplerate,
            channels: recording.channels,
          },
        };
      });
    }

    async function prepareChunkedUpload(req, res, sessionId, segments) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      const {fields, files} = await readFields(req);
      try {
        const uuid = fields.uuid ?? segments[segments.length - 1];
        const itemcode = segments.length > 1 ? segments[segments.length - 2] : fields.itemcode ?? null;
        if (uuid === undefined || uuid === '') {
          throw new RequestError(400, 'prepareChunksRequest without a uuid');
        }
        const chunkSession = store.upsertChunkSession(uuid, {
          sessionId,
          ...(itemcode === null || itemcode === undefined ? {} : {itemcode}),
          ...(fields.startedDate ? {startedDate: fields.startedDate} : {}),
        });
        log(`prepareChunksRequest: uuid=${uuid} session=${sessionId} item=${itemcode ?? '-'} (${store.chunkIndices(uuid).length} chunks already received)`);
        return await sendJson(res, 201, {
          stored: true,
          uuid,
          sessionId,
          chunkCount: store.chunkIndices(uuid).length,
          startedDate: chunkSession.startedDate,
        });
      } finally {
        await removeAll(files);
      }
    }

    /** One WAVE file per chunk; the client posts raw bytes, multipart is accepted as well. */
    async function uploadChunk(req, res, sessionId, {uuid, itemcode, chunkIdx}) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      let wavPath = tmpFile('chunk');
      if (multipartBoundary(req.headers['content-type']) !== null) {
        const {fields, files} = await readMultipart(req, {tmpDir: store.tmpDir, maxBytes: maxBody});
        const audio = files.get('audio') ?? [...files.values()][0];
        if (audio === undefined) {
          await removeAll(files);
          throw new RequestError(400, 'chunk upload without an audio part');
        }
        removeAllExcept(files, audio);
        wavPath = audio.path;
        uuid = fields.uuid ?? uuid;
        itemcode = fields.itemcode ?? itemcode;
      } else {
        await streamToFile(req, wavPath, {maxBytes: maxBody});
      }
      try {
        const wavMeta = probeWav(wavPath);
        if (uuid === null || uuid === undefined || uuid === '') {
          throw new RequestError(400, 'chunk upload without a recording UUID');
        }
        const replaced = store.chunkIndices(uuid).includes(Number(chunkIdx));
        store.upsertChunkSession(uuid, {
          sessionId,
          ...(itemcode === null || itemcode === undefined ? {} : {itemcode}),
        });
        store.addChunk(uuid, chunkIdx, wavPath);
        const chunkBytes = statSync(store.chunkPath(uuid, chunkIdx)).size;
        // A deferred concat is completed by this upload: the chunk the client queued behind it.
        await completeDeferredConcat(sessionId, uuid).catch((err) => {
          log(`could not publish the deferred concat of ${uuid}: ${err.message}`);
          return null;
        });
        return await idempotent(req, res, `chunk ${chunkIdx} of ${uuid}`, async () => {
          log(`chunk ${chunkIdx} of ${uuid} stored (${wavMeta.frames} frames, ${chunkBytes} bytes${replaced ? ', replaced' : ''})`);
          return {status: 200, body: {stored: true, uuid, chunkIdx: Number(chunkIdx), chunkCount: store.chunkIndices(uuid).length}};
        });
      } finally {
        removeIfPresent(wavPath);
      }
    }

    function chunkStored(uuid, chunkIdx) {
      const path = store.chunkPath(uuid, chunkIdx);
      if (!existsSync(path)) {
        // 404 is the documented answer for "not stored"; the client then uploads the chunk.
        throw new RequestError(404, `chunk ${chunkIdx} of ${uuid} is not stored`);
      }
      return sendFile(res, 200, path, 'audio/wav');
    }

    async function concatChunkedUpload(req, res, sessionId, segments) {
      requireFound(store.session(sessionId), `session ${sessionId}`);
      const {fields, files} = await readFields(req);
      const tmpPath = tmpFile('concat');
      try {
        const uuid = fields.uuid ?? segments[segments.length - 1];
        const itemcode = segments.length > 1 ? segments[segments.length - 2] : fields.itemcode ?? null;
        const announced = Number(fields.chunkCount ?? NaN);
        const done = store.chunkSession(uuid)?.finalizedRecording;
        if (done !== undefined && done !== null) {
          log(`concatChunksRequest for ${uuid} repeated: recordingfile ${done.recordingFileId} was already published`);
          return await sendJson(res, 200, {stored: true, uuid, ...done, replayed: true});
        }
        // The client queues this request before the last chunk: its WavWriter encodes that chunk
        // asynchronously and the upload queue is sequential, so the chunk only arrives once this
        // request has been answered. Wait briefly for chunks that are already in flight, then
        // defer and publish the recording when the remaining chunks have arrived.
        const {indices, missing} = await waitForChunks(store, uuid, announced, concatWaitMs, log);
        if (indices.length === 0 || missing.length > 0) {
          const announcedLabel = Number.isFinite(announced) ? `${announced} chunk(s)` : 'the announced chunks';
          store.upsertChunkSession(uuid, {pendingConcat: {announced: Number.isFinite(announced) ? announced : null, at: new Date().toISOString()}});
          schedulePendingWarning(uuid);
          log(`concatChunksRequest for ${uuid}: ${indices.length} of ${announcedLabel} stored (${missing.join(', ') || 'none'} still in flight), deferring`);
          return await sendJson(res, 200, {
            stored: true,
            uuid,
            pending: true,
            chunksReceived: indices.length,
            chunksAnnounced: Number.isFinite(announced) ? announced : null,
          });
        }
        return await idempotent(req, res, `concat ${indices.length} chunks of ${uuid}`, () =>
          publishChunkRecording(sessionId, {uuid, itemcode, indices, tmpPath, announced}));
      } finally {
        removeIfPresent(tmpPath);
        await removeAll(files);
      }
    }

    /** Concatenates the stored chunks, publishes the recording and closes the chunk session. */
    async function publishChunkRecording(sessionId, {uuid, itemcode, indices, tmpPath, announced, late = false}) {
      if (Number.isFinite(announced) && indices.length !== announced) {
        log(`concatChunksRequest announced ${announced} chunks but ${indices.length} were stored for ${uuid}: concatenating all stored chunks`);
      }
      const gaps = indices.filter((idx, position) => idx !== position);
      if (gaps.length > 0) {
        throw new RequestError(409, `chunks of ${uuid} are not contiguous: stored ${indices.join(', ')}`);
      }
      await concatWavFiles(indices.map((idx) => store.chunkPath(uuid, idx)), tmpPath);
      const wavMeta = probeWav(tmpPath);
      const session = store.session(sessionId);
      const recording = store.addRecording({
        sessionId,
        itemcode: itemcode ?? store.chunkSession(uuid)?.itemcode ?? null,
        uuid,
        startedDate: store.chunkSession(uuid)?.startedDate ?? null,
        project: session?.project ?? null,
        wavPath: tmpPath,
        wavMeta,
      });
      log(`concatChunksRequest: ${indices.length} chunks of ${uuid} -> recordingfile ${recording.recordingFileId} (${recording.frames} frames, ${recording.bytes} bytes${late ? ', finalized after late chunks' : ''})`);
      const published = {
        recordingFileId: recording.recordingFileId,
        session: recording.session,
        version: recording.version,
        chunks: indices.length,
        frames: recording.frames,
        samplerate: recording.samplerate,
        channels: recording.channels,
        date: recording.date,
      };
      store.markChunkSessionFinalized(uuid, published);
      store.upsertChunkSession(uuid, {pendingConcat: null});
      return {status: 200, body: {stored: true, uuid, ...published}};
    }

    /**
     * A deferred concat is completed by the chunk uploads that follow it. Should a chunk never
     * arrive, the recording stays unpublished and the chunk session stays in the data directory:
     * the operator sees that in the log instead of a silently truncated recording.
     */
    async function completeDeferredConcat(sessionId, uuid) {
      const chunkSession = store.chunkSession(uuid);
      const pending = chunkSession?.pendingConcat;
      if (pending === undefined || pending === null || chunkSession.finalizedRecording != null) {
        return null;
      }
      const indices = store.chunkIndices(uuid);
      const announced = Number.isFinite(Number(pending.announced)) ? Number(pending.announced) : indices.length;
      if (indices.length < announced) {
        return null;
      }
      const tmpPath = tmpFile('concat');
      try {
        const {body} = await publishChunkRecording(sessionId, {
          uuid,
          itemcode: chunkSession.itemcode ?? null,
          indices,
          tmpPath,
          announced,
          late: true,
        });
        return body;
      } finally {
        removeIfPresent(tmpPath);
      }
    }

    function schedulePendingWarning(uuid) {
      const timer = setTimeout(() => {
        const chunkSession = store.chunkSession(uuid);
        if (chunkSession === null || chunkSession.pendingConcat == null || chunkSession.finalizedRecording != null) {
          return;
        }
        log(`warning: no recording was published for ${uuid}: ${store.chunkIndices(uuid).length} chunk(s) stored, concat never completed`);
      }, PENDING_WARN_MS);
      timer.unref?.();
    }

    // -------------------------------------------------------------- recordingfile resource

    async function recordingFileRoutes(req, res, url, rest) {
      if (rest.length !== 1) {
        throw new RequestError(404, `unsupported recordingfile route ${rest.join('/')}`);
      }
      const {id, suffix} = splitSuffix(rest[0]);
      const recording = store.recordingFile(id) ?? store.recordingFileByUuid(id);
      if (req.method === 'GET') {
        if (suffix === 'json' || !wantsAudio(req)) {
          return await sendJson(res, 200, requireFound(recording, `recording file ${id}`));
        }
        return await sendRecordingAudio(req, res, url, recording);
      }
      if (req.method === 'POST') {
        // The documented metadata request; the body is ignored.
        return await sendJson(res, 200, requireFound(recording, `recording file ${id}`));
      }
      if (req.method === 'PATCH') {
        const stored = requireFound(recording, `recording file ${id}`);
        const patch = pick(await readJsonBody(req), ['editSampleRate', 'editStartFrame', 'editEndFrame']);
        const updated = store.patchRecordingFile(stored.recordingFileId, patch);
        log(`patched recordingfile ${updated.recordingFileId}: ${JSON.stringify(patch)}`);
        return await sendJson(res, 200, updated);
      }
      throw new RequestError(405, `${req.method} is not supported on recordingfile/{id}`);
    }

    // -------------------------------------------------------------- helpers

    /** Answers a recording as WAVE, or as the requested section of it. */
    async function sendRecordingAudio(req, res, url, recording) {
      if (recording === null) {
        // The client reads sections until the recording ends: 404 means "no audio (yet)".
        throw new RequestError(404, 'recording file does not exist');
      }
      const id = recording.recordingFileId;
      const path = store.recordingFileAudioPath(id);
      if (!existsSync(path)) {
        throw new RequestError(404, `recording file ${id} has no audio`);
      }
      const startFrame = intParam(url, 'startFrame');
      const frameLength = intParam(url, 'frameLength');
      if (startFrame === null && frameLength === null) {
        return sendFile(res, 200, path, AUDIO_TYPES[extname(path)] ?? 'audio/wav');
      }
      const meta = probeWav(path);
      const section = readWavSection(path, meta, startFrame ?? 0, frameLength ?? meta.frames);
      if (section === null) {
        throw new RequestError(404, `requested section starts after the end of recording file ${id} (${meta.frames} frames)`);
      }
      return sendBuffer(res, 200, section, 'audio/wav');
    }

    function resolveRecordingInSession(idOrUuid, sessionId) {
      const {id} = splitSuffix(idOrUuid);
      const direct = store.recordingFile(id);
      if (direct !== null) {
        return direct;
      }
      const byUuid = store.recordingFileByUuid(id);
      if (byUuid !== null && String(byUuid.session) === String(sessionId)) {
        return byUuid;
      }
      return null;
    }

    /**
     * Replays the stored answer for a repeated `Idempotency-Key`. The payload of the first
     * attempt is already on disk, so answering again must not store it a second time.
     */
    async function idempotent(req, res, note, produce) {
      const key = req.headers['idempotency-key'];
      const known = store.idempotencyLookup(key);
      if (known !== null) {
        log(`replayed answer for idempotency key ${key} (${known.note})`);
        res.setHeader('Idempotency-Replayed', 'true');
        return await sendJson(res, known.status, JSON.parse(Buffer.from(known.body, 'base64').toString('utf8')));
      }
      const result = await produce();
      if (typeof key === 'string' && key !== '') {
        store.idempotencyRemember(key, {
          status: result.status,
          body: Buffer.from(JSON.stringify(result.body)).toString('base64'),
          note,
          date: new Date().toISOString(),
        });
      }
      return await sendJson(res, result.status, result.body);
    }

    /**
     * Reads the fields of a multipart body. The prepare and concat requests are small, but a
     * client may send them as plain JSON or with an empty body; both are accepted.
     */
    async function readFields(req) {
      if (multipartBoundary(req.headers['content-type']) !== null) {
        return await readMultipart(req, {tmpDir: store.tmpDir, maxBytes: maxBody});
      }
      return {fields: await readJsonBody(req).catch(() => ({})), files: new Map()};
    }

    async function sendProjectResource(projectId, relPath) {
      requireFound(store.project(projectId), `project ${projectId}`);
      const path = store.projectResourcePath(projectId, relPath);
      if (!existsSync(path) || !statSync(path).isFile()) {
        throw new RequestError(404, `project resource ${relPath} does not exist`);
      }
      return sendFile(res, 200, path, contentTypeOf(path));
    }
  };
}

// ------------------------------------------------------------------ response helpers

function sendJson(res, status, body, headers = {}) {
  const payload = Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
  return status;
}

function sendFile(res, status, path, contentType) {
  const size = statSync(path).size;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': size,
    'Cache-Control': 'no-store',
  });
  createReadStream(path).pipe(res);
  return status;
}

function sendBuffer(res, status, buf, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
  return status;
}

// ------------------------------------------------------------------ small helpers

function requireFound(value, what) {
  if (value === null || value === undefined) {
    throw new RequestError(404, `${what} does not exist`);
  }
  return value;
}

function one(segments, what) {
  if (segments.length < 1 || segments[0] === '') {
    throw new RequestError(400, `${what} missing`);
  }
  return segments[0];
}

function two(segments, index, what) {
  if (segments.length <= index || segments[index] === '') {
    throw new RequestError(400, `${what} missing`);
  }
  return segments[index];
}

/** Splits the optional `.json` / `.wav` suffix used by the demo (`apiType: 'files'`) client. */
function splitSuffix(segment) {
  const match = /^(.*)\.(json|wav)$/.exec(segment);
  return match === null ? {id: segment, suffix: null} : {id: match[1], suffix: match[2]};
}

function wantsAudio(req) {
  return (req.headers.accept ?? '').split(',').some((value) => value.trim().startsWith('audio/'));
}

function isChunkIndex(value) {
  return /^\d+$/.test(value ?? '');
}

function intParam(url, name) {
  const raw = url.searchParams.get(name);
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new RequestError(400, `query parameter ${name} must be a non negative number`);
  }
  return Math.floor(value);
}

function pick(object, keys) {
  const out = {};
  for (const key of keys) {
    if (object[key] !== undefined) {
      out[key] = object[key];
    }
  }
  return out;
}

function contentTypeOf(path) {
  const types = {
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    ...AUDIO_TYPES,
  };
  return types[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/** Polls for chunks that are still in flight; concat may overtake the last chunk upload. */
async function waitForChunks(store, uuid, announced, timeoutMs, log) {
  const expected = Number.isFinite(announced) ? announced : null;
  const started = Date.now();
  const deadline = started + timeoutMs;
  for (;;) {
    const indices = store.chunkIndices(uuid);
    const missing = expected === null ? [] : Array.from({length: expected}, (_, idx) => idx).filter((idx) => !indices.includes(idx));
    const complete = missing.length === 0 && (expected === null || indices.length >= expected);
    if (complete || Date.now() >= deadline) {
      if (Date.now() - started > 250) {
        log(`concat of ${uuid} waited ${Date.now() - started} ms for chunks still in flight (stored ${indices.length}/${expected ?? '?'})`);
      }
      return {indices, missing};
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function removeAll(files) {
  for (const file of files.values()) {
    await unlink(file.path).catch(() => {});
  }
  files.clear();
}

/** Keeps the file part that is about to be moved into the store, deletes the other parts. */
function removeAllExcept(files, keep) {
  for (const [name, file] of files) {
    if (file !== keep) {
      removeIfPresent(file.path);
      files.delete(name);
    }
  }
}

function removeIfPresent(path) {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
