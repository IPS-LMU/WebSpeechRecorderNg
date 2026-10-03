/**
 * Cavox REST API receiver.
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
 *   GET    {base}version                                             recorder version the deployment serves
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
import {RequestError, readJsonBody, readTextBody, streamToFile} from './body.mjs';
import {bankIdFor, csvToItems, queryBank} from './bank.mjs';
import {etagOf} from './etag.mjs';
import {minRecorderVersionFor} from './feature-versions.mjs';
import {durationMsOf, MEDIA_DIR, mimeTypeFor, sanitiseMediaName} from './media.mjs';
import {validateScript} from './validate.mjs';
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
    sendJson(res, status, {
      error: message,
      message,
      ...(err instanceof RequestError && err.code !== undefined ? {code: err.code} : {}),
      ...(err instanceof RequestError && err.details !== undefined ? {details: err.details} : {}),
    });
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
        case 'version':
          // What the deployment runs, so the editor's W10/N04 can compare against the recorder the
          // receiver actually serves (B7) instead of a hard-coded value.
          return await sendJson(res, 200, {recorderVersion: store.recorderVersion});
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
        if (rest.length === 4 && stripJsonSuffix(rest[3]) === 'draws') {
          if (req.method === 'GET') {
            return await sendJson(res, 200, sessionTrace(sessionId));
          }
          throw new RequestError(405, `${req.method} is not supported on session/{s}/draws`);
        }
        if (rest.length === 5 && stripJsonSuffix(rest[3]) === 'draws' && stripJsonSuffix(rest[4]) === '_redraw') {
          if (req.method === 'POST') {
            return await sendJson(res, 200, redrawSession(sessionId));
          }
          throw new RequestError(405, `${req.method} is not supported on session/{s}/draws/_redraw`);
        }
        if (rest.length === 3 && (req.method === 'PATCH' || req.method === 'PUT')) {
          return sessionPatch(req, res, sessionId, projectId);
        }
        throw new RequestError(404, `unsupported session route ${rest.join('/')}`);
      }
      if (rest[1] === 'script') {
        return await scriptRoutes(req, res, url, rest.slice(2), projectId);
      }
      if (rest[1] === 'bank') {
        return await bankRoutes(req, res, url, rest.slice(2), projectId);
      }
      if (rest[1] === 'media') {
        return await mediaRoutes(req, res, rest.slice(2), projectId);
      }
      return await sendProjectResource(projectId, rest.slice(1).join('/'));
    }

    // -------------------------------------------------------------- scripts (editor)

    /**
     * The editor's script endpoints, project scoped. `GET script/{id}` (the recorder's view) stays
     * untouched; these add the library list, create/patch and the draft with its ETag rules.
     */
    async function scriptRoutes(req, res, url, rest, projectId) {
      if (rest.length === 0) {
        if (req.method === 'GET') {
          return await sendJson(res, 200, store.listScripts(projectId));
        }
        if (req.method === 'POST') {
          return await createScript(req, res, projectId);
        }
        throw new RequestError(405, `${req.method} is not supported on project/{p}/script`);
      }
      const scriptId = stripJsonSuffix(rest[0]);
      if (rest.length === 1) {
        if (req.method === 'GET') {
          return await sendJson(res, 200, requireFound(store.script(scriptId), `script ${scriptId}`));
        }
        if (req.method === 'PATCH' || req.method === 'PUT') {
          return await patchScript(req, res, scriptId);
        }
        throw new RequestError(405, `${req.method} is not supported on project/{p}/script/{id}`);
      }
      if (stripJsonSuffix(rest[1]) === 'draft' && rest.length === 2) {
        if (req.method === 'GET') {
          return getDraft(res, scriptId);
        }
        if (req.method === 'PUT') {
          return await putDraft(req, res, scriptId);
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/draft`);
      }
      if (stripJsonSuffix(rest[1]) === 'draft' && rest.length === 3 && stripJsonSuffix(rest[2]) === '_restore') {
        if (req.method === 'POST') {
          return await restoreDraft(req, res, scriptId);
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/draft/_restore`);
      }
      if (stripJsonSuffix(rest[1]) === 'publish' && rest.length === 2) {
        if (req.method === 'POST') {
          return await publishScript(req, res, scriptId);
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/publish`);
      }
      if (stripJsonSuffix(rest[1]) === 'preview-session' && rest.length === 2) {
        if (req.method === 'POST') {
          return await createPreviewSession(req, res, scriptId, projectId);
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/preview-session`);
      }
      if (stripJsonSuffix(rest[1]) === 'draws' && rest.length === 2) {
        if (req.method === 'GET') {
          return await scriptDraws(req, res, url, scriptId, projectId);
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/draws`);
      }
      if (stripJsonSuffix(rest[1]) === 'version') {
        if (req.method === 'GET' && rest.length === 2) {
          return await sendJson(res, 200, store.versionsIndex(scriptId));
        }
        if (req.method === 'GET' && rest.length === 3) {
          return getVersion(res, scriptId, stripJsonSuffix(rest[2]));
        }
        throw new RequestError(405, `${req.method} is not supported on script/{id}/version`);
      }
      throw new RequestError(404, `unsupported script route ${rest.join('/')}`);
    }

    /** Serves the stored draft bytes verbatim, so the ETag is a byte comparison (D-S). */
    function getDraft(res, scriptId) {
      const bytes = store.draftBytes(scriptId);
      if (bytes === null) {
        throw new RequestError(404, `script ${scriptId} has no draft`);
      }
      return sendBytes(res, 200, bytes, etagOf(bytes));
    }

    /**
     * Enforces the draft precondition. A script without a draft has no validator, so the client may
     * assert emptiness with `If-None-Match: *`; otherwise `If-Match` is required (428) and must
     * match the stored bytes (412 with the current draft, so the editor can retry once).
     */
    function requireDraftPrecondition(req, scriptId, provided = null) {
      const bytes = store.draftBytes(scriptId);
      const currentEtag = bytes === null ? null : etagOf(bytes);
      if (currentEtag === null && req.headers['if-none-match'] === '*') {
        return {bytes: null, currentEtag: null, value: null};
      }
      const candidate = provided ?? req.headers['if-match'];
      if (candidate === undefined || candidate === null || candidate === '') {
        throw new RequestError(428, 'If-Match is required for a draft write', {code: 'PRECONDITION_REQUIRED'});
      }
      if (candidate !== currentEtag) {
        throw new RequestError(412, 'The draft changed since you loaded it.', {
          code: 'SCRIPT_DRAFT_CONFLICT',
          details: {current: bytes === null ? null : JSON.parse(bytes.toString('utf8')), currentEtag},
        });
      }
      return {bytes, currentEtag, value: bytes === null ? null : JSON.parse(bytes.toString('utf8'))};
    }

    async function putDraft(req, res, scriptId) {
      const text = await readTextBody(req, {maxBytes: maxBody});
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        throw new RequestError(400, 'draft is not valid JSON');
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new RequestError(400, 'draft must be a JSON object');
      }
      requireDraftPrecondition(req, scriptId);
      const stored = store.writeDraft(scriptId, text, value);
      res.setHeader('ETag', stored.etag);
      return await sendJson(res, 200, {scriptId, draftVersion: stored.draftVersion, etag: stored.etag});
    }

    /** Publishes the draft: precondition, the error gate, the feature floor, then the freeze. */
    async function publishScript(req, res, scriptId) {
      const body = await readJsonBody(req).catch(() => ({}));
      if (store.draftBytes(scriptId) === null) {
        throw new RequestError(409, `script ${scriptId} has no draft to publish`, {code: 'NO_DRAFT'});
      }
      const provided = typeof body.fromDraftEtag === 'string' && body.fromDraftEtag !== '' ? body.fromDraftEtag : null;
      const {bytes} = requireDraftPrecondition(req, scriptId, provided);
      const text = bytes.toString('utf8');
      const value = JSON.parse(text);
      const findings = validateScript(value, {lookupBank: (bankId) => store.bank(bankId)});
      if (findings.length > 0) {
        throw new RequestError(409, 'The script has errors and was not published.', {
          code: 'PUBLISH_REJECTED',
          details: {checks: findings},
        });
      }
      const {minRecorderVersion, unknownFeatures} = minRecorderVersionFor(value);
      if (unknownFeatures.length > 0) {
        throw new RequestError(409, `The script uses features with no recorder floor: ${unknownFeatures.join(', ')}`, {
          code: 'FEATURE_FLOOR_UNKNOWN',
          details: {features: unknownFeatures},
        });
      }
      return await sendJson(res, 201, store.publish(scriptId, {
        text,
        note: typeof body.note === 'string' ? body.note : null,
        minRecorderVersion,
      }));
    }

    /** Serves one published version verbatim, with its own strong validator. */
    function getVersion(res, scriptId, version) {
      const text = store.versionText(scriptId, version);
      if (text === null) {
        throw new RequestError(404, `version ${version} of script ${scriptId} does not exist`);
      }
      return sendBytes(res, 200, Buffer.from(text), etagOf(text));
    }

    async function restoreDraft(req, res, scriptId) {
      const body = await readJsonBody(req).catch(() => ({}));
      if (body.version === undefined || body.version === null || body.version === '') {
        throw new RequestError(400, 'version is required');
      }
      requireDraftPrecondition(req, scriptId);
      const stored = store.restoreVersion(scriptId, String(body.version));
      res.setHeader('ETag', stored.etag);
      return await sendJson(res, 200, {scriptId, draftVersion: stored.draftVersion, etag: stored.etag});
    }

    // -------------------------------------------------------------- item banks

    /** Library and query endpoints, plus item CRUD; only project-owned banks are writable. */
    async function bankRoutes(req, res, url, rest, projectId) {
      if (rest.length === 0) {
        if (req.method === 'GET') {
          const visible = store.banks().filter((bank) => bank.source === 'BUILTIN'
            || bank.project === null
            || bank.project === undefined
            || bank.project === projectId);
          return await sendJson(res, 200, visible);
        }
        if (req.method === 'POST') {
          return await createBank(req, res, projectId);
        }
        throw new RequestError(405, `${req.method} is not supported on project/{p}/bank`);
      }
      const bankId = stripJsonSuffix(rest[0]);
      const bank = store.bank(bankId);
      if (bank === null) {
        throw new RequestError(404, `bank ${bankId} does not exist`);
      }
      if (rest.length === 1) {
        if (req.method === 'GET') {
          return await sendJson(res, 200, bank);
        }
        throw new RequestError(405, `${req.method} is not supported on bank/{b}`);
      }
      const leaf = stripJsonSuffix(rest[1]);
      if (leaf === 'item') {
        if (rest.length === 2 && req.method === 'GET') {
          return await sendJson(res, 200, queryBank(bank, filterFromQuery(url), {
            limit: numberParam(url, 'limit', 50),
            offset: numberParam(url, 'offset', 0),
          }));
        }
        if (rest.length === 2 && req.method === 'POST') {
          return await writeBankItem(req, res, bank, projectId, null);
        }
        if (rest.length === 3 && req.method === 'PUT') {
          return await writeBankItem(req, res, bank, projectId, stripJsonSuffix(rest[2]));
        }
        if (rest.length === 3 && req.method === 'DELETE') {
          return await deleteBankItem(res, bank, projectId, stripJsonSuffix(rest[2]));
        }
        throw new RequestError(405, `${req.method} is not supported on bank/{b}/item`);
      }
      if (leaf === '_import' && rest.length === 2 && req.method === 'POST') {
        return await importBankCsv(req, res, bank, projectId);
      }
      throw new RequestError(404, `unsupported bank route ${rest.join('/')}`);
    }

    function filterFromQuery(url) {
      const params = url.searchParams;
      const filter = {};
      const category = params.get('category');
      if (category !== null && category !== '') {
        filter.category = category;
      }
      const minWords = params.get('minWords');
      const maxWords = params.get('maxWords');
      if ((minWords !== null && minWords !== '') || (maxWords !== null && maxWords !== '')) {
        filter.words = [
          minWords === null || minWords === '' ? undefined : Number(minWords),
          maxWords === null || maxWords === '' ? undefined : Number(maxWords),
        ];
      }
      const hasAudio = params.get('hasAudio');
      if (hasAudio !== null && hasAudio !== '') {
        filter.hasAudio = hasAudio === 'true';
      }
      const tags = params.getAll('tag').filter((tag) => tag !== '');
      if (tags.length > 0) {
        filter.tags = tags;
      }
      const q = params.get('q');
      if (q !== null && q !== '') {
        filter.q = q;
      }
      return filter;
    }

    function numberParam(url, name, fallback) {
      const raw = url.searchParams.get(name);
      if (raw === null || raw === '') {
        return fallback;
      }
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    }

    /** Builtin banks and other projects' banks are read-only here. */
    function requireWritableBank(bank, projectId) {
      if (bank.source === 'BUILTIN') {
        throw new RequestError(405, 'builtin banks are read-only', {code: 'BANK_READ_ONLY'});
      }
      if (bank.project === undefined || bank.project === null) {
        throw new RequestError(405, 'the bank is not owned by a project', {code: 'BANK_READ_ONLY'});
      }
      if (bank.project !== projectId) {
        throw new RequestError(403, `bank ${bank.bankId} belongs to project ${bank.project}`);
      }
      return bank;
    }

    async function createBank(req, res, projectId) {
      const body = await readJsonBody(req).catch(() => ({}));
      const title = typeof body.title === 'string' && body.title.trim() !== '' ? body.title.trim() : null;
      const taken = new Set(store.banks().map((bank) => String(bank.bankId)));
      if (body.copyFrom !== undefined && body.copyFrom !== null) {
        const source = store.bank(String(body.copyFrom));
        if (source === null) {
          throw new RequestError(404, `bank ${body.copyFrom} does not exist`);
        }
        const copyTitle = title ?? `${source.title} copy`;
        const copy = {
          title: copyTitle,
          source: 'PROJECT',
          project: projectId,
          copiedFrom: source.bankId,
          copiedFromRelease: source.shippedWith ?? null,
          updated: new Date().toISOString(),
          items: (source.items ?? []).map((item) => ({...item})),
        };
        return await sendJson(res, 201, store.writeBank(bankIdFor(copyTitle, taken), copy));
      }
      if (title === null) {
        throw new RequestError(400, 'title is required');
      }
      return await sendJson(res, 201, store.writeBank(bankIdFor(title, taken), {
        title,
        source: 'PROJECT',
        project: projectId,
        updated: new Date().toISOString(),
        items: [],
      }));
    }

    async function writeBankItem(req, res, bank, projectId, itemId) {
      requireWritableBank(bank, projectId);
      // One item or an array (rest-api §3.3), so the body is parsed here rather than as an object.
      const raw = await readTextBody(req, {maxBytes: maxBody});
      let body;
      try {
        body = raw.trim() === '' ? {} : JSON.parse(raw);
      } catch {
        throw new RequestError(400, 'item body is not valid JSON');
      }
      const candidates = Array.isArray(body) ? body : [body];
      if (candidates.length === 0) {
        throw new RequestError(400, 'no items given');
      }
      const items = [...(bank.items ?? [])];
      const saved = [];
      for (const candidate of candidates) {
        const patch = sanitiseBankItem(candidate);
        if (itemId === null) {
          const at = patch.bankItemId === undefined
            ? -1
            : items.findIndex((entry) => String(entry.bankItemId) === String(patch.bankItemId));
          if (at >= 0) {
            items[at] = {...items[at], ...patch};
            saved.push(items[at]);
          } else {
            const item = {bankItemId: patch.bankItemId ?? store.nextBankItemId({items}), ...patch};
            items.push(item);
            saved.push(item);
          }
        } else {
          const at = items.findIndex((entry) => String(entry.bankItemId) === String(itemId));
          if (at < 0) {
            throw new RequestError(404, `bank item ${itemId} does not exist`);
          }
          items[at] = {...items[at], ...patch, bankItemId: items[at].bankItemId};
          saved.push(items[at]);
        }
      }
      store.writeBank(bank.bankId, {...bank, items, updated: new Date().toISOString()});
      return await sendJson(res, 200, Array.isArray(body) ? saved : saved[0]);
    }

    function sanitiseBankItem(candidate) {
      const allowed = ['bankItemId', 'text', 'promptDoc', 'src', 'mimetype', 'alt', 'audioSrc', 'audioMimetype', 'category', 'words', 'tags'];
      const out = {};
      for (const key of allowed) {
        if (candidate?.[key] !== undefined) {
          out[key] = candidate[key];
        }
      }
      if (typeof out.tags === 'string') {
        out.tags = out.tags.split(/[|;]/).map((tag) => tag.trim()).filter((tag) => tag !== '');
      }
      return out;
    }

    async function deleteBankItem(res, bank, projectId, itemId) {
      requireWritableBank(bank, projectId);
      const items = (bank.items ?? []).filter((entry) => String(entry.bankItemId) !== String(itemId));
      if (items.length === (bank.items ?? []).length) {
        throw new RequestError(404, `bank item ${itemId} does not exist`);
      }
      store.writeBank(bank.bankId, {...bank, items, updated: new Date().toISOString()});
      return await sendJson(res, 200, {bankId: bank.bankId, itemCount: items.length});
    }

    async function importBankCsv(req, res, bank, projectId) {
      requireWritableBank(bank, projectId);
      const contentType = String(req.headers['content-type'] ?? '');
      const text = contentType.includes('text/csv')
        ? await readTextBody(req, {maxBytes: maxBody})
        : String((await readJsonBody(req).catch(() => ({}))).csv ?? '');
      const {items: imported, errors} = csvToItems(text, bank);
      store.writeBank(bank.bankId, {...bank, items: [...(bank.items ?? []), ...imported], updated: new Date().toISOString()});
      return await sendJson(res, 200, {imported: imported.length, skipped: errors.length, errors});
    }

    // -------------------------------------------------------------- project media

    /** Playback clips and image prompts: list with usage, upload (raw or multipart) and delete. */
    async function mediaRoutes(req, res, rest, projectId) {
      if (rest.length === 0) {
        if (req.method === 'GET') {
          return await sendJson(res, 200, listMediaWithUsage(projectId));
        }
        if (req.method === 'POST') {
          return await uploadMedia(req, res, projectId);
        }
        throw new RequestError(405, `${req.method} is not supported on project/{p}/media`);
      }
      const name = rest[0];
      if (rest.length === 1 && req.method === 'GET') {
        const path = store.mediaPath(projectId, name);
        if (!existsSync(path) || !statSync(path).isFile()) {
          throw new RequestError(404, `media ${name} does not exist`);
        }
        return sendFile(res, 200, path, mimeTypeFor(name));
      }
      if (rest.length === 1 && req.method === 'DELETE') {
        return await deleteMedia(res, projectId, name);
      }
      throw new RequestError(405, `${req.method} is not supported on project/{p}/media/{name}`);
    }

    function listMediaWithUsage(projectId) {
      const references = store.resourceReferences(projectId);
      return store.listMedia(projectId).map((entry) => ({...entry, usedBy: references.get(entry.src) ?? []}));
    }

    /** Uploads a clip; a file a published version uses cannot be replaced. */
    async function uploadMedia(req, res, projectId) {
      const contentType = String(req.headers['content-type'] ?? '');
      let tmpPath;
      let name;
      let declared;
      if (multipartBoundary(contentType) !== null) {
        const {files} = await readMultipart(req, {tmpDir: store.tmpDir, maxBytes: maxBody});
        const file = [...files.values()][0];
        if (file === undefined) {
          throw new RequestError(400, 'no file part in the request');
        }
        tmpPath = file.path;
        // The part's own type, not the multipart envelope's.
        declared = String(file.contentType ?? '').split(';')[0].trim();
        name = sanitiseMediaName(file.filename, declared);
      } else {
        const requested = req.headers['x-filename'];
        if (typeof requested !== 'string' || requested.trim() === '') {
          throw new RequestError(400, 'X-Filename is required for a raw media upload');
        }
        declared = contentType.split(';')[0].trim();
        name = sanitiseMediaName(requested, declared);
        tmpPath = tmpFile('media');
        await streamToFile(req, tmpPath, {maxBytes: maxBody});
      }
      const src = `${MEDIA_DIR}/${name}`;
      const published = (store.resourceReferences(projectId).get(src) ?? []).filter((owner) => owner.version !== undefined);
      if (published.length > 0) {
        unlinkSync(tmpPath);
        throw new RequestError(409, `${src} is in use by a published script`, {code: 'MEDIA_IN_USE', details: {usedBy: published}});
      }
      try {
        store.ensureMediaDir(projectId);
        store.move(tmpPath, store.mediaPath(projectId, name));
      } catch (err) {
        unlinkSync(tmpPath);
        throw err;
      }
      const mimetype = declared === '' || declared === 'application/octet-stream' || declared.startsWith('multipart/')
        ? mimeTypeFor(name)
        : declared;
      let durationMs = null;
      if (mimetype === 'audio/wav' || name.toLowerCase().endsWith('.wav')) {
        try {
          durationMs = durationMsOf(probeWav(store.mediaPath(projectId, name)));
        } catch (err) {
          if (!(err instanceof WavError)) {
            throw err;
          }
        }
      }
      const entry = store.recordMedia(projectId, {
        name,
        mimetype,
        durationMs,
        bytes: statSync(store.mediaPath(projectId, name)).size,
        updated: new Date().toISOString(),
      });
      return await sendJson(res, 201, {src, mimetype: entry.mimetype, durationMs, bytes: entry.bytes});
    }

    async function deleteMedia(res, projectId, name) {
      const target = store.mediaPath(projectId, name);
      if (!existsSync(target) || !statSync(target).isFile()) {
        throw new RequestError(404, `media ${name} does not exist`);
      }
      const src = `${MEDIA_DIR}/${name}`;
      const usedBy = store.resourceReferences(projectId).get(src) ?? [];
      const published = usedBy.filter((owner) => owner.version !== undefined);
      if (published.length > 0) {
        throw new RequestError(409, `${src} is in use by a published script`, {code: 'MEDIA_IN_USE', details: {usedBy}});
      }
      unlinkSync(target);
      store.removeMedia(projectId, name);
      return await sendJson(res, 200, {src, deleted: true, usedBy});
    }

    /** Tier-2 dry run: an ephemeral session over a materialised draft or version. */
    async function createPreviewSession(req, res, scriptId, projectId) {
      const body = await readJsonBody(req).catch(() => ({}));
      const version = body.version === undefined || body.version === null || body.version === '' ? 'draft' : String(body.version);
      const session = store.createPreviewSession({project: projectId, scriptId, version});
      return await sendJson(res, 201, {sessionId: session.sessionId, expires: session.expires});
    }

    // -------------------------------------------------------------- draw record

    /** The session's trace: shipped `prefills` for list sources plus `bankDraws` for bank sources. */
    function sessionTrace(sessionId) {
      const session = requireFound(store.session(sessionId), `session ${sessionId}`);
      return {
        sessionId: session.sessionId,
        script: session.scriptSource ?? session.script ?? null,
        scriptVersion: (session.bankDraws ?? [])[0]?.drawnForVersion ?? null,
        drawnDate: session.drawnDate ?? null,
        redraw: session.redraw ?? 0,
        prefills: session.prefills ?? {},
        bankDraws: session.bankDraws ?? [],
      };
    }

    /** Re-draws a session that has not started: a new seed, a new trace, the same session. */
    function redrawSession(sessionId) {
      const session = requireFound(store.session(sessionId), `session ${sessionId}`);
      if (session.status !== 'CREATED') {
        throw new RequestError(409, `session ${sessionId} has started; its draw is fixed`, {code: 'SESSION_ALREADY_STARTED'});
      }
      const candidate = {...session, redraw: (session.redraw ?? 0) + 1};
      const resolved = store.resolveSessionDraws(candidate);
      if (resolved === null) {
        throw new RequestError(409, `session ${sessionId} has no bank sources to redraw`, {code: 'NO_BANK_SOURCES'});
      }
      store.patchSession(sessionId, {...resolved, redraw: candidate.redraw, drawnDate: new Date().toISOString()});
      return sessionTrace(sessionId);
    }

    /** Draw rows across the sessions of one script, for the record view and the CSV export. */
    function collectDrawRows(url, scriptId, projectId) {
      const includePreview = url.searchParams.get('includePreview') === 'true';
      const versionParam = url.searchParams.get('version');
      const rows = [];
      for (const id of store.sessionIdsExceptPreview(includePreview)) {
        const session = store.session(id);
        if (session === null) {
          continue;
        }
        if (projectId !== null && session.project !== undefined && session.project !== null && String(session.project) !== String(projectId)) {
          continue;
        }
        const source = session.scriptSource ?? session.script;
        if (String(source) !== String(scriptId)) {
          continue;
        }
        const recorded = new Set(store.recordingFilesOfSession(id)
          .map((meta) => meta.recording?.itemcode)
          .filter((itemcode) => itemcode !== undefined && itemcode !== null));
        for (const draw of session.bankDraws ?? []) {
          if (versionParam !== null && versionParam !== '' && String(draw.drawnForVersion ?? '') !== String(versionParam)) {
            continue;
          }
          const items = (draw.items ?? []).map((item) => ({...item, recorded: recorded.has(item.itemcode)}));
          rows.push({
            sessionId: session.sessionId,
            speaker: session.speaker ?? null,
            status: session.status,
            preview: session.type === 'TEST',
            scriptVersion: draw.drawnForVersion ?? null,
            drawnDate: session.drawnDate ?? null,
            bank: draw.bank,
            bankSource: draw.bankSource ?? null,
            drawn: items.length,
            recorded: items.filter((item) => item.recorded).length,
            items,
          });
        }
      }
      return rows;
    }

    async function scriptDraws(req, res, url, scriptId, projectId) {
      const rows = collectDrawRows(url, scriptId, projectId);
      if (String(req.headers.accept ?? '').includes('text/csv')) {
        return sendBuffer(res, 200, Buffer.from(drawCsv(rows), 'utf8'), 'text/csv; charset=utf-8');
      }
      const offset = numberParam(url, 'offset', 0);
      const limit = numberParam(url, 'limit', 50);
      return await sendJson(res, 200, {total: rows.length, offset, rows: rows.slice(offset, offset + limit)});
    }

    function drawCsv(rows) {
      const lines = ['sessionId,speaker,itemcode,bankItemId,recorded'];
      for (const row of rows) {
        for (const item of row.items) {
          lines.push([row.sessionId, row.speaker ?? '', item.itemcode, item.bankItemId ?? '', item.recorded ? 'true' : 'false']
            .map(csvField).join(','));
        }
      }
      return `${lines.join('\n')}\n`;
    }

    async function createScript(req, res, projectId) {
      const body = await readJsonBody(req).catch(() => ({}));
      const source = duplicateSource(body.from);
      const requestedName = typeof body.name === 'string' && body.name.trim() !== '' ? body.name : null;
      const name = requestedName
        ?? (source?.name === null || source?.name === undefined ? null : `${source.name} (copy)`);
      const text = source?.text ?? `${JSON.stringify(seedScript(name), null, 2)}\n`;
      const value = source?.value ?? JSON.parse(text);
      const created = store.createScript({name, project: projectId, value, text});
      res.setHeader('ETag', created.etag);
      res.setHeader('Location', `project/${projectId}/script/${created.scriptId}/draft`);
      return await sendJson(res, 201, {scriptId: created.scriptId, draftVersion: created.draftVersion, etag: created.etag});
    }

    /** `{from: {scriptId, version?}}` duplicates a version, the published script or the draft. */
    function duplicateSource(from) {
      if (from === undefined || from === null || typeof from !== 'object' || from.scriptId === undefined) {
        return null;
      }
      const sourceId = String(from.scriptId);
      const name = store.scriptMeta(sourceId)?.name ?? store.script(sourceId)?.name ?? null;
      if (from.version !== undefined && from.version !== null && from.version !== '') {
        const text = store.versionText(sourceId, String(from.version));
        if (text === null) {
          throw new RequestError(404, `version ${from.version} of script ${sourceId} does not exist`);
        }
        return {text, value: JSON.parse(text), name};
      }
      const published = store.publishedText(sourceId);
      if (published !== null) {
        const text = published.toString('utf8');
        return {text, value: JSON.parse(text), name};
      }
      const draft = store.draftBytes(sourceId);
      if (draft !== null) {
        const text = draft.toString('utf8');
        return {text, value: JSON.parse(text), name};
      }
      throw new RequestError(404, `script ${sourceId} has nothing to duplicate`);
    }

    async function patchScript(req, res, scriptId) {
      const patch = await readJsonBody(req).catch(() => ({}));
      return await sendJson(res, 200, store.patchScriptMeta(scriptId, patch));
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
     *
     * A session id of the form `{scriptId}--{anything}` picks that script instead of the
     * configured default: the configuration picker (`src/app/session/sessions.ts`) mints ids
     * this way so choosing a protocol from the bank starts a fresh session bound to it, without
     * the API needing an actual "create session" endpoint.
     */
    function autoCreate(sessionId) {
      if (!autoCreateSession.enabled) {
        return null;
      }
      if (autoCreateSession.project === null) {
        throw new RequestError(404, `session ${sessionId} does not exist and no --project is configured to create one`);
      }
      const script = scriptRequestedBy(sessionId) ?? autoCreateSession.script;
      const session = store.createSession(sessionId, {project: autoCreateSession.project, script});
      log(`created session ${sessionId} (project ${autoCreateSession.project}, script ${script ?? 'none'})`);
      return session;
    }

    function scriptRequestedBy(sessionId) {
      const sepIdx = sessionId.indexOf('--');
      if (sepIdx <= 0) {
        return null;
      }
      const candidate = sessionId.slice(0, sepIdx);
      return store.scriptIds().includes(candidate) ? candidate : null;
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
      requireRecordingWritable(sessionId, req.method);
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

    /** A preview (`TEST`) session is a dry run: nothing may be stored for it. */
    function requireRecordingWritable(sessionId, method) {
      if (method === 'GET' || method === 'HEAD') {
        return;
      }
      if (store.session(sessionId)?.type === 'TEST') {
        throw new RequestError(409, `session ${sessionId} is a preview session and does not accept recordings`, {code: 'TEST_SESSION_READ_ONLY'});
      }
    }

    async function recFileUploadOrAudio(req, res, url, sessionId, segments) {
      requireRecordingWritable(sessionId, req.method);
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

function sendBytes(res, status, payload, etag) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    ...(etag === null || etag === undefined ? {} : {ETag: etag}),
  });
  res.end(payload);
  return status;
}

/** Quotes a CSV field when it contains a comma, a quote or a newline. */
function csvField(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

/** Strips the `.json` suffix the files-mode client appends to editor GETs. */
function stripJsonSuffix(segment) {
  return segment.endsWith('.json') ? segment.slice(0, -'.json'.length) : segment;
}

/** The body a newly created script starts as: one section, one group, one item (so E10 holds). */
function seedScript(name) {
  const script = {
    type: 'script',
    virtualViewBox: {height: 600},
    sections: [{
      mode: 'MANUAL',
      promptphase: 'IDLE',
      order: 'SEQUENTIAL',
      training: false,
      groups: [{
        order: 'SEQUENTIAL',
        promptItems: [{
          itemcode: '1',
          prerecdelay: 1000,
          postrecdelay: 500,
          mediaitems: [{mimetype: 'text/plain', text: ''}],
        }],
      }],
    }],
  };
  if (name !== null) {
    script.name = name;
  }
  return script;
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
