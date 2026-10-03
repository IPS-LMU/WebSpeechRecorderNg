import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bankSourcesOf, chooseItems, drawKey, generateItems, randomFrom, resolveBankSources, seedFrom} from './draw.mjs';
import {withServer} from './api-harness.mjs';

const ITEMS = [
  {bankItemId: 'b1', text: 'ett', audioSrc: 'media/b1.wav', audioMimetype: 'audio/wav'},
  {bankItemId: 'b2', text: 'två', audioSrc: 'media/b2.wav', audioMimetype: 'audio/wav'},
  {bankItemId: 'b3', text: 'tre', audioSrc: 'media/b3.wav', audioMimetype: 'audio/wav'},
  {bankItemId: 'b4', text: 'fyra', audioSrc: 'media/b4.wav', audioMimetype: 'audio/wav'},
  {bankItemId: 'b5', text: 'fem', audioSrc: 'media/b5.wav', audioMimetype: 'audio/wav'},
];
const BANK = {bankId: 'banky-bank', source: 'PROJECT', project: 'demo', items: ITEMS};
const SOURCE = {bank: 'banky-bank', bankSource: 'PROJECT', count: 3, itemcodePrefix: 'RB', fixedBy: 'SESSION', playBankAudio: true, itemDefaults: {prerecdelay: 500, recduration: 8000}};

const withBankSource = (overrides = {}) => ({
  name: 'Banky',
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
    groups: [{order: 'SEQUENTIAL', promptItems: [
      {itemcode: 'RB', mediaitems: [{mimetype: 'text/plain', text: 'placeholder'}],
        prefill: {bank: {...SOURCE, ...overrides}}},
    ]}]}],
});

test('bankSourcesOf finds the placeholder and its position', () => {
  const found = bankSourcesOf(withBankSource());
  assert.deepEqual(found.map(({sectionIdx, groupIdx, itemIdx, itemcode}) => ({sectionIdx, groupIdx, itemIdx, itemcode})),
    [{sectionIdx: 0, groupIdx: 0, itemIdx: 0, itemcode: 'RB'}]);
  assert.deepEqual(bankSourcesOf({sections: [{groups: [{promptItems: [{itemcode: 'x'}]}]}]}), []);
});

test('the PRNG is deterministic and key-sensitive', () => {
  assert.equal(seedFrom('a', 'b'), seedFrom('a', 'b'));
  assert.notEqual(seedFrom('a', 'b'), seedFrom('a', 'c'));
  const first = Array.from({length: 5}, randomFrom(seedFrom('k')));
  const again = Array.from({length: 5}, randomFrom(seedFrom('k')));
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, Array.from({length: 5}, randomFrom(seedFrom('other'))));
});

test('drawKey distinguishes the three fixings and the speaker fallback', () => {
  assert.equal(drawKey('SESSION', {sessionId: 's1'}), 'session:s1');
  assert.equal(drawKey(undefined, {sessionId: 's1'}), 'session:s1');
  assert.equal(drawKey('SPEAKER', {sessionId: 's1', speaker: 'sp1'}), 'speaker:sp1');
  assert.equal(drawKey('SPEAKER', {sessionId: 's1', speaker: null}), 'speaker:s1');
  assert.equal(drawKey('SCRIPT', {sessionId: 's1', scriptId: 1245, scriptVersion: 3}), 'script:1245@3');
});

test('chooseItems filters, excludes, refills and honours SEQUENTIAL', () => {
  const random = randomFrom(seedFrom('choose'));
  const sequential = chooseItems({bank: BANK, source: {...SOURCE, order: 'SEQUENTIAL'}, random});
  assert.deepEqual(sequential.chosen.map((i) => i.bankItemId), ['b1', 'b2', 'b3']);
  assert.equal(sequential.refilled, false);

  const excluded = new Set(['b2', 'b3', 'b4', 'b5']);
  const {chosen, refilled} = chooseItems({bank: BANK, source: {...SOURCE, order: 'SEQUENTIAL'}, excluded, random});
  assert.deepEqual(chosen.map((i) => i.bankItemId), ['b1', 'b2', 'b3'], 'refills from the skipped items');
  assert.equal(refilled, true);

  const filtered = chooseItems({bank: BANK, source: {...SOURCE, count: 2, filter: {q: 'fem'}}, random});
  assert.deepEqual(filtered.chosen.map((i) => i.bankItemId), ['b5']);
  assert.equal(filtered.refilled, false, 'a filter that matches fewer items than count does not refill');
});

test('generateItems builds prompt items with padded codes, audio and defaults', () => {
  const generated = generateItems({source: SOURCE, chosen: ITEMS.slice(0, 2)});
  assert.deepEqual(generated.map((item) => item.itemcode), ['RB001', 'RB002']);
  assert.deepEqual(generated[0].mediaitems, [
    {mimetype: 'text/plain', text: 'ett'},
    {mimetype: 'audio/wav', src: 'media/b1.wav'},
  ]);
  assert.equal(generated[0].bankItemId, 'b1');
  assert.equal(generated[0].prerecdelay, 500);
  assert.equal(generated[0].recduration, 8000);
  assert.equal(generated[0].playback, undefined, 'no playback unless the source sets one');
  const withPlayback = generateItems({source: {...SOURCE, playback: {when: 'DURING', headphones: true}}, chosen: ITEMS.slice(0, 1)});
  assert.deepEqual(withPlayback[0].playback, {when: 'DURING', headphones: true});
});

