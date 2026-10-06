/**
 * Server-returned findings (B3, rest-api.md §2.4). A publish refused with `409 PUBLISH_REJECTED`
 * carries `details.checks`; converting it here lets the checks panel render the race as findings
 * rather than as a bare error.
 *
 * The store itself is `EditorFindingsService` (app/core) so the shell and the source view share one
 * place for server findings; this module only owns the untrusted-payload conversion.
 */
import {isObject} from '../core/validation/walk';
import type {Finding, Severity} from '../core/validation/types';
import {severityOfId} from './paths';

/**
 * One entry of the server's `details.checks`, as documented in rest-api.md §2.4. Not a type this
 * module can use: the payload is untrusted, so it is read through type guards rather than asserted
 * into a shape — `checksArray` and `serverFindingsFrom` below are that reading.
 */

function isSeverity(value: unknown): value is Severity {
  return value === 'error' || value === 'warning' || value === 'note';
}

/** The `details.checks` array of a 409 body, a bare `{checks}` object, or a bare array. */
function checksArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isObject(payload)) {
    return null;
  }
  if (Array.isArray(payload['checks'])) {
    return payload['checks'];
  }
  const details = payload['details'];
  return isObject(details) && Array.isArray(details['checks']) ? details['checks'] : null;
}

/** Turns a `details.checks` payload (or the whole 409 body) into panel findings. */
export function serverFindingsFrom(payload: unknown): Finding[] {
  const raw = checksArray(payload);
  if (raw === null) {
    return [];
  }
  const findings: Finding[] = [];
  for (const entry of raw) {
    if (!isObject(entry) || typeof entry['id'] !== 'string' || entry['id'] === '') {
      continue;
    }
    const id = entry['id'];
    const severity = isSeverity(entry['severity']) ? entry['severity'] : severityOfId(id);
    const message = typeof entry['message'] === 'string' && entry['message'] !== ''
      ? entry['message']
      : `The server refused this check (${id}).`;
    findings.push({
      id,
      severity,
      path: typeof entry['path'] === 'string' ? entry['path'] : '',
      message,
    });
  }
  return findings;
}
