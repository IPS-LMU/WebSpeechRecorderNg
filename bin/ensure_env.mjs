#!/usr/bin/env node
/**
 * Preflight for the scripts that build or serve the application (`prebuild`, `prestart`,
 * `prestart_prod`).
 *
 * It refuses to start on an uninstalled `node_modules`. Without that check the compiler does not
 * say "dependencies are missing": with `tslib` and every `@angular/*` import unresolvable, and with
 * the standard libs of TypeScript gone with them, it reports `Cannot find module '@angular/core'`,
 * `Cannot find name 'Object'`, `Cannot find name 'console'` for every file — which reads like a
 * broken source tree instead of an install that never happened.
 *
 * It then creates the untracked `src/environments/environment.prod.ts`: production builds replace
 * `src/environments/environment.ts` with it (see the `fileReplacements` entry of
 * `Cavox:build:production` in angular.json). The file is deployment specific and
 * therefore not tracked by git, so a fresh checkout has none and the build fails before it starts.
 * It is created from the sample when missing and never touched when it exists, so a deployment's
 * own values survive every build.
 */
import {copyFileSync, existsSync} from 'node:fs';

/** Provided by an installed `node_modules` only: the compiler's own standard libs, plus the
 *  packages the application imports. */
const INSTALLED_FILES = [
  'node_modules/typescript/lib/lib.dom.d.ts',
  'node_modules/@angular/core/package.json',
  'node_modules/@angular/material/package.json',
  'node_modules/@jsverse/transloco/package.json',
];

const missing = INSTALLED_FILES.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error(`Dependencies are not installed: ${missing.join(', ')} missing.`);
  console.error('Run `npm ci` first. A build now would report every import and every standard type as unresolvable.');
  process.exit(1);
}

const SAMPLE = 'src/environments/environment.prod.sample.ts';
const TARGET = 'src/environments/environment.prod.ts';

if (existsSync(TARGET)) {
  process.exit(0);
}

if (!existsSync(SAMPLE)) {
  console.error(`${TARGET} is missing and its template ${SAMPLE} is missing too: cannot configure the production build.`);
  process.exit(1);
}

copyFileSync(SAMPLE, TARGET);
console.log(`${TARGET} was missing: created it from ${SAMPLE}.`);
console.log('It is ignored by git: edit it with this deployment\'s API endpoint and options.');
