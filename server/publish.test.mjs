import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withServer, jsonRequest} from './api-harness.mjs';
import {RECORDER_VERSION} from './feature-versions.mjs';

const item = (itemcode, text) => ({itemcode, mediaitems: [{mimetype: 'text/plain', text}]});
const script = (items, name = 'S') => ({
  name,
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
    groups: [{order: 'SEQUENTIAL', promptItems: items}]}],
});

async function createScript(base, name = 'S') {
  const response = await fetch(`${base}/project/demo/script`, jsonRequest('POST', {name}));
  assert.equal(response.status, 201);
  return {etag: response.headers.get('etag'), ...(await response.json())};
}

async function putDraft(base, scriptId, value, etag) {
  const response = await fetch(`${base}/project/demo/script/${scriptId}/draft`, {
    method: 'PUT',
    headers: {'content-type': 'application/json', ...(etag === undefined ? {} : {'if-match': etag})},
    body: JSON.stringify(value),
  });
  assert.equal(response.status, 200);
  return response.headers.get('etag');
}

const publish = (base, scriptId, body) =>
  fetch(`${base}/project/demo/script/${scriptId}/publish`, jsonRequest('POST', body));

test('publish gates on errors, freezes versions and supports restore and duplicate', async () => {
  await withServer(async ({base}) => {
    const created = await createScript(base);
    const {scriptId} = created;

    // A draft with a duplicate itemcode fails the gate and reports the editor's check ids/paths.
    const bad = script([item('a', 'one'), item('a', 'two')]);
    const badEtag = await putDraft(base, scriptId, bad, created.etag);

    const noPrecondition = await publish(base, scriptId, {});
    assert.equal(noPrecondition.status, 428);
    assert.equal((await noPrecondition.json()).code, 'PRECONDITION_REQUIRED');

    const stale = await publish(base, scriptId, {fromDraftEtag: '"stale"'});
    assert.equal(stale.status, 412);
    assert.equal((await stale.json()).code, 'SCRIPT_DRAFT_CONFLICT');

    const rejected = await publish(base, scriptId, {fromDraftEtag: badEtag});
    assert.equal(rejected.status, 409);
    const rejection = await rejected.json();
    assert.equal(rejection.code, 'PUBLISH_REJECTED');
    assert.deepEqual(
      rejection.details.checks.filter((check) => check.id === 'E02').map((check) => check.path),
      ['sections[0].groups[0].promptItems[1].itemcode'],
    );

    // Fix the draft and publish version 1.
    const good = script([item('a', 'one'), item('b', 'two')]);
    const goodEtag = await putDraft(base, scriptId, good, badEtag);
    const first = await publish(base, scriptId, {fromDraftEtag: goodEtag, note: 'first'});
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    assert.equal(firstBody.version, 1);
    assert.equal(firstBody.minRecorderVersion, null);
    assert.match(firstBody.publishedDate, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal((await (await fetch(`${base}/script/${scriptId}`)).json()).sections[0].groups[0].promptItems.length, 2);

    const versions = await (await fetch(`${base}/project/demo/script/${scriptId}/version`)).json();
    assert.equal(versions.length, 1);
    assert.equal(versions[0].version, 1);
    assert.equal(versions[0].note, 'first');
    assert.equal(await (await fetch(`${base}/project/demo/script/${scriptId}/version/1`)).text(), JSON.stringify(good));

    // Publish version 2; the index is newest first and the repo's status turns PUBLISHED.
    const v2 = {...good, name: 'S v2'};
    const v2Etag = await putDraft(base, scriptId, v2, goodEtag);
    const second = await publish(base, scriptId, {fromDraftEtag: v2Etag, note: 'second'});
    assert.equal(second.status, 201);
    assert.equal((await second.json()).version, 2);
    const versions2 = await (await fetch(`${base}/project/demo/script/${scriptId}/version`)).json();
    assert.deepEqual(versions2.map((v) => v.version), [2, 1]);
    const listed = (await (await fetch(`${base}/project/demo/script`)).json()).find((s) => String(s.scriptId) === String(scriptId));
    assert.equal(listed.status, 'PUBLISHED');
    assert.equal(listed.publishedVersion, 2);
    // Publishing v2 adopted its document's name, so the entity carries 'S v2' from here on.
    assert.equal(listed.name, 'S v2');

    // Restore version 1 into the draft (a new draft revision, not a publish).
    const restored = await fetch(`${base}/project/demo/script/${scriptId}/draft/_restore`, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'if-match': v2Etag},
      body: JSON.stringify({version: 1}),
    });
    assert.equal(restored.status, 200);
    assert.equal(await (await fetch(`${base}/project/demo/script/${scriptId}/draft`)).text(), JSON.stringify(good));

    // Duplicate version 1 into a new script, named as a copy.
    const duplicate = await fetch(`${base}/project/demo/script`, jsonRequest('POST', {from: {scriptId, version: 1}}));
    assert.equal(duplicate.status, 201);
    const {scriptId: copyId} = await duplicate.json();
    assert.notEqual(copyId, scriptId);
    assert.equal(await (await fetch(`${base}/project/demo/script/${copyId}/draft`)).text(), JSON.stringify(good));
    const copyEntry = (await (await fetch(`${base}/project/demo/script`)).json()).find((s) => String(s.scriptId) === String(copyId));
    // Named after the source script's current name, which followed its published document ('S v2').
    assert.equal(copyEntry.name, 'S v2 (copy)');
    assert.equal(copyEntry.status, 'DRAFT');
  });
});

