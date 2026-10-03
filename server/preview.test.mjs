import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {withServer, jsonRequest} from './api-harness.mjs';

const draft = (name) => ({
  name,
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
    groups: [{order: 'SEQUENTIAL', promptItems: [
      {itemcode: '1', mediaitems: [{mimetype: 'text/plain', text: 'eins'}]},
    ]}]}],
});

async function createWithDraft(base, name = 'Preview me') {
  const created = await (await fetch(`${base}/project/demo/script`, jsonRequest('POST', {name}))).json();
  const etag = (await fetch(`${base}/project/demo/script/${created.scriptId}/draft`, {
    method: 'PUT',
    headers: {'content-type': 'application/json', 'if-match': created.etag},
    body: JSON.stringify(draft(name)),
  })).headers.get('etag');
  return {...created, etag};
}

test('preview sessions materialise a draft and refuse recordings', async () => {
  await withServer(async ({base, dataDir}) => {
    const script = await createWithDraft(base, 'Preview draft');

    const preview = await fetch(`${base}/project/demo/script/${script.scriptId}/preview-session`, jsonRequest('POST', {version: 'draft'}));
    assert.equal(preview.status, 201);
    const {sessionId, expires} = await preview.json();
    assert.match(sessionId, /^preview-[0-9a-f]{12}$/);
    assert.match(expires, /^\d{4}-\d{2}-\d{2}T/);

    const session = await (await fetch(`${base}/session/${sessionId}`)).json();
    assert.equal(session.type, 'TEST');
    assert.equal(session.project, 'demo');
    assert.equal(session.status, 'CREATED');
    assert.deepEqual(session.previewOf, {scriptId: script.scriptId, version: 'draft'});
    assert.equal(typeof session.script, 'string');

    // The recorder reads Session.script: the materialised copy carries the draft's content.
    const materialised = await (await fetch(`${base}/script/${session.script}`)).json();
    assert.equal(materialised.name, 'Preview draft');
    assert.equal(materialised.internal, true);
    assert.equal(materialised.materialisedFor, sessionId);
    assert.equal(materialised.sections[0].groups[0].promptItems.length, 1);

    // Internal scripts stay out of the library list.
    const listed = await (await fetch(`${base}/project/demo/script`)).json();
    assert.deepEqual(listed.map((entry) => entry.scriptId), [script.scriptId]);

    // No write path accepts a recording for the preview session.
    const upload = await fetch(`${base}/session/${sessionId}/recfile/I1`, {
      method: 'POST',
      headers: {'content-type': 'audio/wav'},
      body: Buffer.from('not a wave'),
    });
    assert.equal(upload.status, 409);
    assert.equal((await upload.json()).code, 'TEST_SESSION_READ_ONLY');
    const prepare = await fetch(`${base}/session/${sessionId}/recfile/uuid-1/prepareChunksRequest`, jsonRequest('POST', {chunks: 1}));
    assert.equal(prepare.status, 409);
    const chunk = await fetch(`${base}/session/${sessionId}/recfile/uuid-1/0`, {
      method: 'POST',
      headers: {'content-type': 'audio/wav'},
      body: Buffer.from('x'),
    });
    assert.equal(chunk.status, 409);
    const projectScoped = await fetch(`${base}/project/demo/session/${sessionId}/recfile/I1`, {
      method: 'POST',
      headers: {'content-type': 'audio/wav'},
      body: Buffer.from('x'),
    });
    assert.equal(projectScoped.status, 409);

    // A normal session is not blocked by the guard (the WAVE is simply invalid).
    writeFileSync(join(dataDir, 'session', '42.json'), JSON.stringify({
      sessionId: 42, type: 'NORM', project: 'demo', script: null, status: 'CREATED',
    }));
    const normal = await fetch(`${base}/session/42/recfile/I1`, {
      method: 'POST',
      headers: {'content-type': 'audio/wav'},
      body: Buffer.from('not a wave'),
    });
    assert.notEqual(normal.status, 409);
  });
});

test('preview sessions can target a published version', async () => {
  await withServer(async ({base}) => {
    const script = await createWithDraft(base, 'Versioned');
    const published = await fetch(`${base}/project/demo/script/${script.scriptId}/publish`, jsonRequest('POST', {fromDraftEtag: script.etag}));
    assert.equal(published.status, 201);
    assert.equal((await published.json()).version, 1);

    const preview = await fetch(`${base}/project/demo/script/${script.scriptId}/preview-session`, jsonRequest('POST', {version: 1}));
    assert.equal(preview.status, 201);
    const {sessionId} = await preview.json();
    const session = await (await fetch(`${base}/session/${sessionId}`)).json();
    assert.deepEqual(session.previewOf, {scriptId: script.scriptId, version: '1'});
    const materialised = await (await fetch(`${base}/script/${session.script}`)).json();
    assert.equal(materialised.name, 'Versioned');

    const missing = await fetch(`${base}/project/demo/script/${script.scriptId}/preview-session`, jsonRequest('POST', {version: 7}));
    assert.equal(missing.status, 404);
  });
});
