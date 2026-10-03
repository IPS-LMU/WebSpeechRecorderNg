/**
 * `GET {base}version` — what the deployment runs (B7).
 *
 * The editor's W10 and N04 compare a script's `minRecorderVersion` against the recorder of the
 * deployment it will run on. Co-deployment means the receiver knows that value exactly
 * (`--recorder-version`), so the editor asks instead of guessing from its own build.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withServer} from './api-harness.mjs';
import {RECORDER_VERSION} from './feature-versions.mjs';

test('version reports the recorder the deployment serves', async () => {
  await withServer(async ({base, store}) => {
    const response = await fetch(`${base}/version`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {recorderVersion: RECORDER_VERSION});
    assert.equal(store.recorderVersion, RECORDER_VERSION);
  });

  // The editor must see the deployment's value, not a constant of its own build.
  await withServer(async ({base}) => {
    assert.deepEqual(await (await fetch(`${base}/version`)).json(), {recorderVersion: '9.9.9'});
  }, {recorderVersion: '9.9.9'});
});
