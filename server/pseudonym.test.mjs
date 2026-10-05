/**
 * Speaker pseudonymity (README §8.4, plan 11.4). The switch is a deployment's answer to a
 * data-protection question; these specs pin the behaviour either way, and that the label is stable
 * enough to be useful: the same speaker everywhere, different installations disagreed, and the
 * "already recorded by this speaker" check still doing its job through the label.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {loadOrCreateSalt, pseudonymiseSpeaker} from './pseudonym.mjs';

const freshStore = ({pseudonymiseSpeakers = false, dataDir = null} = {}) => new Store({
  dataDir: dataDir ?? mkdtempSync(join(tmpdir(), 'spr-pseudonym-')),
  seedDir: null,
  log: () => {},
  pseudonymiseSpeakers,
}).open();

test('without the switch the caller id is what the store keeps', () => {
  const store = freshStore();
  const session = store.createSession('s1', {project: 'demo', script: null, speaker: 'sp-13'});
  assert.equal(session.speaker, 'sp-13');
  assert.equal(store.session('s1').speaker, 'sp-13');
});

test('with the switch the same speaker is one stable label everywhere', () => {
  const store = freshStore({pseudonymiseSpeakers: true});
  const first = store.createSession('s1', {project: 'demo', script: null, speaker: 'sp-13'});
  const second = store.createSession('s2', {project: 'demo', script: null, speaker: 'sp-13'});
  const other = store.createSession('s3', {project: 'demo', script: null, speaker: 'sp-14'});

  assert.match(first.speaker, /^sp-[0-9a-f]{12}$/);
  assert.equal(second.speaker, first.speaker, 'the label must be stable for a speaker');
  assert.notEqual(other.speaker, first.speaker, 'different speakers must differ');
  for (const id of ['s1', 's2', 's3']) {
    assert.ok(
      !JSON.stringify(store.session(id)).includes('sp-13') && !JSON.stringify(store.session(id)).includes('sp-14'),
      `the real id must not be written (session ${id})`,
    );
  }
});

test('the label survives a reopen and differs between installations', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'spr-pseudonym-reopen-'));
  const first = freshStore({pseudonymiseSpeakers: true, dataDir}).createSession('s1', {project: 'demo', script: null, speaker: 'sp-13'});
  const reopened = freshStore({pseudonymiseSpeakers: true, dataDir}).createSession('s2', {project: 'demo', script: null, speaker: 'sp-13'});
  assert.equal(reopened.speaker, first.speaker, 'the salt lives in the data directory');

  const elsewhere = freshStore({pseudonymiseSpeakers: true}).createSession('s1', {project: 'demo', script: null, speaker: 'sp-13'});
  assert.notEqual(elsewhere.speaker, first.speaker, 'another installation must not reproduce the label');
});

test('a patched speaker is normalised too', () => {
  const store = freshStore({pseudonymiseSpeakers: true});
  store.createSession('s1', {project: 'demo', script: null, speaker: null});
  const patched = store.patchSession('s1', {speaker: 'sp-13'});
  assert.match(patched.speaker, /^sp-[0-9a-f]{12}$/);
  assert.ok(!JSON.stringify(store.session('s1')).includes('sp-13'));
});

test('the already-recorded check keys on the label, so skipping still works', () => {
  const store = freshStore({pseudonymiseSpeakers: true});
  const label = store.createSession('s1', {project: 'demo', script: null, speaker: 'sp-13'}).speaker;
  // A recording of a drawn bank item, as the upload path writes it.
  mkdirSync(join(store.dataDir, 'recordingfile'), {recursive: true});
  writeFileSync(
    join(store.dataDir, 'recordingfile', '100000001.json'),
    JSON.stringify({recordingFileId: 100000001, session: 's1', project: 'demo', recording: {bankItemId: 'b4'}}),
  );
  assert.deepEqual(
    [...store.recordedBankItemIds({project: 'demo', speaker: label})],
    ['b4'],
    'the recorded set is reachable through the label',
  );
  assert.equal(
    store.recordedBankItemIds({project: 'demo', speaker: 'sp-13'}).size,
    0,
    'the real id must no longer identify a speaker',
  );
});

test('the salt helper is deterministic per directory', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'spr-pseudonym-salt-'));
  const first = loadOrCreateSalt(dataDir);
  assert.equal(loadOrCreateSalt(dataDir), first);
  assert.equal(pseudonymiseSpeaker(first, 'sp-13'), pseudonymiseSpeaker(first, 'sp-13'));
  assert.match(pseudonymiseSpeaker(first, 'sp-13'), /^sp-[0-9a-f]{12}$/);
  assert.equal(pseudonymiseSpeaker(first, null), null);
  assert.equal(pseudonymiseSpeaker(first, '  '), '  ');
});
