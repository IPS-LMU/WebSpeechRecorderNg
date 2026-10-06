#!/usr/bin/env node
/**
 * Moves the package tarball `npm pack` wrote inside `dist/speechrecorderng` out to `dist/`, where the
 * release expects it (`npm run pack_pi_module`).
 *
 * It reports what it moved, and fails when it moved nothing: a tarball under another name, or none at
 * all, used to leave the release looking successful with the artifact somewhere else - the script
 * matched what it expected, printed nothing, and exited 0 either way.
 */
const fs = require('fs');

const from = 'dist/speechrecorderng';
if (!fs.existsSync(from)) {
  console.error(`${from} does not exist — run \`npm run build_module\` first.`);
  process.exit(1);
}
const files = fs.readdirSync(from);
const tarballs = files.filter((name) => /^speechrecorderng-.*\.tgz$/.test(name));
if (tarballs.length === 0) {
  console.error(`no speechrecorderng-*.tgz in ${from} — did \`npm pack\` run? `
    + `Files there: ${files.join(', ') || '(none)'}`);
  process.exit(1);
}
for (const name of tarballs) {
  fs.renameSync(`${from}/${name}`, `dist/${name}`);
  console.log(`Moved: ${name}`);
}
