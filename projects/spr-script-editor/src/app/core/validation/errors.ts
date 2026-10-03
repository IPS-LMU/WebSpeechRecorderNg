/**
 * Error checks E01–E11 (doc/script-editor/validation.md). Every function is pure:
 * `(draft, context) => Finding[]`, with ids and paths held byte-for-byte against
 * `server/validate.mjs` and `doc/script-editor/checks/*.checks.json`.
 */
import type {Draft, Finding, ValidationContext} from './types';
import {filterOf, queryBank} from './filter';
import {eachBankSource, eachItem, eachSection, isAudio, isObject, mediaitemsOf, trimmedCode} from './walk';

/** The item timing keys the recorder reads; a negative or non-numeric value is E09. */
export const TIMING_FIELDS = ['prerecdelay', 'prerecording', 'recduration', 'duration', 'postrecording', 'postrecdelay'];
const NON_NEGATIVE_PLAYBACK_FIELDS = ['gap', 'maxReplays'];

function error(id: string, path: string, message: string, fix?: Finding['fix'], data?: Finding['data']): Finding {
  const finding: Finding = {id, severity: 'error', path, message};
  if (fix !== undefined) {
    finding.fix = fix;
  }
  if (data !== undefined) {
    finding.data = data;
  }
  return finding;
}

/** E01 — a `itemcode` that is empty or only whitespace. */
export function checkE01(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (trimmedCode(item) === '') {
      findings.push(error('E01', `${path}.itemcode`, 'Itemcode is required.', 'focus'));
    }
  }
  return findings;
}

/** E02 — two items sharing an `itemcode`; the second occurrence is flagged. */
export function checkE02(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  const seen = new Map<string, string>();
  for (const {item, itemPath: path} of eachItem(draft)) {
    const code = trimmedCode(item);
    if (code === '') {
      continue;
    }
    const first = seen.get(code);
    if (first !== undefined) {
      findings.push(error('E02', `${path}.itemcode`, 'Another item already uses this itemcode.', 'next-code', {first}));
    } else {
      seen.set(code, path);
    }
  }
  return findings;
}

/** E03 — a bank source that names no bank, or one that does not exist. */
export function checkE03(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  for (const ref of eachBankSource(draft)) {
    if (ref.bankId.trim() === '') {
      findings.push(error('E03', `${ref.bankPath}.bank`, 'The item draws from a bank but no bank is chosen.', 'bank-picker'));
      continue;
    }
    if (context.bankLookup === undefined) {
      continue;
    }
    if (context.bankLookup(ref.bankId) === null) {
      findings.push(error('E03', `${ref.bankPath}.bank`, `Bank ${ref.bankId} does not exist.`, 'bank-picker'));
    }
  }
  return findings;
}

/** E04 — the draw `count` exceeds the filter's `matchCount`; suspended when the bank cannot be read. */
export function checkE04(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  for (const ref of eachBankSource(draft)) {
    if (ref.bankId.trim() === '') {
      continue;
    }
    const count = Number(ref.bank['count']);
    if (!Number.isInteger(count) || count < 1) {
      // The count itself is malformed; E09 owns that.
      continue;
    }
    const view = context.bankLookup?.(ref.bankId);
    if (view === undefined) {
      findings.push({
        id: 'E04',
        severity: 'warning',
        path: `${ref.bankPath}.count`,
        message: 'The filter match count is unknown because the bank could not be read. Count validation is suspended.',
        suspended: true,
      });
      continue;
    }
    if (view === null) {
      continue;
    }
    const {matchCount} = queryBank(view, filterOf(ref.bank));
    if (count > matchCount) {
      findings.push(error(
        'E04',
        `${ref.bankPath}.count`,
        `The filter matches only ${matchCount} items. Widen the filter or draw fewer.`,
        'clamp-count',
        {matchCount},
      ));
    }
  }
  return findings;
}

interface ReservedRange {
  prefix: string;
  count: number;
  path: string;
  placeholder: string;
}

function reservedRanges(draft: Draft, findings: Finding[]): ReservedRange[] {
  const ranges: ReservedRange[] = [];
  for (const ref of eachBankSource(draft)) {
    const prefix = ref.bank['itemcodePrefix'];
    const count = Number(ref.bank['count']);
    if (prefix === undefined || prefix === null || String(prefix) === '') {
      findings.push(error('E05', `${ref.bankPath}.itemcodePrefix`, 'A drawn itemcode prefix is required.', 'free-prefix'));
      continue;
    }
    if (Number.isInteger(count) && count >= 1) {
      ranges.push({prefix: String(prefix), count, path: ref.bankPath, placeholder: ref.placeholder});
    }
  }
  return ranges;
}

/** E05 — a fixed itemcode inside a reserved range, or two bank sources sharing a prefix. */
export function checkE05(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  const codes: Array<{code: string; path: string}> = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    const code = trimmedCode(item);
    if (code !== '') {
      codes.push({code, path: `${path}.itemcode`});
    }
  }
  const ranges = reservedRanges(draft, findings);

  const byPrefix = new Map<string, ReservedRange>();
  for (const range of ranges) {
    const previous = byPrefix.get(range.prefix);
    if (previous !== undefined) {
      findings.push(error(
        'E05',
        `${range.path}.itemcodePrefix`,
        `Prefix ${range.prefix} is already reserved at ${previous.path}.`,
        'free-prefix',
        {prefix: range.prefix},
      ));
    } else {
      byPrefix.set(range.prefix, range);
    }
  }

  for (const range of ranges) {
    const escaped = range.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reserved = new RegExp(`^${escaped}(\\d{3,})$`);
    for (const {code, path} of codes) {
      if (code === range.placeholder) {
        continue;
      }
      const match = reserved.exec(code);
      if (match !== null && Number(match[1]) <= range.count) {
        const last = String(range.count).padStart(3, '0');
        findings.push(error(
          'E05',
          path,
          `Itemcodes ${range.prefix}001–${range.prefix}${last} are reserved by the bank source at ${range.path}.`,
          'free-prefix',
          {prefix: range.prefix, count: range.count},
        ));
      }
    }
  }
  return findings;
}

