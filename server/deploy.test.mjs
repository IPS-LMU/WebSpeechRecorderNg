/**
 * The documented deployment shape, asserted (README §4.5): `bin/serve_deploy.mjs` puts the recorder
 * under `/wsr/ng/` and the editor under `/wsr/edit/` with one API beside them, each app behind a path
 * prefix with the SPA fallback. The receiver serves a single application at the root, so this is the
 * only place the sub-path contract — base hrefs, assets, deep links, the API proxy — is exercised,
 * and until now nothing ran it: the rehearsal was a manual command.
 *
 * The test uses its own fixture directories, so it needs no build; the mounts' defaults (the built
 * bundles) are what the manual rehearsal uses.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(HERE, '..');

const writeApp = (dir, marker) => {
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'index.html'), `<!doctype html><title>${marker}</title><p>${marker}</p>`);
  writeFileSync(join(dir, 'chunk-abc.js'), `window.__app = '${marker}';`);
  writeFileSync(join(dir, 'theme.css'), 'html { color: #123456 }');
};

const waitFor = async (url, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

test('the deployment harness serves both mounts, their fallback and the API', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spr-deploy-'));
  const recorder = join(root, 'recorder');
  const editor = join(root, 'editor');
  const data = join(root, 'data');
  writeApp(recorder, 'recorder shell');
  writeApp(editor, 'editor shell');
  const port = 8481;
  const apiPort = 8482;

  const receiver = spawn(process.execPath, ['server/server.mjs', '--port', String(apiPort), '--data', data,
    '--seed', 'src/test', '--app', 'none', '--project', 'Demo1', '--script', 'playback', '--quiet'],
  {cwd: REPO, stdio: 'ignore'});
  const harness = spawn(process.execPath, ['bin/serve_deploy.mjs', '--port', String(port),
    '--api', `http://127.0.0.1:${apiPort}`, '--recorder', recorder, '--editor', editor],
  {cwd: REPO, stdio: 'ignore'});

  const stop = () => {
    receiver.kill();
    harness.kill();
    rmSync(root, {recursive: true, force: true});
  };

  try {
    assert.ok(await waitFor(`http://127.0.0.1:${apiPort}/api/v1/version`), 'receiver did not start');
    assert.ok(await waitFor(`http://127.0.0.1:${port}/wsr/edit/`), 'harness did not start');

    const get = async (path) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {redirect: 'manual'});
      return {status: response.status, type: response.headers.get('content-type') ?? '', text: await response.text()};
    };

    // 1. Each mount serves its own shell at the prefix, and with the right type.
    const editorRoot = await get('/wsr/edit/');
    assert.equal(editorRoot.status, 200);
    assert.match(editorRoot.type, /text\/html/);
    assert.match(editorRoot.text, /editor shell/);
    const recorderRoot = await get('/wsr/ng/');
    assert.equal(recorderRoot.status, 200);
    assert.match(recorderRoot.text, /recorder shell/, 'the mounts do not cross');

    // 2. A deep link inside a mount is the SPA's: the shell, not a 404 (README §4.5).
    const deepLink = await get('/wsr/edit/project/Demo1/script/1245/edit?sel=i:0:0:1');
    assert.equal(deepLink.status, 200);
    assert.match(deepLink.text, /editor shell/);

    // 3. A real asset is served from the mount, with its type.
    const asset = await get('/wsr/edit/chunk-abc.js');
    assert.equal(asset.status, 200);
    assert.match(asset.type, /javascript/);
    assert.match(asset.text, /editor shell/);
    const style = await get('/wsr/ng/theme.css');
    assert.equal(style.status, 200);
    assert.match(style.type, /text\/css/);

    // 4. The API is proxied to the receiver, not read from disk (the mounts must not shadow it).
    const version = await get('/api/v1/version');
    assert.equal(version.status, 200);
    assert.match(version.type, /application\/json/);
    assert.match(version.text, /recorderVersion/);

    // 5. The harness's own root page names both mounts and the API (an operator convenience), and
    // anything else outside the mounts and the API is a 404 with the mounts named.
    const root = await get('/');
    assert.equal(root.status, 200);
    assert.match(root.text, /\/wsr\/ng\//);
    assert.match(root.text, /\/wsr\/edit\//);
    const unknown = await get('/nonsense');
    assert.equal(unknown.status, 404);
    assert.match(unknown.text, /mounts: \/wsr\/ng\/, \/wsr\/edit\//);

    // 5b. Inside a mount the documented `.htaccess` falls back for anything that is not a file —
    // `RewriteCond %{REQUEST_FILENAME} -s|-l|-d` then rewrite — so a *missing asset* answers 200
    // with the shell, exactly as the sample the README says to reuse does. Asserted so the
    // rehearsal cannot drift from the documented pattern (and so the caveat is on the record).
    const missingAsset = await get('/wsr/edit/nothing/here.js');
    assert.equal(missingAsset.status, 200);
    assert.match(missingAsset.text, /editor shell/);

    // 6. A traversal attempt cannot leave the mount's directory: the plain form normalises out of
    // the mount and 404s, and the percent-encoded form is not decoded — it lands in the fallback,
    // which serves the shell, never a repository file.
    const escape = await get('/wsr/edit/../recorder/index.html');
    assert.equal(escape.status, 404);
    const encoded = await get('/wsr/edit/..%2f..%2fserver%2fREADME.md');
    assert.ok(encoded.status !== 200 || !/receiver/i.test(encoded.text),
      'an encoded traversal read a repository file');
    assert.match(encoded.text, /editor shell|not found/);
  } finally {
    stop();
  }
});
