/**
 * Test helper: starts the API on an ephemeral port over a fresh data directory and hands the
 * caller `{base, store, dataDir}`. Not a test file itself (Node's runner only collects `*.test.*`).
 */
import {createServer} from 'node:http';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from './store.mjs';
import {createApiHandler} from './api.mjs';

export async function withServer(run, {seed = null, recorderVersion = undefined} = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'spr-api-'));
  const store = new Store({dataDir, seedDir: seed, log: () => {}, ...(recorderVersion === undefined ? {} : {recorderVersion})}).open();
  const api = createApiHandler({
    store,
    base: '/api',
    maxBody: 1 << 20,
    log: () => {},
    autoCreateSession: {enabled: false, project: null, script: null},
    concatWaitMs: 0,
  });
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    api(req, res, url).then((handled) => {
      if (!handled && !res.headersSent) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run({base: `http://127.0.0.1:${server.address().port}/api`, store, dataDir});
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export const jsonRequest = (method, body) => ({
  method,
  headers: {'content-type': 'application/json'},
  body: JSON.stringify(body),
});
