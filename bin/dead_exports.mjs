#!/usr/bin/env node
/**
 * Dead-export check for the trees this project owns outright: the editor and the receiver.
 *
 * Module 2 of `getting-things-done` in the plan's own terms (§11.28): an exported symbol that no other
 * non-test file names, and that its own file does not use beyond the declaration, is dead weight -
 * either wired up or deleted. Four such symbols were found by hand this way (`BankStrings`,
 * `DrawsStrings`, `ServerCheck` in the editor; `checkIfMatch` in the receiver, which the API should
 * have been calling all along), so the check is a script rather than a habit.
 *
 * The recorder library is deliberately not scanned: it is upstream code this work does not own, and
 * `public-api.ts` makes many of its exports reachable for consumers rather than callers.
 *
 * Usage: node bin/dead_exports.mjs [--verbose]
 */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const VERBOSE = process.argv.includes('--verbose');

/**
 * Files whose exports exist for the specs: the shared check corpus and its helpers are used by
 * `*.spec.ts` only, by design (the plan's D-T corpus), and the receiver's `api-harness.mjs` says what
 * it is in its own header — a test helper that is not a test file, because Node's runner only
 * collects `*.test.*`. Everything else must be named by production code or go.
 */
const TEST_INFRASTRUCTURE = new Set([
  'app/core/validation/corpus.ts',
  'app/core/validation/test-helpers.ts',
  'server/api-harness.mjs',
]);

const ROOTS = [
  {dir: 'projects/spr-script-editor/src', strip: 'projects/spr-script-editor/src/', api: null},
  {dir: 'server', strip: '', api: null},
];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'data') {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (/\.(ts|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }
};
for (const root of ROOTS) {
  walk(root.dir);
}

const source = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
const isSpec = (file) => /\.spec\.ts$/.test(file) || /\.test\.mjs$/.test(file);

const exported = [];
for (const [file, text] of source) {
  if (isSpec(file)) {
    continue;
  }
  for (const match of text.matchAll(/export\s+(?:abstract\s+)?(?:const|function|class|interface|type|enum|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    exported.push({file, name: match[1]});
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/g)) {
    exported.push({file, name: match[1]});
  }
}

const dead = [];
for (const {file, name} of exported) {
  if (TEST_INFRASTRUCTURE.has(file.replace('projects/spr-script-editor/src/', ''))) {
    continue;
  }
  const pattern = new RegExp(`\\b${name}\\b`);
  let namedInProduction = false;
  for (const [other, text] of source) {
    if (other === file || isSpec(other)) {
      continue;
    }
    if (pattern.test(text)) {
      namedInProduction = true;
      break;
    }
  }
  const ownReferences = source.get(file).split(name).length - 1;
  if (!namedInProduction && ownReferences <= 1) {
    dead.push({file, name, ownReferences});
  }
}

if (VERBOSE) {
  console.log(`scanned ${exported.length} exported symbols in ${source.size} files`);
}
if (dead.length === 0) {
  console.log(`Dead-export check passed: ${exported.length} export(s) scanned, none unreferenced.`);
  process.exit(0);
}
console.error(`\n${dead.length} exported symbol(s) no production file names:`);
for (const {file, name} of dead) {
  console.error(`  ${file} :: ${name}`);
}
console.error('\nWire each one up or delete it (and its spec), or add it to TEST_INFRASTRUCTURE in this');
console.error('script with a reason, if it exists for the specs.');
process.exit(1);
