import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateScript} from './validate.mjs';

const item = (overrides = {}) => ({itemcode: '1', mediaitems: [{mimetype: 'text/plain', text: 'x'}], ...overrides});
const script = (items, sectionOverrides = {}) => ({
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, ...sectionOverrides,
    groups: [{order: 'SEQUENTIAL', promptItems: items}]}],
});
const paths = (findings, id) => findings.filter((f) => f.id === id).map((f) => f.path);

test('a clean script has no findings', () => {
  assert.deepEqual(validateScript(script([item(), item({itemcode: '2'})])), []);
});

test('E01 empty itemcode, with the path of the offending item', () => {
  const findings = validateScript(script([item({itemcode: '  '})]));
  assert.deepEqual(paths(findings, 'E01'), ['sections[0].groups[0].promptItems[0].itemcode']);
});

test('E02 duplicate itemcodes across sections point at the second occurrence', () => {
  const duplicated = {
    sections: [
      {mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, groups: [{order: 'SEQUENTIAL', promptItems: [item({itemcode: 'a'})]}]},
      {mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, groups: [{order: 'SEQUENTIAL', promptItems: [item({itemcode: 'a'})]}]},
    ],
  };
  const findings = validateScript(duplicated);
  assert.deepEqual(paths(findings, 'E02'), ['sections[1].groups[0].promptItems[0].itemcode']);
  assert.match(findings.find((f) => f.id === 'E02').message, /sections\[0\]/);
});

test('E06 playback without an audio mediaitem', () => {
  const findings = validateScript(script([item({playback: {when: 'DURING'}})]));
  assert.deepEqual(paths(findings, 'E06'), ['sections[0].groups[0].promptItems[0].playback']);
  assert.deepEqual(validateScript(script([item({playback: {when: 'DURING'}, mediaitems: [{mimetype: 'audio/wav', src: 'media/a.wav'}]})])), []);
});

test('E07 an item that shows nothing and plays nothing', () => {
  const findings = validateScript(script([{itemcode: '1', mediaitems: []}]));
  assert.deepEqual(paths(findings, 'E07'), ['sections[0].groups[0].promptItems[0].mediaitems']);
});

test('E09 timing fields must be non-negative numbers', () => {
  const findings = validateScript(script([item({prerecdelay: -1, recduration: 'x'})]));
  assert.deepEqual(paths(findings, 'E09').sort(), [
    'sections[0].groups[0].promptItems[0].prerecdelay',
    'sections[0].groups[0].promptItems[0].recduration',
  ]);
});

test('E10 needs a section and a section needs a group', () => {
  assert.deepEqual(paths(validateScript({sections: []}), 'E10'), ['sections']);
  assert.deepEqual(paths(validateScript({sections: [{groups: []}]}), 'E10'), ['sections[0].groups']);
});

test('E11 bounds for playback numbers and view boxes', () => {
  const findings = validateScript(script([
    item({playback: {repeats: 0, gap: -5}, defaultVirtualViewBox: undefined,
      mediaitems: [{mimetype: 'text/plain', text: 'x', defaultVirtualViewBox: {height: 0}}]}),
  ], {}));
  assert.deepEqual(paths(findings, 'E11').sort(), [
    'sections[0].groups[0].promptItems[0].mediaitems[0].defaultVirtualViewBox.height',
    'sections[0].groups[0].promptItems[0].playback.gap',
    'sections[0].groups[0].promptItems[0].playback.repeats',
  ]);
  assert.deepEqual(paths(validateScript({sections: [], virtualViewBox: {height: -1}}), 'E11'), ['virtualViewBox.height']);
});
