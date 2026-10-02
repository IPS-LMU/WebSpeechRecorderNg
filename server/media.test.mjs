import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {buildWavHeader} from './wav.mjs';
import {withServer, jsonRequest} from './api-harness.mjs';

const SAMPLE_RATE = 16000;
const DATA_BYTES = SAMPLE_RATE * 2; // one second, 16-bit mono
const WAV = Buffer.concat([
  buildWavHeader({audioFormat: 1, channels: 1, sampleRate: SAMPLE_RATE, bitsPerSample: 16}, DATA_BYTES),
  Buffer.alloc(DATA_BYTES),
]);

const uploadRaw = (base, project, name, bytes, contentType = 'audio/wav') =>
  fetch(`${base}/project/${project}/media`, {
    method: 'POST',
    headers: {'content-type': contentType, 'x-filename': name},
    body: bytes,
  });

const listMedia = async (base, project = 'demo') => (await fetch(`${base}/project/${project}/media`)).json();

test('media: upload with duration, list with usage, in-use protection', async () => {
  await withServer(async ({base, dataDir}) => {
    const uploaded = await uploadRaw(base, 'demo', 'model-01.wav', WAV);
    assert.equal(uploaded.status, 201);
    const media = await uploaded.json();
    assert.deepEqual({...media, bytes: undefined}, {src: 'media/model-01.wav', mimetype: 'audio/wav', durationMs: 1000, bytes: undefined});
    assert.equal(media.bytes, WAV.length);

    const listed = await listMedia(base);
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0], {
      src: 'media/model-01.wav',
      name: 'model-01.wav',
      mimetype: 'audio/wav',
      durationMs: 1000,
      bytes: WAV.length,
      updated: listed[0].updated,
      usedBy: [],
    });

    const served = await fetch(`${base}/project/demo/media/model-01.wav`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'audio/wav');
    assert.equal((await served.arrayBuffer()).byteLength, WAV.length);

    // Reference it from a draft, then publish, and the file becomes protected.
    const created = await (await fetch(`${base}/project/demo/script`, jsonRequest('POST', {name: 'With audio'}))).json();
    const draft = {
      name: 'With audio',
      sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
        groups: [{order: 'SEQUENTIAL', promptItems: [
          {itemcode: '1', mediaitems: [{mimetype: 'audio/wav', src: 'media/model-01.wav'}]},
        ]}]}],
    };
    const draftEtag = (await fetch(`${base}/project/demo/script/${created.scriptId}/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-match': created.etag},
      body: JSON.stringify(draft),
    })).headers.get('etag');

    const usedByDraft = (await listMedia(base))[0].usedBy;
    assert.deepEqual(usedByDraft, [{scriptId: created.scriptId, draft: true}]);

    const published = await fetch(`${base}/project/demo/script/${created.scriptId}/publish`, jsonRequest('POST', {fromDraftEtag: draftEtag}));
    assert.equal(published.status, 201);
    const usedByPublished = (await listMedia(base))[0].usedBy;
    assert.ok(usedByPublished.some((owner) => owner.version === 1 && owner.scriptId === created.scriptId));

    const refusedDelete = await fetch(`${base}/project/demo/media/model-01.wav`, {method: 'DELETE'});
    assert.equal(refusedDelete.status, 409);
    assert.equal((await refusedDelete.json()).code, 'MEDIA_IN_USE');
    const refusedOverwrite = await uploadRaw(base, 'demo', 'model-01.wav', WAV);
    assert.equal(refusedOverwrite.status, 409);

    // A file referenced only by a draft may be deleted; the response names the draft.
    assert.equal((await uploadRaw(base, 'demo', 'cue.wav', WAV)).status, 201);
    const other = await (await fetch(`${base}/project/demo/script`, jsonRequest('POST', {name: 'Draft only'}))).json();
    await fetch(`${base}/project/demo/script/${other.scriptId}/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-match': other.etag},
      body: JSON.stringify({...draft, name: 'Draft only', sections: [{...draft.sections[0],
        groups: [{order: 'SEQUENTIAL', promptItems: [{itemcode: '1', mediaitems: [{mimetype: 'audio/wav', src: 'media/cue.wav'}]}]}]}]}),
    });
    const deleted = await fetch(`${base}/project/demo/media/cue.wav`, {method: 'DELETE'});
    assert.equal(deleted.status, 200);
    const deletion = await deleted.json();
    assert.equal(deletion.deleted, true);
    assert.deepEqual(deletion.usedBy, [{scriptId: other.scriptId, draft: true}]);
    assert.ok(!(await listMedia(base)).some((entry) => entry.src === 'media/cue.wav'));

    // A namespaced file cannot escape the media directory.
    const traversal = await uploadRaw(base, 'demo', '../../evil.wav', WAV);
    assert.equal(traversal.status, 201);
    assert.equal((await traversal.json()).src, 'media/evil.wav');
    assert.ok(existsSync(join(dataDir, 'project', 'demo', 'media', 'evil.wav')));
    assert.ok(!existsSync(join(dataDir, 'evil.wav')));

    // A non-WAV upload has no duration.
    const text = await uploadRaw(base, 'demo', 'note.txt', Buffer.from('hello'), 'text/plain');
    assert.equal(text.status, 201);
    assert.equal((await text.json()).durationMs, null);
  });
});

test('media: multipart upload and a missing X-Filename', async () => {
  await withServer(async ({base}) => {
    const boundary = '----sprTestBoundary';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      WAV,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const multipart = await fetch(`${base}/project/demo/media`, {
      method: 'POST',
      headers: {'content-type': `multipart/form-data; boundary=${boundary}`},
      body,
    });
    assert.equal(multipart.status, 201);
    const uploaded = await multipart.json();
    assert.equal(uploaded.src, 'media/clip.wav');
    assert.equal(uploaded.durationMs, 1000);

    const missingName = await fetch(`${base}/project/demo/media`, {
      method: 'POST',
      headers: {'content-type': 'audio/wav'},
      body: WAV,
    });
    assert.equal(missingName.status, 400);

    const missingFile = await fetch(`${base}/project/demo/media/model-01.wav`, {method: 'DELETE'});
    assert.equal(missingFile.status, 404);
  });
});
