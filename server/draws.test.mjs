import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {withServer, jsonRequest} from './api-harness.mjs';

const ITEMS = [
  {bankItemId: 'b1', text: 'ett', audioSrc: 'media/b1.wav'},
  {bankItemId: 'b2', text: 'två', audioSrc: 'media/b2.wav'},
  {bankItemId: 'b3', text: 'tre', audioSrc: 'media/b3.wav'},
  {bankItemId: 'b4', text: 'fyra', audioSrc: 'media/b4.wav'},
  {bankItemId: 'b5', text: 'fem', audioSrc: 'media/b5.wav'},
];
const BANK = {bankId: 'banky-bank', title: 'Banky', source: 'PROJECT', project: 'demo', items: ITEMS};
const source = (order) => ({bank: 'banky-bank', bankSource: 'PROJECT', count: 3, itemcodePrefix: 'RB', fixedBy: 'SESSION', playBankAudio: true, order});
const banky = (order = 'SEQUENTIAL', name = 'Banky') => ({
  name,
  sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
    groups: [{order: 'SEQUENTIAL', promptItems: [
      {itemcode: 'RB', mediaitems: [{mimetype: 'text/plain', text: 'placeholder'}], prefill: {bank: source(order)}},
    ]}]}],
});
const plain = {name: 'Plain', sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
  groups: [{order: 'SEQUENTIAL', promptItems: [{itemcode: '1', mediaitems: [{mimetype: 'text/plain', text: 'eins'}]}]}]}]};

function seedDir() {
  const dir = mkdtempSync(join(tmpdir(), 'spr-draws-seed-'));
  mkdirSync(join(dir, 'bank'), {recursive: true});
  mkdirSync(join(dir, 'script', 'banky'), {recursive: true});
  writeFileSync(join(dir, 'bank', 'banky-bank.json'), JSON.stringify(BANK));
  writeFileSync(join(dir, 'script', 'banky.json'), JSON.stringify(banky('SEQUENTIAL')));
  writeFileSync(join(dir, 'script', 'banky', 'draft.json'), JSON.stringify(banky('SEQUENTIAL')));
  writeFileSync(join(dir, 'script', 'banky-random.json'), JSON.stringify(banky('RANDOM', 'Banky random')));
  writeFileSync(join(dir, 'script', 'plain.json'), JSON.stringify(plain));
  return dir;
}

test('draw record: session trace, script rows, CSV, redraw and preview exclusion', async () => {
  await withServer(async ({base, store, dataDir}) => {
    store.createSession('s1', {project: 'demo', script: 'banky', type: 'NORM'});
    store.createSession('s2', {project: 'demo', script: 'banky', type: 'NORM', speaker: 'sp2'});

    const trace = await (await fetch(`${base}/project/demo/session/s1/draws`)).json();
    assert.equal(trace.sessionId, 's1');
    assert.equal(trace.script, 'banky');
    assert.equal(trace.redraw, 0);
    assert.deepEqual(trace.prefills, {});
    assert.equal(trace.bankDraws.length, 1);
    assert.deepEqual(trace.bankDraws[0].items.map((item) => item.itemcode), ['RB001', 'RB002', 'RB003']);

    // One row per drawn session, with item codes and a recorded flag.
    const record = await (await fetch(`${base}/project/demo/script/banky/draws`)).json();
    assert.equal(record.total, 2);
    assert.equal(record.rows.length, 2);
    const first = record.rows[0];
    assert.equal(first.sessionId, 's1');
    assert.equal(first.speaker, null);
    assert.equal(first.drawn, 3);
    assert.equal(first.recorded, 0);
    assert.equal(first.preview, false);
    assert.ok(first.items.every((item) => item.recorded === false));

    // A recording marks its item recorded.
    const itemcode = first.items[0].itemcode;
    writeFileSync(join(dataDir, 'recordingfile', '501.json'), JSON.stringify({
      recordingFileId: 501, session: 's1', project: 'demo', recording: {itemcode, bankItemId: first.items[0].bankItemId},
    }));
    const afterRecording = await (await fetch(`${base}/project/demo/script/banky/draws`)).json();
    assert.equal(afterRecording.rows.find((row) => row.sessionId === 's1').recorded, 1);

    // CSV export: one row per drawn item, plus the header.
    const csv = await (await fetch(`${base}/project/demo/script/banky/draws`, {headers: {accept: 'text/csv'}})).text();
    const lines = csv.trim().split('\n');
    assert.equal(lines[0], 'sessionId,speaker,itemcode,bankItemId,recorded');
    assert.equal(lines.length, 1 + 6);
    assert.ok(lines.some((line) => line.startsWith('s1,,RB001,b1,true')), csv);
    assert.ok(lines.some((line) => line.startsWith('s2,sp2,RB003,b3,false')), csv);

    // A preview session is a dry run: excluded by default, visible on request.
    const preview = await (await fetch(`${base}/project/demo/script/banky/preview-session`, jsonRequest('POST', {version: 'draft'}))).json();
    assert.equal((await (await fetch(`${base}/project/demo/script/banky/draws`)).json()).total, 2);
    const withPreview = await (await fetch(`${base}/project/demo/script/banky/draws?includePreview=true`)).json();
    assert.equal(withPreview.total, 3);
    assert.ok(withPreview.rows.some((row) => row.sessionId === preview.sessionId && row.preview === true));

    // Redraw: a new seed (key gains a redraw counter), the trace changes, the session stays.
    store.createSession('r1', {project: 'demo', script: 'banky-random', type: 'NORM'});
    const before = await (await fetch(`${base}/project/demo/session/r1/draws`)).json();
    const redrawn = await (await fetch(`${base}/project/demo/session/r1/draws/_redraw`, jsonRequest('POST', {}))).json();
    assert.equal(redrawn.redraw, 1);
    assert.equal(redrawn.bankDraws[0].key, 'session:r1#1');
    assert.equal(new Set(redrawn.bankDraws[0].items.map((item) => item.bankItemId)).size, 3, 'three distinct items');
    assert.notEqual(redrawn.bankDraws[0].key, before.bankDraws[0].key);
    const again = await (await fetch(`${base}/project/demo/session/r1/draws/_redraw`, jsonRequest('POST', {}))).json();
    assert.equal(again.bankDraws[0].key, 'session:r1#2');

    // A started session keeps its draw.
    store.patchSession('r1', {status: 'STARTED'});
    const started = await fetch(`${base}/project/demo/session/r1/draws/_redraw`, jsonRequest('POST', {}));
    assert.equal(started.status, 409);
    assert.equal((await started.json()).code, 'SESSION_ALREADY_STARTED');

    // A script without bank sources cannot be redrawn.
    store.createSession('p1', {project: 'demo', script: 'plain', type: 'NORM'});
    const noSources = await fetch(`${base}/project/demo/session/p1/draws/_redraw`, jsonRequest('POST', {}));
    assert.equal(noSources.status, 409);
    assert.equal((await noSources.json()).code, 'NO_BANK_SOURCES');
  }, {seed: seedDir()});
});
