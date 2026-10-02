import {test} from 'node:test';
import assert from 'node:assert/strict';
import {etagOf, checkIfMatch} from './etag.mjs';

test('etagOf is a quoted strong validator over the bytes', () => {
  const a = etagOf('{"a":1}');
  assert.match(a, /^"[0-9a-f]{64}"$/);
  assert.equal(a, etagOf(Buffer.from('{"a":1}', 'utf8')));
  assert.notEqual(a, etagOf('{"a":2}'));
  // Key order is part of the representation: the bytes decide, not the parsed value.
  assert.notEqual(etagOf('{"a":1,"b":2}'), etagOf('{"b":2,"a":1}'));
});

test('checkIfMatch distinguishes missing, stale, matching and wildcard', () => {
  const etag = etagOf('draft');
  assert.equal(checkIfMatch({headers: {}}, etag), 'missing');
  assert.equal(checkIfMatch({headers: {'if-match': ''}}, etag), 'missing');
  assert.equal(checkIfMatch({headers: {'if-match': etag}}, etag), 'ok');
  assert.equal(checkIfMatch({headers: {'if-match': `"other", ${etag}`}}, etag), 'ok');
  assert.equal(checkIfMatch({headers: {'if-match': '"other"'}}, etag), 'stale');
  assert.equal(checkIfMatch({headers: {'if-match': '*'}}, etag), 'ok');
  assert.equal(checkIfMatch({headers: {'if-match': '*'}}, null), 'stale');
});
