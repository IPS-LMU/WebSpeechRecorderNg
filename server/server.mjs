#!/usr/bin/env node
/**
 * Evaluation receiver for Cavox: serves the built application and implements the
 * REST API the recorder uploads to.
 *
 *   node server/server.mjs                       # http://127.0.0.1:8080
 *   node server/server.mjs --port 9000 --data /tmp/sr-data
 *
 * Everything the client sends is written to the data directory (see `store.mjs`), so a recorded
 * session can be inspected, replayed as a fixture or checked byte for byte after the fact.
 */
import {createServer} from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApiHandler} from './api.mjs';
import {applyCors} from './cors.mjs';
import {RECORDER_VERSION} from './feature-versions.mjs';
import {Store} from './store.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');

const options = parseArgs(process.argv.slice(2));
const log = makeLogger();
const store = new Store({dataDir: options.data, seedDir: options.seed, log, recorderVersion: options.recorderVersion, pseudonymiseSpeakers: options.pseudonymiseSpeakers}).open();

// Maintenance subcommands run against the data directory and exit before serving.
if (options.migrate || options.gc) {
  if (options.migrate) {
    const summary = store.migrateLegacyTrees();
    log(`migrate: ${summary.scripts} script(s) examined, ${summary.imported} legacy script(s) imported as version 1`);
  }
  if (options.gc) {
    const summary = store.gc({media: options.gcMedia});
    log(`gc: ${summary.revisionsRemoved} draft revision(s) removed, ${summary.previewsRemoved} expired preview(s) removed, `
      + `${summary.orphansFound} orphan media found${options.gcMedia ? `, ${summary.mediaRemoved} removed` : ' (pass --gc-media to remove)'}`);
  }
  process.exit(0);
}
const autoCreateSession = {
  enabled: options.autoCreate,
  project: options.project ?? defaultProject(store),
  script: options.script ?? defaultScript(store, options.project ?? defaultProject(store)),
};
const api = createApiHandler({
  store,
  base: options.apiBase,
  maxBody: options.maxBody,
  log,
  autoCreateSession,
  concatWaitMs: options.concatWaitMs,
});

const server = createServer((req, res) => {
  const started = process.hrtime.bigint();
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    // Uploads are logged by the API with their details; this line is the request itself.
    const line = `${res.statusCode} ${req.method} ${url.pathname}${url.search} ${res.getHeader('Content-Length') ?? '-'}B ${ms.toFixed(1)}ms`;
    if (options.quiet && !url.pathname.startsWith(options.apiBase)) {
      return;
    }
    if (!options.verbose && !url.pathname.startsWith(options.apiBase) && res.statusCode < 400) {
      return;
    }
    log(line);
  });
  applyCors(req, res, options);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Content-Length': 0});
    res.end();
    return;
  }
  api(req, res, url).then((handled) => {
    if (handled) {
      return;
    }
    try {
      serveApplication(req, res, url);
    } catch (err) {
      res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end(`internal error: ${err.message}`);
    }
  });
});

