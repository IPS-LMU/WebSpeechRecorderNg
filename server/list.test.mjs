/**
 * The library list (rest-api §2.1) is what the editor's first screen renders in REST mode, and the
 * S2 fixtures mirror the same shape for `ApiType.FILES`. This pins the two halves the receiver had
 * been leaving out: the drawn-item count and the per-version session usage.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {withServer} from './api-harness.mjs';

const seed = join(process.cwd(), 'src/test');

test('library list counts fixed and drawn items and how sessions use the versions', async () => {
  await withServer(async ({base, store}) => {
    // `playback.json` ships five fixed items and one drawn group of two (see the M1 fixture).
    const published = store.ensureScriptMeta('playback')?.publishedVersion;
    assert.equal(published, 1);

    const first = store.createSession('list-1', {project: 'Demo1', script: 'playback', type: 'NORM'});
    assert.equal(first.scriptVersion, published, 'a session records the version it was created from');
    store.patchSession('list-1', {status: 'STARTED'});
    store.createSession('list-2', {project: 'Demo1', script: 'playback', type: 'NORM'});
    store.patchSession('list-2', {status: 'COMPLETED'});
    // A preview session is not a run of the script and must not count.
    store.createSession('list-preview', {project: 'Demo1', script: 'playback', type: 'TEST'});
    // Another project's session does not count either.
    store.createSession('list-other', {project: 'Demo2', script: 'playback', type: 'NORM'});

    const rows = await (await fetch(`${base}/project/Demo1/script`)).json();
    const row = rows.find((entry) => String(entry.scriptId) === 'playback');
    assert.ok(row !== undefined, `playback missing from ${JSON.stringify(rows.map((r) => r.scriptId))}`);
    assert.equal(row.sections, 4);
    assert.equal(row.fixedItems, 5, 'the drawn placeholder is not a fixed item');
    assert.equal(row.drawnItems, 2, 'one session draws that many items');
    assert.deepEqual(row.sessions, {total: 2, started: 2, byVersion: {1: 2}});
    assert.equal(row.modifiedBy, null, 'the receiver has no authenticated user to name');
    // ui-spec §2's search reaches itemcodes, so the list carries them: the fixed ones plus the drawn
    // placeholder's prefix, whose real codes are minted per session.
    assert.deepEqual(row.itemcodes, ['D', 'P1', 'P2', 'P3', 'P4', 'P5']);

    // ui-spec §2's name cell reads the sections the script has, in document order.
    const named = rows.find((entry) => String(entry.scriptId) === '1245');
    assert.deepEqual(named.sectionNames, ['Empty section test', 'Recording Session', 'Recording Session',
      'Recording Session', 'Recording Session']);

    const empty = rows.find((entry) => String(entry.scriptId) === '1');
    assert.deepEqual(empty.sessions, {total: 0, started: 0, byVersion: {}});

    // The recorder PATCHes a per-item replay count onto the session as it runs (M1's gate: "the
    // count survives the take"), so a patch must round-trip through the receiver unchanged.
    const patched = await fetch(`${base}/session/list-1`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({replayLog: {P1: 2, D: 1}}),
    });
    assert.equal(patched.status, 200);
    const reread = await (await fetch(`${base}/session/list-1`)).json();
    assert.deepEqual(reread.replayLog, {P1: 2, D: 1}, 'the replay count survives the write');
  }, {seed});
});
