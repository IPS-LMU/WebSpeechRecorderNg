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

    const empty = rows.find((entry) => String(entry.scriptId) === '1');
    assert.deepEqual(empty.sessions, {total: 0, started: 0, byVersion: {}});
  }, {seed});
});
