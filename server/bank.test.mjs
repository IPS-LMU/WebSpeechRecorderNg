import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bankIdFor, csvToItems, matchesFilter, queryBank} from './bank.mjs';
import {withServer, jsonRequest} from './api-harness.mjs';

const ITEMS = [
  {bankItemId: 'a1', text: 'Han satte sig på bänken.', category: 'sentence', words: 7, tags: ['balanced', 'read']},
  {bankItemId: 'a2', text: 'Hon målade köket ljusblått.', category: 'sentence', words: 6, tags: ['balanced']},
  {bankItemId: 'a3', text: 'a', category: 'vowel', words: 1, tags: ['prompt'], audioSrc: 'media/a.wav'},
  {bankItemId: 'a4', text: 'Det var en gång en liten stuga.', category: 'passage', words: 9, tags: ['read', 'long']},
  {bankItemId: 'a5', text: 'Katterna sover i solen.', category: 'sentence', words: 6, tags: ['balanced']},
];
const BANK = {bankId: 'b1', title: 'B', source: 'PROJECT', project: 'p1', items: ITEMS};
const bank = (items = ITEMS) => ({...BANK, items});

test('matchesFilter follows the frozen semantics', () => {
  assert.ok(ITEMS.filter((item) => matchesFilter(item, {category: 'sentence'})).length === 3);
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {words: [6, 9]})).map((i) => i.bankItemId), ['a1', 'a2', 'a4', 'a5']);
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {words: [7, 7]})).map((i) => i.bankItemId), ['a1'], 'bounds are inclusive');
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {hasAudio: true})).map((i) => i.bankItemId), ['a3']);
  assert.equal(ITEMS.filter((item) => matchesFilter(item, {hasAudio: false})).length, 4, 'false means without a model recording');
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {tags: ['balanced', 'read']})).map((i) => i.bankItemId), ['a1'], 'tags are ANDed');
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {q: 'BÄNKEN'})).map((i) => i.bankItemId), ['a1'], 'q is case-insensitive');
  assert.deepEqual(ITEMS.filter((item) => matchesFilter(item, {q: 'katterna'})).map((i) => i.bankItemId), ['a5']);
  // A promptDoc item matches q through its plain text.
  const docItem = {bankItemId: 'd1', promptDoc: {body: {blocks: [{type: 'p', texts: [{type: 'text', text: 'Formatted prompt'}]}]}}};
  assert.ok(matchesFilter(docItem, {q: 'formatted'}));
  assert.ok(matchesFilter(docItem, {q: 'prompt'}));
});

test('queryBank reports matchCount and withoutAudio and paginates', () => {
  const all = queryBank(bank(), {}, {limit: 50, offset: 0});
  assert.equal(all.matchCount, 5);
  assert.equal(all.withoutAudio, 4);
  assert.equal(all.items.length, 5);
  const page = queryBank(bank(), {category: 'sentence'}, {limit: 2, offset: 1});
  assert.equal(page.matchCount, 3);
  assert.equal(page.offset, 1);
  assert.deepEqual(page.items.map((i) => i.bankItemId), ['a2', 'a5']);
});

test('csvToItems handles quoting, an optional header and bad rows', () => {
  const csv = 'text,category,words,tags,audio\n'
    + '"Han sade: ""hej"", sedan gick han.",sentence,6,balanced|read,media/x.wav\n'
    + 'a,vowel,1,prompt,\n'
    + ',sentence,3,,\n'
    + 'words bad,sentence,notanumber,,\n';
  const {items, errors} = csvToItems(csv, bank());
  assert.equal(items.length, 2);
  assert.equal(items[0].text, 'Han sade: "hej", sedan gick han.');
  assert.deepEqual(items[0].tags, ['balanced', 'read']);
  assert.equal(items[0].audioSrc, 'media/x.wav');
  assert.equal(items[0].bankItemId, 'item-0001');
  assert.equal(items[1].bankItemId, 'item-0002');
  assert.deepEqual(items[1].tags, ['prompt']);
  assert.deepEqual(errors, [
    {line: 4, message: 'text is required'},
    {line: 5, message: 'words "notanumber" is not a number'},
  ]);
});

test('bankIdFor slugs titles and avoids collisions', () => {
  assert.equal(bankIdFor('Swedish sentences v3'), 'swedish-sentences-v3');
  assert.equal(bankIdFor('!!'), 'bank');
  assert.equal(bankIdFor('Swedish sentences v3', new Set(['swedish-sentences-v3', 'swedish-sentences-v3-2'])), 'swedish-sentences-v3-3');
});

