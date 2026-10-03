/**
 * The version gate (L4): the comparator, the feature table and the runnable check.
 *
 * The same cases live in `server/feature-versions.test.mjs`, because the server keeps its own copy
 * of the table and re-checks the gate when a session is created (C8).
 */
import {VERSION} from '../../spr.module.version';
import {FEATURE_VERSIONS, compareVersions, featuresUsed, minRecorderVersionFor, supportsRecorderVersion} from './feature-versions';
import {PromptItem, Script} from './script';

const scriptOf = (item: Partial<PromptItem>, overrides: Partial<Script> = {}): Script => ({
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
    groups: [{order: 'SEQUENTIAL', promptItems: [{itemcode: '1', mediaitems: [{mimetype: 'text/plain', text: 'x'}], ...item}], _shuffledPromptItems: []}],
    _shuffledGroups: []}],
  ...overrides,
});

describe('feature versions', () => {
  it('compares numeric segments, not strings', () => {
    expect(compareVersions('3.10', '3.9')).toBeGreaterThan(0);
    expect(compareVersions('3.9', '3.10')).toBeLessThan(0);
    expect(compareVersions('3.12', '3.12.0')).toBe(0);
    expect(compareVersions('3.12.0-rc1', '3.12.0')).toBeLessThan(0);
    expect(compareVersions('3.12.0', '3.12.0-rc1')).toBeGreaterThan(0);
    expect(compareVersions('3.12', '3.11.26')).toBeGreaterThan(0);
  });

  it('finds the features a script uses', () => {
    expect(featuresUsed(scriptOf({}))).toEqual([]);
    expect(featuresUsed(scriptOf({prefill: {source: 'list'}}))).toEqual(['prefill']);
    expect(featuresUsed(scriptOf({prefill: {source: 'list'}, playback: {when: 'DURING'}}))).toEqual(['playback', 'prefill']);
  });

  it('reports the floor the features imply', () => {
    expect(minRecorderVersionFor(scriptOf({}))).toBeNull();
    expect(minRecorderVersionFor(scriptOf({prefill: {source: 'list'}}))).toBe('3.11.26');
    expect(minRecorderVersionFor(scriptOf({playback: {when: 'DURING'}}))).toBe(VERSION);
    expect(minRecorderVersionFor(scriptOf({prefill: {source: 'list'}, playback: {when: 'DURING'}})))
      .toBe(compareVersions(VERSION, '3.11.26') >= 0 ? VERSION : '3.11.26');
    expect(FEATURE_VERSIONS['playback']).toBe(VERSION);
  });

  it('runs anything at or above its floor, and refuses what is newer', () => {
    expect(supportsRecorderVersion(scriptOf({}), '1.0')).toBe(true);
    expect(supportsRecorderVersion(scriptOf({playback: {when: 'DURING'}}), VERSION)).toBe(true);
    expect(supportsRecorderVersion(scriptOf({playback: {when: 'DURING'}}), '3.0.0')).toBe(false);
    expect(supportsRecorderVersion(scriptOf({}, {minRecorderVersion: '9.9.9'}), VERSION)).toBe(false);
    // A declared floor wins over the computed one.
    expect(supportsRecorderVersion(scriptOf({playback: {when: 'DURING'}}, {minRecorderVersion: '1.0.0'}), '1.0.0')).toBe(true);
  });
});
