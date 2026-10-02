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
  assert.ok(files.length >= 5, `corpus is too small: ${files.length} case(s)`);
  for (const file of files) {
    const corpusCase = JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8'));
    const actual = validateScript(corpusCase.draft).map(key).sort();
    const expected = corpusCase.expect.map(key).sort();
    assert.deepEqual(actual, expected, `${file}: ${corpusCase.note ?? ''}`);
  }
});