test('publish stamps the floor of the features the script uses', async () => {
  await withServer(async ({base}) => {
    const withPrefill = await createScript(base, 'Prefill');
    const prefillItem = {
      itemcode: '1',
      prefill: {source: 'sti-wordlists', select: 'random', itemcodeFormat: '{n}', mediaitems: [{mimetype: 'text/plain', text: '{entry}'}]},
      mediaitems: [{mimetype: 'text/plain', text: '{entry}'}],
    };
    const prefillEtag = await putDraft(base, withPrefill.scriptId, script([prefillItem], 'Prefill'), withPrefill.etag);
    const published = await publish(base, withPrefill.scriptId, {fromDraftEtag: prefillEtag});
    assert.equal(published.status, 201);
    assert.equal((await published.json()).minRecorderVersion, '3.11.26');

    const withPlayback = await createScript(base, 'Playback');
    const playbackItem = {
      itemcode: '1',
      playback: {when: 'DURING', headphones: true},
      mediaitems: [{mimetype: 'audio/wav', src: 'media/a.wav'}],
    };
    const playbackEtag = await putDraft(base, withPlayback.scriptId, script([playbackItem], 'Playback'), withPlayback.etag);
    const played = await publish(base, withPlayback.scriptId, {fromDraftEtag: playbackEtag});
    assert.equal(played.status, 201);
    // The playback modifier ships with the receiver's recorder: a script that uses it needs a
    // recorder at least as new as this one (L4).
    assert.equal((await played.json()).minRecorderVersion, RECORDER_VERSION);
  });
});

test('the published document names the script: the entity follows at publish', async () => {
  await withServer(async ({base}) => {
    const created = await createScript(base, 'First name');
    const {scriptId} = created;
    const listed = async () => {
      const rows = await (await fetch(`${base}/project/demo/script`)).json();
      return rows.find((row) => String(row.scriptId) === String(scriptId));
    };

    // A rename in the editor is a draft edit; the entity keeps the published name until the commit.
    const renamed = {...script([item('a', 'one')]), name: 'Renamed in the editor'};
    const renamedEtag = await putDraft(base, scriptId, renamed, created.etag);
    assert.equal((await listed()).name, 'First name');

    assert.equal((await publish(base, scriptId, {fromDraftEtag: renamedEtag, note: 'renamed'})).status, 201);
    assert.equal((await listed()).name, 'Renamed in the editor');

    // A blank name carries nothing to adopt, so the entity keeps the name it has.
    const blankEtag = await putDraft(base, scriptId, {...script([item('a', 'one')]), name: '   '}, renamedEtag);
    assert.equal((await publish(base, scriptId, {fromDraftEtag: blankEtag})).status, 201);
    assert.equal((await listed()).name, 'Renamed in the editor');
  });
});
