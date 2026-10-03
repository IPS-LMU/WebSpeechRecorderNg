import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withServer} from './api-harness.mjs';
import {Store} from './store.mjs';
import {FEATURE_VERSIONS, RECORDER_VERSION, compareVersions, featuresUsed, minRecorderVersionFor, supportsRecorderVersion} from './feature-versions.mjs';

test('compareVersions is numeric per segment, not lexicographic', () => {
  assert.ok(compareVersions('3.10', '3.9') > 0);
  assert.ok(compareVersions('3.9', '3.10') < 0);
  assert.equal(compareVersions('3.12', '3.12.0'), 0);
  assert.ok(compareVersions('3.12.0-rc1', '3.12.0') < 0);
  assert.ok(compareVersions('3.12.0', '3.12.0-rc1') > 0);
  assert.ok(compareVersions('3.12', '3.11.26') > 0);
});

const withItem = (item) => ({sections: [{groups: [{promptItems: [item]}]}]});

test('featuresUsed finds prefill and playback modifiers', () => {
  assert.deepEqual(featuresUsed(withItem({itemcode: '1'})), []);
  assert.deepEqual(featuresUsed(withItem({itemcode: '1', prefill: {source: 'x'}})), ['prefill']);
  assert.deepEqual(featuresUsed(withItem({itemcode: '1', prefill: {source: 'x'}, playback: {when: 'DURING'}})), ['playback', 'prefill']);
});

test('minRecorderVersionFor maps known features and reports unknown ones', () => {
  const prefill = minRecorderVersionFor(withItem({itemcode: '1', prefill: {source: 'x'}}));
  assert.equal(prefill.minRecorderVersion, '3.11.26');
  assert.deepEqual(prefill.unknownFeatures, []);

  const playback = minRecorderVersionFor(withItem({itemcode: '1', playback: {when: 'DURING'}}));
  assert.equal(playback.minRecorderVersion, RECORDER_VERSION);
  assert.deepEqual(playback.unknownFeatures, []);

  const mixed = minRecorderVersionFor(withItem({itemcode: '1', prefill: {source: 'x'}, playback: {when: 'DURING'}}));
  assert.equal(mixed.minRecorderVersion, compareVersions(RECORDER_VERSION, '3.11.26') >= 0 ? RECORDER_VERSION : '3.11.26');
  assert.deepEqual(mixed.unknownFeatures, []);
});

test('every feature the detector reports has a floor in the table', () => {
  // Publish refuses a script whose feature has no entry; a new feature must be added to
  // FEATURE_VERSIONS in the same change, or no script using it can be published.
  const maximal = withItem({itemcode: '1', prefill: {source: 'x'}, playback: {when: 'DURING'}});
  assert.deepEqual(minRecorderVersionFor(maximal).unknownFeatures, [], 'add the feature to FEATURE_VERSIONS');
  assert.deepEqual(featuresUsed(maximal).filter((feature) => FEATURE_VERSIONS[feature] === undefined), []);
});

test('supportsRecorderVersion compares the floor against the running recorder', () => {
  assert.equal(supportsRecorderVersion(null), true);
  assert.equal(supportsRecorderVersion(undefined), true);
  assert.equal(supportsRecorderVersion(RECORDER_VERSION), true);
  assert.equal(supportsRecorderVersion('3.0.0'), true);
  assert.equal(supportsRecorderVersion('99.0.0'), false);
  assert.equal(supportsRecorderVersion('99.0.0', '99.0.0'), true);
});

test('session creation refuses a script that needs a newer recorder (L4/C8)', async () => {
  const seed = mkdtempSync(join(tmpdir(), 'spr-version-seed-'));
  mkdirSync(join(seed, 'script'), {recursive: true});
  writeFileSync(join(seed, 'script', 'future.json'), JSON.stringify({minRecorderVersion: '99.0.0', sections: []}));
  writeFileSync(join(seed, 'script', 'plain.json'), JSON.stringify({sections: []}));
  await withServer(async ({store, dataDir}) => {
    assert.equal(store.createSession('ok', {project: 'demo', script: 'plain', type: 'NORM'}).script, 'plain');
    assert.throws(() => store.createSession('old', {project: 'demo', script: 'future', type: 'NORM'}), (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, 'RECORDER_VERSION_TOO_OLD');
      assert.deepEqual(err.details, {required: '99.0.0', actual: RECORDER_VERSION});
      return true;
    });

    // A receiver that reports the newer version serves it (--recorder-version).
    const newer = new Store({dataDir, seedDir: seed, log: () => {}, recorderVersion: '99.0.0'}).open();
    assert.equal(newer.createSession('old-ok', {project: 'demo', script: 'future', type: 'NORM'}).script, 'future');
  }, {seed});
});
