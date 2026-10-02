/**
 * Strong HTTP validators for the script drafts (and, later, banks).
 *
 * The validator is the sha256 of the bytes that were stored, so it identifies a representation
 * exactly: `If-Match` is a byte comparison, an identical body returns the same ETag, and the ETag
 * is only meaningful because every write goes through temp+rename (see `Store.writeJson`).
 * Only strong validators are produced — RFC 9110 forbids weak ones in `If-Match` — so there is no
 * `W/` prefix.
 */
import {createHash} from 'node:crypto';

/** The quoted strong ETag of a buffer or string. */
export function etagOf(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  return `"${createHash('sha256').update(buf).digest('hex')}"`;
}

/**
 * Evaluates the request's `If-Match` against the current validator.
 *
 * @returns {'missing'|'stale'|'ok'} `missing` when the header is absent (the caller answers 428),
 *   `stale` when it does not match (the caller answers 412 with the current representation), and
 *   `ok` when the write may proceed. `*` matches any existing representation, per RFC 9110.
 */
export function checkIfMatch(req, currentEtag) {
  const header = req.headers?.['if-match'];
  if (typeof header !== 'string' || header.trim() === '') {
    return 'missing';
  }
  const candidates = header.split(',').map((value) => value.trim()).filter((value) => value !== '');
  if (candidates.includes('*')) {
    return currentEtag === null ? 'stale' : 'ok';
  }
  return currentEtag !== null && candidates.includes(currentEtag) ? 'ok' : 'stale';
}
