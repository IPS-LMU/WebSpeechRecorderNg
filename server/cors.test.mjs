/**
 * CORS is what makes the documented development setup work: the editor under `ng serve` on another
 * port talks to the receiver cross-origin. The write protocol needs request headers a browser will
 * only send after a preflight allows them (`If-Match`, `If-None-Match`, `X-Filename`) and response
 * headers the client must be able to read (`ETag`, `Location`) — missing either silently degrades
 * conditional writes and created-draft discovery.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CORS_ALLOW_HEADERS, CORS_EXPOSE_HEADERS, applyCors} from './cors.mjs';

function fakeRes() {
  const headers = {};
  return {headers, setHeader: (name, value) => { headers[name] = value; }};
}

test('no origin means no CORS headers', () => {
  const res = fakeRes();
  applyCors({headers: {}}, res, {cors: true, credentials: false});
  assert.deepEqual(res.headers, {});
});

test('the preflight allows every header the write protocol sends', () => {
  const res = fakeRes();
  applyCors({headers: {origin: 'http://127.0.0.1:4200'}}, res, {cors: true, credentials: false});
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(res.headers['Vary'], 'Origin');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], undefined);
  for (const header of ['content-type', 'authorization', 'if-match', 'if-none-match', 'x-filename']) {
    assert.ok(
      CORS_ALLOW_HEADERS.toLowerCase().includes(header),
      `${header} must be allowed or the browser refuses the preflight`,
    );
  }
  for (const header of ['etag', 'location']) {
    assert.ok(
      CORS_EXPOSE_HEADERS.toLowerCase().includes(header),
      `${header} must be exposed or the client cannot read the validator it has to send back`,
    );
  }
  assert.equal(res.headers['Access-Control-Max-Age'], '600');
});

test('credentials echo the origin instead of the wildcard', () => {
  const res = fakeRes();
  applyCors({headers: {origin: 'https://example.test'}}, res, {cors: true, credentials: true});
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://example.test');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
});

test('cors can be switched off', () => {
  const res = fakeRes();
  applyCors({headers: {origin: 'http://127.0.0.1:4200'}}, res, {cors: false, credentials: false});
  assert.deepEqual(res.headers, {});
});
