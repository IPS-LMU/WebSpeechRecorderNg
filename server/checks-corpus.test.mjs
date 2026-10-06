/**
 * Runs the shared check corpus in `doc/script-editor/checks/` through the server's catalogue.
 *
 * The corpus is the cross-runtime contract (implementation-plan §10.2): the editor's V1 specs run
 * the same files, so a check that changes on one side alone fails here loudly.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateScript} from './validate.mjs';

const CORPUS_DIR = fileURLToPath(new URL('../doc/script-editor/checks', import.meta.url));
const key = (finding) => `${finding.id}@${finding.path}`;

test('every corpus case matches the server catalogue', () => {
  const files = readdirSync(CORPUS_DIR).filter((name) => name.endsWith('.checks.json')).sort();
  // The file *set* is part of the contract: a renamed or dropped case must fail here, not silently
  // stop being checked. Keep in step with `CORPUS_FILES` in the editor's
  // `projects/spr-script-editor/src/app/core/validation/corpus.ts`.
  const expectedNames = ['bank-count', 'bank-missing', 'bank-prefix-clash', 'clean', 'duplicate-itemcode',
    'empty-item', 'empty-script', 'missing-itemcode', 'negative-timing', 'playback-bounds',
    'playback-without-audio'];
  assert.deepEqual(files.map((name) => name.replace(/\.checks\.json$/, '')),
    [...expectedNames].sort(), 'the corpus file set drifted from the editor\'s CORPUS_FILES');
  for (const file of files) {
    const corpusCase = JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8'));
    const banks = corpusCase.banks ?? {};
    const lookupBank = (bankId) => (Object.prototype.hasOwnProperty.call(banks, bankId) ? banks[bankId] : null);
    const actual = validateScript(corpusCase.draft, {lookupBank}).map(key).sort();
    const expected = corpusCase.expect.map(key).sort();
    assert.deepEqual(actual, expected, `${file}: ${corpusCase.note ?? ''}`);
  }
});
