#!/usr/bin/env node
/**
 * Packaging invariants for the library tarball — the deliverable, which nothing in this repository
 * consumes (the demo imports the library from source), so its shape is only ever checked when
 * somebody looks. Three things cost a consumer a broken build when they are wrong:
 *
 *   1. every path the manifest's public surface names exists in the package — the `exports` map, and
 *      `main`/`module`/`types`. An `exports` map is exhaustive, so a typo here is a subpath nobody
 *      can import, and a missing file behind an entry is a resolution failure at the consumer's end;
 *   2. every external package the shipped bundle imports is declared as a dependency or peer. An
 *      import the manifest does not declare fails at install time for the consumer, not here.
 *
 *   3. the licence travels with the package, declared in the manifest and shipped as a file whose
 *      text matches the repository's. MIT's own condition is that the notice accompanies copies, so
 *      a package without it breaks the licence; and two copies of the text are two chances to edit
 *      one of them.
 *
 * Usage: node bin/package_check.mjs   (after `npm run build_module`)
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const PACKAGE_DIR = 'dist/speechrecorderng';
const problems = [];

if (!existsSync(PACKAGE_DIR)) {
  console.error(`${PACKAGE_DIR} does not exist — run \`npm run build_module\` first.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
const exists = (relative) => existsSync(join(PACKAGE_DIR, relative.replace(/^\.\//, '')));

/** The paths the manifest promises: the exports map (all conditions), and the classic fields. */
const promised = [];
if (manifest.exports && typeof manifest.exports === 'object') {
  const walk = (node, key) => {
    if (typeof node === 'string') {
      promised.push([key, node]);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [condition, value] of Object.entries(node)) {
        walk(value, `${key}[${condition}]`);
      }
    }
  };
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    walk(target, subpath);
  }
}
for (const field of ['main', 'module', 'types', 'typings']) {
  if (typeof manifest[field] === 'string') {
    promised.push([field, manifest[field]]);
  }
}
for (const [key, relative] of promised) {
  if (!exists(relative)) {
    problems.push(`the manifest points ${key} at ${relative}, which the package does not contain`);
  }
}

/** What the shipped code imports, against what the manifest declares. */
const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
  ...Object.keys(manifest.optionalDependencies ?? {}),
]);
const bundleDir = join(PACKAGE_DIR, 'fesm2022');
const imported = new Map();
if (existsSync(bundleDir)) {
  for (const file of readdirSync(bundleDir).filter((name) => name.endsWith('.mjs'))) {
    for (const line of readFileSync(join(bundleDir, file), 'utf8').split('\n')) {
      const match = /^(?:import|export)[^'"]*['"]([^'"]+)['"]/.exec(line.trim());
      if (!match) {
        continue;
      }
      const specifier = match[1];
      if (specifier.startsWith('.') || specifier.startsWith('node:')) {
        continue;
      }
      const name = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0];
      imported.set(name, (imported.get(name) ?? 0) + 1);
    }
  }
}
for (const name of [...imported.keys()].sort()) {
  if (!declared.has(name)) {
    problems.push(`the shipped bundle imports ${name}, which the manifest does not declare`);
  }
}

/** The licence: declared, shipped, and the same text as the repository's copy. */
const REPO_LICENSE = 'LICENSE.txt';
if (typeof manifest.license !== 'string' || manifest.license === '') {
  problems.push('the manifest declares no license, so a consumer cannot tell what they may do with it');
}
const packageLicense = join(PACKAGE_DIR, 'LICENSE');
if (!existsSync(packageLicense)) {
  problems.push(`the package carries no LICENSE — copy the repository's ${REPO_LICENSE} beside the library's `
    + 'package.json (named LICENSE, which is the name the build copies) so the tarball ships it');
} else if (existsSync(REPO_LICENSE)
    && readFileSync(packageLicense, 'utf8') !== readFileSync(REPO_LICENSE, 'utf8')) {
  problems.push(`the package's LICENSE differs from the repository's ${REPO_LICENSE}`);
}

if (problems.length) {
  console.error(`${problems.length} packaging problem(s):`);
  for (const problem of problems) {
    console.error('  ' + problem);
  }
  process.exit(1);
}
console.log(`Package check passed: ${promised.length} promised path(s) present, `
  + `${imported.size} imported package(s) all declared (${[...imported.keys()].sort().join(', ')}), `
  + `licence ${manifest.license}.`);