server.listen(options.port, options.host, () => {
  banner();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}

// ---------------------------------------------------------------- static application

/** Serves the built application; unknown paths fall back to index.html (Angular routing). */
function serveApplication(req, res, url) {
  if (options.app === null) {
    res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('not found: no application directory is served (--app none)');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('method not allowed');
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const candidate = resolve(options.app, rel);
  const inside = candidate === options.app || candidate.startsWith(`${options.app}/`);
  const isFile = inside && existsSync(candidate) && statSync(candidate).isFile();
  const target = isFile ? candidate : join(options.app, 'index.html');
  if (!existsSync(target)) {
    res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end(`not found: ${url.pathname} (no ${options.app}/index.html to fall back to)`);
    return;
  }
  res.writeHead(200, {
    'Content-Type': contentTypeOf(target),
    'Content-Length': statSync(target).size,
    // Hashed bundles change on every build; the evaluation flow must never see a stale one.
    'Cache-Control': isFile ? 'no-cache' : 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}

function contentTypeOf(path) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.webm': 'audio/webm',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
  };
  return types[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------- command line

function parseArgs(argv) {
  const opts = {
    host: '127.0.0.1',
    port: 8080,
    apiBase: '/api/v1',
    data: join(ROOT, 'server', 'data'),
    seed: join(ROOT, 'src', 'test'),
    app: join(ROOT, 'dist', 'cavox', 'browser'),
    project: null,
    script: null,
    autoCreate: true,
    cors: true,
    credentials: false,
    maxBody: 256 * 1024 * 1024,
    concatWaitMs: 1500,
    quiet: false,
    verbose: false,
    migrate: false,
    gc: false,
    gcMedia: false,
    recorderVersion: RECORDER_VERSION,
    pseudonymiseSpeakers: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    switch (arg) {
      case '--host': opts.host = value; i++; break;
      case '--port': opts.port = Number(value); i++; break;
      case '--api-base': opts.apiBase = normalizeBase(value); i++; break;
      case '--data': opts.data = resolve(value); i++; break;
      case '--seed': opts.seed = value === 'none' ? null : resolve(value); i++; break;
      case '--app': opts.app = value === 'none' ? null : resolve(value); i++; break;
      case '--project': opts.project = value; i++; break;
      case '--script': opts.script = value; i++; break;
      case '--no-auto-create': opts.autoCreate = false; break;
      case '--no-cors': opts.cors = false; break;
      case '--credentials': opts.credentials = true; break;
      case '--max-body': opts.maxBody = Number(value); i++; break;
      case '--concat-wait-ms': opts.concatWaitMs = Number(value); i++; break;
      case '--quiet': opts.quiet = true; break;
      case '--verbose': opts.verbose = true; break;
      case '--migrate': opts.migrate = true; break;
      case '--gc': opts.gc = true; break;
      case '--gc-media': opts.gcMedia = true; break;
      case '--recorder-version': opts.recorderVersion = value; i++; break;
      case '--pseudonymise-speakers': opts.pseudonymiseSpeakers = true; break;
      case '--help': case '-h': usage(); process.exit(0); break;
      default:
        process.stderr.write(`unknown argument ${arg}\n`);
        usage();
        process.exit(2);
    }
  }
  if (!Number.isFinite(opts.port) || opts.port <= 0) {
    throw new Error(`--port must be a port number, got ${opts.port}`);
  }
  if (!Number.isFinite(opts.maxBody) || opts.maxBody <= 0) {
    throw new Error(`--max-body must be a byte count, got ${opts.maxBody}`);
  }
  return opts;
}

function normalizeBase(value) {
  const trimmed = `/${String(value).replace(/^\/+|\/+$/g, '')}`;
  if (trimmed === '/') {
    // An empty base is not a route prefix: it would swallow the application as well.
    throw new Error('--api-base must not be empty');
  }
  return trimmed;
}

function usage() {
  process.stdout.write(`Usage: node server/server.mjs [options]

  --host <host>        interface to listen on (default 127.0.0.1)
  --port <port>        port to listen on (default 8080)
  --api-base <path>    API base path (default /api/v1); must equal the
                       apiEndPoint of the application's environment file
  --data <dir>         data directory, seeded on first run (default server/data)
  --seed <dir|none>    fixture tree copied into an empty data directory (default src/test)
  --app <dir|none>     built application to serve (default dist/cavox/browser)
  --project <id>       project of sessions created on demand (default: the only project)
  --script <id>        script of sessions created on demand
  --no-auto-create     answer 404 for sessions that do not exist
  --no-cors            do not answer cross origin requests (ng serve on another port)
  --credentials        allow credentials in cross origin requests
  --max-body <bytes>   maximum request body size (default ${256 * 1024 * 1024})
  --concat-wait-ms <n> how long a concat request waits for chunks that are
                       still in flight before it defers to them (default 1500;
                       the client queues the concat in front of the chunk it
                       encodes asynchronously, see the README)
  --quiet              log uploads and errors only
  --verbose            log every request, including static files
  --recorder-version <v> version the served recorder reports (default ${RECORDER_VERSION}); a
                       script whose minRecorderVersion is above it is refused at session creation
  --pseudonymise-speakers
                       store and return a stable per-deployment label instead of the caller's
                       speaker id (README §8.4); the salt lives in the data directory, so labels
                       survive restarts and the copy-to-production transfer
  --migrate            create the per-script layout for legacy flat scripts, then exit
  --gc                 prune draft revisions and expired preview sessions, then exit
  --gc-media           with --gc, also delete media that no draft or version references
  -h, --help           this text
`);
}

function defaultProject(store) {
  // Prefer a project that already has a session: that is the one an operator can start right away.
  for (const sessionId of store.sessionIds()) {
    const project = store.session(sessionId)?.project;
    if (project !== undefined && project !== null) {
      return project;
    }
  }
  const projects = store.projectIds();
  return projects.length === 1 ? projects[0] : null;
}

function defaultScript(store, project) {
  for (const sessionId of store.sessionIds()) {
    const session = store.session(sessionId);
    if ((project === null || session?.project === project) && session?.script !== undefined && session.script !== null) {
      return session.script;
    }
  }
  const scripts = store.scriptIds();
  if (scripts.length === 1) {
    return scripts[0];
  }
  return project === null ? null : (store.project(project)?.script ?? null);
}

function makeLogger() {
  return (message) => {
    process.stdout.write(`${new Date().toISOString().slice(11, 23)} ${message}\n`);
  };
}

function banner() {
  const rows = [
    `evaluation receiver listening on http://${options.host}:${options.port}`,
    `  API base      ${options.apiBase || '/'}`,
    `  data          ${options.data}`,
    `  application   ${options.app ?? '(not served)'}${options.app !== null && !existsSync(options.app) ? ' [missing: run npm run build]' : ''}`,
    `  sessions      ${autoCreateSession.enabled ? `unknown ids are created for project ${autoCreateSession.project ?? '(none configured)'}, script ${autoCreateSession.script ?? '(none configured)'}` : 'must exist'}`,
  ];
  const sessions = store.sessionIds().slice(0, 8);
  if (sessions.length > 0) {
    rows.push(`  sessions now  ${sessions.join(', ')}`);
  }
  rows.push(`  try           http://${options.host}:${options.port}/spr/session/${sessions[0] ?? '1'}`);
  process.stdout.write(`${rows.join('\n')}\n`);
}
