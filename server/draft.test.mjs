import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {withServer, jsonRequest} from './api-harness.mjs';

test('draft lifecycle: create, ETag, 428, 412, byte-preserving writes, revisions', async () => {
  await withServer(async ({base, store, dataDir}) => {
    const created = await fetch(`${base}/project/demo/script`, jsonRequest('POST', {name: 'Test script'}));
    assert.equal(created.status, 201);
    const etag1 = created.headers.get('etag');
    assert.match(etag1, /^"[0-9a-f]{64}"$/);
    const {scriptId} = await created.json();
    assert.ok(scriptId);

    const list = await (await fetch(`${base}/project/demo/script`)).json();
    const entry = list.find((s) => String(s.scriptId) === String(scriptId));
    assert.equal(entry.name, 'Test script');
    assert.equal(entry.status, 'DRAFT');
    assert.equal(entry.sections, 1);
    assert.equal(entry.fixedItems, 1);

    const first = await fetch(`${base}/project/demo/script/${scriptId}/draft`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('etag'), etag1);
    assert.equal((await first.json()).name, 'Test script');

    const noPrecondition = await fetch(`${base}/project/demo/script/${scriptId}/draft`, jsonRequest('PUT', {sections: []}));
    assert.equal(noPrecondition.status, 428);
    assert.equal((await noPrecondition.json()).code, 'PRECONDITION_REQUIRED');

    const stale = await fetch(`${base}/project/demo/script/${scriptId}/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-match': '"not-the-one"'},
      body: '{"sections":[]}',
    });
    assert.equal(stale.status, 412);
    const conflict = await stale.json();
    assert.equal(conflict.code, 'SCRIPT_DRAFT_CONFLICT');
    assert.equal(conflict.details.currentEtag, etag1);
    assert.equal(conflict.details.current.name, 'Test script');

    // Deliberately unformatted and unknown-keyed: the stored bytes must come back unchanged.
    const draft = '{"z":1,"name":"Test script","sections":[],"futureField":{"deep":[1,2,3]}}';
    const written = await fetch(`${base}/project/demo/script/${scriptId}/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-match': etag1},
      body: draft,
    });
    assert.equal(written.status, 200);
    const etag2 = written.headers.get('etag');
    assert.notEqual(etag2, etag1);

    const reread = await fetch(`${base}/project/demo/script/${scriptId}/draft`);
    assert.equal(await reread.text(), draft);
    assert.equal(reread.headers.get('etag'), etag2);

    const again = await fetch(`${base}/project/demo/script/${scriptId}/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-match': etag2},
      body: draft,
    });
    assert.equal(again.status, 200);
    assert.equal(again.headers.get('etag'), etag2, 'an identical body is idempotent');

    const revisions = readdirSync(join(dataDir, 'script', String(scriptId), 'revisions'));
    assert.equal(revisions.length, 3, 'every accepted write is snapshotted');
    assert.equal(store.scriptMeta(String(scriptId)).draftVersion, 3);

    const unpublished = await fetch(`${base}/script/${scriptId}`);
    assert.equal(unpublished.status, 404, 'nothing is published yet');

    const patched = await fetch(`${base}/project/demo/script/${scriptId}`, jsonRequest('PATCH', {name: 'Renamed', archived: true}));
    assert.equal(patched.status, 200);
    const after = await (await fetch(`${base}/project/demo/script`)).json();
    assert.equal(after.find((s) => String(s.scriptId) === String(scriptId)).status, 'ARCHIVED');
  });
});

test('a legacy flat script is readable and gets its first draft via If-None-Match: *', async () => {
  await withServer(async ({base, dataDir}) => {
    writeFileSync(join(dataDir, 'script', 'legacy.json'), JSON.stringify({
      type: 'script',
      scriptId: 99,
      name: 'Legacy',
      sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, groups: []}],
    }));

    const read = await fetch(`${base}/script/legacy`);
    assert.equal(read.status, 200);
    assert.equal((await read.json()).name, 'Legacy');

    const noDraft = await fetch(`${base}/project/demo/script/legacy/draft`);
    assert.equal(noDraft.status, 404);

    const created = await fetch(`${base}/project/demo/script/legacy/draft`, {
      method: 'PUT',
      headers: {'content-type': 'application/json', 'if-none-match': '*'},
      body: '{"name":"Legacy","sections":[]}',
    });
    assert.equal(created.status, 200);
    assert.match(created.headers.get('etag'), /^"[0-9a-f]{64}"$/);
  });
});
