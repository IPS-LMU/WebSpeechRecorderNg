import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from './store.mjs';

const freshStore = () => new Store({dataDir: mkdtempSync(join(tmpdir(), 'spr-maint-')), seedDir: null, log: () => {}}).open();
const doc = (text = 'x') => ({sections: [{groups: [{promptItems: [{itemcode: '1', mediaitems: [{mimetype: 'text/plain', text}]}]}]}]});

test('migrateLegacyTrees imports flat scripts as version 1 and is idempotent', () => {
  const store = freshStore();
  writeFileSync(store.scriptPath('legacy'), JSON.stringify({name: 'Legacy', sections: [{groups: []}]}));

  assert.deepEqual(store.migrateLegacyTrees(), {scripts: 1, imported: 1});
  assert.equal(store.scriptMeta('legacy').publishedVersion, 1);
  assert.equal(store.version('legacy', 1).name, 'Legacy');
  // The history the editor's panel and `GET …/version` read must agree with `meta.publishedVersion`;
  // the imported document alone is invisible.
  const index = store.versionsIndex('legacy');
  assert.equal(index.length, 1);
  assert.equal(index[0].version, 1);
  assert.ok(typeof index[0].publishedDate === 'string' && index[0].publishedDate !== '');
  assert.deepEqual(store.migrateLegacyTrees(), {scripts: 1, imported: 0});
  assert.equal(store.versionsIndex('legacy').length, 1, 'migrating twice must not duplicate the entry');
});

test('pruneDraftRevisions keeps the newest N and drops aged-out revisions', () => {
  const store = freshStore();
  const created = store.createScript({name: 'S', project: 'demo', value: doc(), text: JSON.stringify(doc())});
  const id = String(created.scriptId);
  for (let i = 0; i < 9; i++) {
    store.writeDraft(id, JSON.stringify({...doc(), n: i}), {...doc(), n: i});
  }
  const revisionsDir = join(store.scriptDir(id), 'revisions');
  assert.equal(readdirSync(revisionsDir).length, 10);

  assert.equal(store.pruneDraftRevisions({keep: 4, maxAgeDays: 3650}).removed, 6);
  assert.equal(readdirSync(revisionsDir).length, 4);
  assert.equal(store.pruneDraftRevisions({keep: 50, maxAgeDays: 0}).removed, 4);
  assert.equal(readdirSync(revisionsDir).length, 0);
});

test('gc removes expired previews with their materialised script and keeps live ones', () => {
  const store = freshStore();
  const created = store.createScript({name: 'P', project: 'demo', value: doc(), text: JSON.stringify(doc())});
  const expired = store.createPreviewSession({project: 'demo', scriptId: String(created.scriptId), version: 'draft', ttlMs: -1000});
  const live = store.createPreviewSession({project: 'demo', scriptId: String(created.scriptId), version: 'draft'});

  assert.deepEqual(store.expiredPreviews().map((entry) => entry.sessionId), [expired.sessionId]);
  const summary = store.gc();
  assert.equal(summary.previewsRemoved, 1);
  assert.equal(store.session(expired.sessionId), null);
  assert.ok(!existsSync(store.scriptPath(String(expired.script))));
  assert.notEqual(store.session(live.sessionId), null);
  assert.ok(existsSync(store.scriptPath(String(live.script))));
});

test('orphanMedia reports only files no draft or published version references', () => {
  const store = freshStore();
  writeFileSync(join(store.dataDir, 'project', 'demo.json'), JSON.stringify({name: 'Demo'}));
  store.ensureMediaDir('demo');
  writeFileSync(store.mediaPath('demo', 'orphan.wav'), Buffer.from('x'));
  writeFileSync(store.mediaPath('demo', 'used.wav'), Buffer.from('x'));
  const referencing = {sections: [{groups: [{promptItems: [{itemcode: '1', mediaitems: [{mimetype: 'audio/wav', src: 'media/used.wav'}]}]}]}]};
  store.createScript({name: 'S', project: 'demo', value: referencing, text: JSON.stringify(referencing)});

  assert.deepEqual(store.orphanMedia().map((entry) => entry.name), ['orphan.wav']);
  const summary = store.gc({media: true});
  assert.equal(summary.orphansFound, 1);
  assert.equal(summary.mediaRemoved, 1);
  assert.ok(!existsSync(store.mediaPath('demo', 'orphan.wav')));
  assert.ok(existsSync(store.mediaPath('demo', 'used.wav')));
});

test('gc defaults to the 50 deep, 30 day retention the runbook documents', () => {
  const store = freshStore();
  const created = store.createScript({name: 'R', project: 'demo', value: doc(), text: JSON.stringify(doc())});
  const id = String(created.scriptId);
  for (let i = 0; i < 60; i++) {
    store.writeDraft(id, JSON.stringify({...doc(), n: i}), {...doc(), n: i});
  }
  const dir = join(store.scriptDir(id), 'revisions');
  const revisions = readdirSync(dir).sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
  assert.equal(revisions.length, 61, 'the create writes one, then sixty drafts');

  // One of the newest carries a date outside the documented window, its neighbour one inside it.
  const day = 24 * 60 * 60 * 1000;
  const aged = revisions[revisions.length - 1];
  const inside = revisions[revisions.length - 2];
  utimesSync(join(dir, aged), new Date(Date.now() - 31 * day), new Date(Date.now() - 31 * day));
  utimesSync(join(dir, inside), new Date(Date.now() - 29 * day), new Date(Date.now() - 29 * day));

  const versionsBefore = store.versionsIndex(id).map((entry) => entry.version);
  const summary = store.gc();

  assert.equal(summary.revisionsRemoved, 12, 'eleven over the documented depth, plus the one out of its window');
  assert.ok(!existsSync(join(dir, aged)), 'a revision older than 30 days goes');
  assert.ok(existsSync(join(dir, inside)), 'a revision inside the window stays');
  assert.ok(readdirSync(dir).length <= 50, 'the runbook documents 50 deep');
  assert.deepEqual(store.versionsIndex(id).map((entry) => entry.version), versionsBefore, 'published versions are never pruned');
});

test('the documented gc commands thread --gc-media through to the store', () => {
  // The store-level tests above call `gc({media})` directly, so the flag the runbook tells an
  // operator to pass was the one part of that promise nothing checked.
  const store = freshStore();
  const created = store.createScript({name: 'M', project: 'demo', value: doc(), text: JSON.stringify(doc())});
  mkdirSync(join(store.dataDir, 'project', 'demo', 'media'), {recursive: true});
  writeFileSync(join(store.dataDir, 'project', 'demo.json'), JSON.stringify({name: 'Demo'}));
  writeFileSync(store.mediaPath('demo', 'orphan.wav'), 'RIFF');
  const run = (...flags) => execFileSync(process.execPath,
    ['server/server.mjs', '--data', store.dataDir, ...flags], {encoding: 'utf8', cwd: process.cwd()});

  const without = run('--gc');
  assert.match(without, /1 orphan media found \(pass --gc-media to remove\)/);
  assert.ok(existsSync(store.mediaPath('demo', 'orphan.wav')), 'without the flag the orphan stays');

  const with_ = run('--gc', '--gc-media');
  assert.match(with_, /1 orphan media found, 1 removed/);
  assert.ok(!existsSync(store.mediaPath('demo', 'orphan.wav')), 'with the flag it goes');
  assert.ok(store.scriptMeta(String(created.scriptId)) !== null, 'and the script itself survives');
});