/** E06 — `playback` without an audio mediaitem to play. */
export function checkE06(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (item['playback'] === undefined || item['playback'] === null) {
      continue;
    }
    if (!mediaitemsOf(item).some(isAudio)) {
      findings.push(error('E06', `${path}.playback`, 'The item plays media but no file is chosen.', 'file-picker'));
    }
  }
  return findings;
}

/**
 * E07 — the first mediaitem shows nothing and the item plays nothing.
 * (validation.md checks `mediaitems[0]`; `server/validate.mjs` scans every entry — see the report.)
 */
export function checkE07(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    const first = mediaitemsOf(item)[0];
    const shows = first !== undefined && first !== null
      && ((first as Record<string, unknown>)['text'] !== undefined && (first as Record<string, unknown>)['text'] !== null
        || (first as Record<string, unknown>)['promptDoc'] !== undefined && (first as Record<string, unknown>)['promptDoc'] !== null
        || (first as Record<string, unknown>)['src'] !== undefined && (first as Record<string, unknown>)['src'] !== null);
    if (!shows && (item['playback'] === undefined || item['playback'] === null)) {
      findings.push(error('E07', `${path}.mediaitems`, 'The item shows nothing and plays nothing.'));
    }
  }
  return findings;
}

/** E08 — retired by D-W: a group can no longer hold both a rule and a fixed list. */
export function checkE08(): Finding[] {
  return [];
}

/** E09 — a bad draw count, or a timing field that is negative or not a number. */
export function checkE09(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const ref of eachBankSource(draft)) {
    const count = Number(ref.bank['count']);
    if (!Number.isInteger(count) || count < 1) {
      findings.push(error('E09', `${ref.bankPath}.count`, 'count must be a positive whole number.'));
    }
  }
  for (const {item, itemPath: path} of eachItem(draft)) {
    for (const field of TIMING_FIELDS) {
      const value = item[field];
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        findings.push(error('E09', `${path}.${field}`, `${field} must be a positive number of milliseconds.`));
      }
    }
  }
  return findings;
}

/** E10 — a script with no section, or a section with no group. */
export function checkE10(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  const sections = Array.isArray(draft?.sections) ? draft.sections : [];
  if (sections.length === 0) {
    findings.push(error('E10', 'sections', 'A script needs at least one section with one group.', 'add-group'));
    return findings;
  }
  for (const {section, path} of eachSection(draft)) {
    const groups = section['groups'];
    if (!Array.isArray(groups) || groups.length === 0) {
      findings.push(error('E10', `${path}.groups`, 'A script needs at least one section with one group.', 'add-group'));
    }
  }
  return findings;
}

/** E11 — counters and view boxes out of range. */
export function checkE11(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  const scriptHeight = draft?.virtualViewBox?.height;
  if (scriptHeight !== undefined && !(typeof scriptHeight === 'number' && scriptHeight > 0)) {
    findings.push(error('E11', 'virtualViewBox.height', 'The virtual view box height must be greater than zero.'));
  }
  for (const ref of eachBankSource(draft)) {
    const count = Number(ref.bank['count']);
    if (Number.isInteger(count) && count > 999) {
      findings.push(error('E11', `${ref.bankPath}.count`, 'A drawn itemcode range holds at most 999 items.'));
    }
  }
  for (const {item, itemPath: path} of eachItem(draft)) {
    const playback: unknown = item['playback'];
    if (isObject(playback)) {
      const repeats = playback['repeats'];
      if (repeats !== undefined && (!Number.isInteger(repeats) || (repeats as number) < 1)) {
        findings.push(error('E11', `${path}.playback.repeats`, 'repeats must be at least 1.'));
      }
      for (const field of NON_NEGATIVE_PLAYBACK_FIELDS) {
        const value = playback[field];
        if (value !== undefined && (!Number.isFinite(value) || (value as number) < 0)) {
          findings.push(error('E11', `${path}.playback.${field}`, `${field} must not be negative.`));
        }
      }
    }
    mediaitemsOf(item).forEach((mediaitem, mediaIndex) => {
      const height = (mediaitem as Record<string, unknown>)?.['defaultVirtualViewBox'];
      const value = height !== null && typeof height === 'object' ? (height as Record<string, unknown>)['height'] : undefined;
      if (value !== undefined && !(typeof value === 'number' && value > 0)) {
        findings.push(error(
          'E11',
          `${path}.mediaitems[${mediaIndex}].defaultVirtualViewBox.height`,
          'The virtual view box height must be greater than zero.',
        ));
      }
    });
  }
  return findings;
}

/** Every error check, in catalogue order. */
export function runErrorChecks(draft: Draft, context: ValidationContext = {}): Finding[] {
  return [
    ...checkE01(draft),
    ...checkE02(draft),
    ...checkE03(draft, context),
    ...checkE04(draft, context),
    ...checkE05(draft),
    ...checkE06(draft),
    ...checkE07(draft),
    ...checkE08(),
    ...checkE09(draft),
    ...checkE10(draft),
    ...checkE11(draft),
  ];
}
