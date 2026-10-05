/**
 * Speaker pseudonymity (README §8.4, plan 11.4). A deployment that must not expose real speaker
 * ids turns this on and the receiver stores and returns pseudonyms instead: the same speaker maps to
 * the same label everywhere — the draw record, the CSV, the session record and the
 * "already recorded by this speaker" check — and the real id never reaches a browser.
 *
 * The salt lives in the data directory, so pseudonyms stay stable across restarts and across the
 * copy-to-production transfer of the store, and differ between installations.
 */
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const SALT_FILE = 'speaker-salt';

/** The deployment's salt, created on first use and reused afterwards. */
export function loadOrCreateSalt(dataDir) {
  const path = join(dataDir, SALT_FILE);
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8').trim();
    if (existing !== '') {
      return existing;
    }
  }
  mkdirSync(dataDir, {recursive: true});
  const salt = randomBytes(24).toString('hex');
  writeFileSync(path, `${salt}\n`);
  return salt;
}

/**
 * A stable label for a speaker. Prefixed so a reader can see at a glance that it is not an id, and
 * truncated to keep it readable in a table; 12 hex characters are far more than enough to avoid
 * collisions within one installation's speakers.
 */
export function pseudonymiseSpeaker(salt, speaker) {
  if (speaker === null || speaker === undefined || String(speaker).trim() === '') {
    return speaker ?? null;
  }
  return `sp-${createHash('sha256').update(`${salt}:${String(speaker)}`).digest('hex').slice(0, 12)}`;
}