test('resolveBankSources replaces the placeholder and reports the trace', () => {
  const {script, trace} = resolveBankSources(withBankSource({order: 'SEQUENTIAL'}), {
    lookupBank: () => BANK,
    sessionId: 's1',
    scriptId: 7,
    scriptVersion: 2,
  });
  const items = script.sections[0].groups[0].promptItems;
  assert.deepEqual(items.map((item) => item.itemcode), ['RB001', 'RB002', 'RB003']);
  assert.deepEqual(items[0].mediaitems[1], {mimetype: 'audio/wav', src: 'media/b1.wav'});
  assert.equal(items.length, 3, 'the placeholder is replaced, not kept');
  assert.equal(trace.length, 1);
  assert.deepEqual(trace[0].items, [
    {itemcode: 'RB001', bankItemId: 'b1'},
    {itemcode: 'RB002', bankItemId: 'b2'},
    {itemcode: 'RB003', bankItemId: 'b3'},
  ]);
  assert.equal(trace[0].key, 'session:s1');
  assert.equal(trace[0].speakerFallback, false);
  assert.equal(trace[0].drawnForVersion, 2);

  const fallback = resolveBankSources(withBankSource({fixedBy: 'SPEAKER'}), {lookupBank: () => BANK, sessionId: 's1'});
  assert.equal(fallback.trace[0].speakerFallback, true);
  assert.equal(fallback.trace[0].key, 'speaker:s1');

  assert.throws(() => resolveBankSources(withBankSource(), {lookupBank: () => null, sessionId: 's1'}), /bank banky-bank does not exist/);
  assert.equal(resolveBankSources({sections: []}, {lookupBank: () => BANK, sessionId: 's1'}).trace, null);
});

function seedDir() {
  const dir = mkdtempSync(join(tmpdir(), 'spr-draw-seed-'));
  mkdirSync(join(dir, 'bank'), {recursive: true});
  mkdirSync(join(dir, 'script'), {recursive: true});
  writeFileSync(join(dir, 'bank', 'banky-bank.json'), JSON.stringify(BANK));
  writeFileSync(join(dir, 'script', 'banky.json'), JSON.stringify(withBankSource({order: 'SEQUENTIAL'})));
  writeFileSync(join(dir, 'script', 'banky-skip.json'), JSON.stringify(withBankSource({order: 'SEQUENTIAL', skipRecordedBySpeaker: true})));
  return dir;
}

test('session creation resolves bank sources into the materialised script', async () => {
  await withServer(async ({base, store, dataDir}) => {
    const session = store.createSession('s1', {project: 'demo', script: 'banky', type: 'NORM'});
    assert.match(String(session.script), /^sess-s1$/);
    assert.equal(session.scriptSource, 'banky');
    assert.equal(session.bankDraws.length, 1);
    assert.equal(session.bankDraws[0].refilled, false);

    // The recorder reads Session.script and gets the generated items.
    const served = await (await fetch(`${base}/script/${session.script}`)).json();
    assert.equal(served.internal, true);
    assert.equal(served.materialisedFor, 's1');
    const items = served.sections[0].groups[0].promptItems;
    assert.deepEqual(items.map((item) => item.itemcode), ['RB001', 'RB002', 'RB003']);
    assert.ok(items.every((item) => typeof item.bankItemId === 'string'));
    assert.ok(items.every((item) => item.mediaitems.length === 2));

    // The draw is stable: resolving the same session again gives the same trace.
    const first = store.resolveSessionDraws(store.session('s1'));
    const second = store.resolveSessionDraws(store.session('s1'));
    assert.deepEqual(first.bankDraws, second.bankDraws);

    // A speaker's earlier recordings are skipped, and the refill is recorded when they dry up.
    store.createSession('sp1-session', {project: 'demo', script: 'banky', type: 'NORM', speaker: 'sp1'});
    ITEMS.forEach((item, index) => {
      writeFileSync(join(dataDir, 'recordingfile', `900${index}.json`), JSON.stringify({
        recordingFileId: 900 + index,
        session: 'sp1-session',
        project: 'demo',
        recording: {itemcode: `RB00${index + 1}`, bankItemId: item.bankItemId},
      }));
    });
    const skipped = store.createSession('s3', {project: 'demo', script: 'banky-skip', type: 'NORM', speaker: 'sp1'});
    assert.equal(skipped.bankDraws[0].skippedRecorded, true);
    assert.equal(skipped.bankDraws[0].refilled, true, 'all items were recorded before, so it refilled');
    assert.equal(skipped.bankDraws[0].items.length, 3);

    // Without a speaker the session seed is used, and the trace says so.
    const fallback = store.createSession('s4', {project: 'demo', script: 'banky', type: 'NORM'});
    assert.equal(fallback.bankDraws[0].key, 'session:s4');
  }, {seed: seedDir()});
});