function seedDirWithBanks() {
  const seedDir = mkdtempSync(join(tmpdir(), 'spr-bank-seed-'));
  mkdirSync(join(seedDir, 'bank'), {recursive: true});
  writeFileSync(join(seedDir, 'bank', 'builtin.json'), JSON.stringify({
    bankId: 'builtin', title: 'Builtin', source: 'BUILTIN', shippedWith: '3.12', items: ITEMS,
  }));
  writeFileSync(join(seedDir, 'bank', 'project-one.json'), JSON.stringify({
    bankId: 'project-one', title: 'Project one', source: 'PROJECT', project: 'demo', items: ITEMS.slice(0, 2),
  }));
  return seedDir;
}

test('bank endpoints: list, query, CRUD, builtin read-only, copyFrom, CSV import', async () => {
  await withServer(async ({base}) => {
    const list = await (await fetch(`${base}/project/demo/bank`)).json();
    assert.deepEqual(list.map((b) => b.bankId).sort(), ['builtin', 'project-one']);
    assert.equal(list.find((b) => b.bankId === 'builtin').itemCount, 5);

    // Query with the frozen filter semantics.
    const query = await (await fetch(`${base}/project/demo/bank/project-one/item?category=sentence&minWords=6&maxWords=7&tag=balanced&q=b%C3%A4nken&limit=1&offset=0`)).json();
    assert.equal(query.matchCount, 1);
    assert.equal(query.withoutAudio, 1);
    assert.equal(query.items.length, 1);

    // No limit means the default page, not an empty one.
    const unpaged = await (await fetch(`${base}/project/demo/bank/builtin/item`)).json();
    assert.equal(unpaged.items.length, unpaged.matchCount);

    // Write item(s) to the project bank.
    const created = await (await fetch(`${base}/project/demo/bank/project-one/item`, jsonRequest('POST', {text: 'Ny mening.', category: 'sentence', words: 2, tags: 'demo|short'}))).json();
    assert.equal(created.bankItemId, 'item-0001');
    assert.deepEqual(created.tags, ['demo', 'short']);
    const array = await (await fetch(`${base}/project/demo/bank/project-one/item`, jsonRequest('POST', [{text: 'En till.'}, {text: 'Och en till.'}]))).json();
    assert.equal(array.length, 2);
    const updated = await (await fetch(`${base}/project/demo/bank/project-one/item/${created.bankItemId}`, jsonRequest('PUT', {words: 3}))).json();
    assert.equal(updated.words, 3);
    const afterDelete = await (await fetch(`${base}/project/demo/bank/project-one/item/${created.bankItemId}`, {method: 'DELETE'})).json();
    assert.equal(afterDelete.itemCount, 4);

    // Builtin banks refuse writes.
    const readOnly = await fetch(`${base}/project/demo/bank/builtin/item`, jsonRequest('POST', {text: 'nope'}));
    assert.equal(readOnly.status, 405);
    assert.equal((await readOnly.json()).code, 'BANK_READ_ONLY');

    // Copy a builtin bank into the project.
    const copy = await (await fetch(`${base}/project/demo/bank`, jsonRequest('POST', {copyFrom: 'builtin', title: 'My vowels'}))).json();
    assert.equal(copy.bankId, 'my-vowels');
    assert.equal(copy.source, 'PROJECT');
    assert.equal(copy.project, 'demo');
    assert.equal(copy.copiedFrom, 'builtin');
    assert.equal(copy.copiedFromRelease, '3.12');
    assert.equal(copy.itemCount, 5);

    // CSV import into the copy.
    const csv = 'text,category,words,tags,audio\n"Ett, två",sentence,2,demo,\n,sentence,1,,\n';
    const imported = await (await fetch(`${base}/project/demo/bank/my-vowels/_import`, {
      method: 'POST',
      headers: {'content-type': 'text/csv'},
      body: csv,
    })).json();
    assert.deepEqual(imported, {imported: 1, skipped: 1, errors: [{line: 3, message: 'text is required'}]});
    const after = await (await fetch(`${base}/project/demo/bank/my-vowels`)).json();
    assert.equal(after.itemCount, 6);

    // Another project cannot write this bank.
    const otherProject = await fetch(`${base}/project/other/bank`, jsonRequest('POST', {title: 'X'}));
    assert.equal(otherProject.status, 201);
    const foreign = await fetch(`${base}/project/other/bank/project-one/item`, jsonRequest('POST', {text: 'no'}));
    assert.equal(foreign.status, 403);
  }, {seed: seedDirWithBanks()});
});

test('the shipped builtin bank seeds from src/test and is listed for a project', async () => {
  await withServer(async ({base}) => {
    const list = await (await fetch(`${base}/project/Demo1/bank`)).json();
    const ids = list.map((b) => b.bankId).sort();
    assert.ok(ids.includes('std-passages'), `expected std-passages in ${ids}`);
    assert.ok(ids.includes('demo-sentences'));
    const query = await (await fetch(`${base}/project/Demo1/bank/std-passages/item?category=vowel&hasAudio=true`)).json();
    assert.equal(query.matchCount, 2);
    assert.equal(query.withoutAudio, 0);
  }, {seed: 'src/test'});
});
