import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions, featuresUsed, minRecorderVersionFor} from './feature-versions.mjs';

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
  assert.equal(playback.minRecorderVersion, null);
  assert.deepEqual(playback.unknownFeatures, ['playback']);

  const mixed = minRecorderVersionFor(withItem({itemcode: '1', prefill: {source: 'x'}, playback: {when: 'DURING'}}));
  assert.equal(mixed.minRecorderVersion, '3.11.26');
  assert.deepEqual(mixed.unknownFeatures, ['playback']);
});
