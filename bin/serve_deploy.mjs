#!/usr/bin/env node
/**
 * Local stand-in for the documented deployment (README §4.5): the recorder under `/wsr/ng/`, the
 * editor under `/wsr/edit/`, one API beside them, each app behind a path prefix with the SPA
 * fallback the real web server is expected to apply.
 *
 * The receiver serves a single application at the root, so a sub-path — exactly what breaks base
 * hrefs, relative asset URLs and deep links — is otherwise untested. This is a rehearsal tool, not
 * a replacement for the web server: it has no authentication, no caching and no TLS.
 *
 * Usage:
 *   node server/server.mjs --port 8391 --data /tmp/deploy --seed src/test --app none \
 *     --project Demo1 --script playback --quiet &
 *   npm run build -- --base-href=/wsr/ng/                      # recorder
 *   npm run build_editor -- --base-href=/wsr/edit/             # editor
 *   node bin/serve_deploy.mjs --port 8080 --api http://127.0.0.1:8391
 *
 * Then open http://127.0.0.1:8080/wsr/edit/project/Demo1/script and
 * http://127.0.0.1:8080/wsr/ng/spr/session/1.
 */

import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer, request as httpRequest} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(opt('port', '8080'));
const API = opt('api', 'http://127.0.0.1:8391');
const API_ORIGIN = new URL(API);
const MOUNTS = [
  {prefix: '/wsr/ng/', dir: resolve(opt('recorder', 'dist/cavox/browser')), title: 'Recorder'},
  {prefix: '/wsr/edit/', dir: resolve(opt('editor', 'dist/spr-script-editor/browser')), title: 'Script editor'},
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const sendFile = (res, path, status = 200) => {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(path).pipe(res);
};

const proxyApi = (req, res) => {
  const upstream = httpRequest(
    {
      hostname: API_ORIGIN.hostname,
      port: API_ORIGIN.port,
      path: req.url,
      method: req.method,
      headers: {...req.headers, host: API_ORIGIN.host},
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end(`receiver unreachable: ${error.message}`);
  });
  req.pipe(upstream);
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }
  if (url.pathname === '/') {
    res.writeHead(200, {'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store'});
    res.end(`<!doctype html><meta charset="utf-8"><title>Deployment rehearsal</title>
<h1>Deployment rehearsal</h1>
<ul>${MOUNTS.map((mount) => `<li><a href="${mount.prefix}">${mount.prefix}</a> — ${mount.title}</li>`).join('')}</ul>
<p>API proxied to ${API}${API_ORIGIN.pathname === '/' ? '' : API_ORIGIN.pathname}.</p>`);
    return;
  }
  const mount = MOUNTS.find((candidate) => url.pathname.startsWith(candidate.prefix));
  if (mount === undefined) {
    res.writeHead(404, {'Content-Type': TYPES['.txt']});
    res.end(`not found: ${url.pathname} (mounts: ${MOUNTS.map((m) => m.prefix).join(', ')})`);
    return;
  }
  if (!existsSync(mount.dir)) {
    res.writeHead(500, {'Content-Type': TYPES['.txt']});
    res.end(`${mount.title} is not built: ${mount.dir} does not exist`);
    return;
  }
  const relative = decodeURIComponent(url.pathname.slice(mount.prefix.length));
  const candidate = normalize(join(mount.dir, relative));
  const inside = candidate === mount.dir || candidate.startsWith(`${mount.dir}/`);
  if (inside && existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(res, candidate);
    return;
  }
  // Every unknown path inside a mount is the application's own route: hand back its shell.
  sendFile(res, join(mount.dir, 'index.html'), 200);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`deployment rehearsal on http://127.0.0.1:${PORT}`);
  for (const mount of MOUNTS) {
    console.log(`  ${mount.prefix.padEnd(12)} ${mount.title.padEnd(14)} ${mount.dir}`);
  }
  console.log(`  /api/        proxied to     ${API}`);
});
