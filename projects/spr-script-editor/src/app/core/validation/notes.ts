/**
 * Note checks N01–N06 (doc/script-editor/validation.md). Notes are informational; two of them
 * (N01, N02) and N06 carry a one-click fix in `normalise.ts`.
 */
import {compareVersions, FEATURE_VERSIONS, featuresUsed, minRecorderVersionFor} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../editor-strings';
import type {Draft, Finding, ValidationContext} from './types';
import {fillTemplate} from './interpolate';
import {eachBankSource, eachGroup, eachItem, eachSection} from './walk';

const S = EDITOR_STRINGS.validation;

function note(id: string, path: string, message: string, fix?: Finding['fix']): Finding {
  const finding: Finding = {id, severity: 'note', path, message};
  if (fix !== undefined) {
    finding.fix = fix;
  }
  return finding;
}

interface LegacyPair {
  legacy: string;
  modern: string;
}

const LEGACY_PAIRS: LegacyPair[] = [
  {legacy: 'prerecording', modern: 'prerecdelay'},
  {legacy: 'postrecording', modern: 'postrecdelay'},
];

/** N01 — a legacy delay key is set while the modern key is unset. */
export function checkN01(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    for (const {legacy, modern} of LEGACY_PAIRS) {
      if (item[legacy] !== undefined && item[legacy] !== null && (item[modern] === undefined || item[modern] === null)) {
        findings.push(note('N01', `${path}.${legacy}`, fillTemplate(S.n01, {legacy, modern}), 'rename-modern'));
      }
    }
  }
  return findings;
}

/** N02 — `order: 'RANDOMIZED'`, which the recorder treats as sequential. */
export function checkN02(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {section, path} of eachSection(draft)) {
    if (section['order'] === 'RANDOMIZED') {
      findings.push(note('N02', `${path}.order`, S.n02, 'replace-order'));
    }
  }
  for (const {group, groupPath} of eachGroup(draft)) {
    if (group['order'] === 'RANDOMIZED') {
      findings.push(note('N02', `${groupPath}.order`, S.n02, 'replace-order'));
    }
  }
  for (const ref of eachBankSource(draft)) {
    if (ref.bank['order'] === 'RANDOMIZED') {
      findings.push(note('N02', `${ref.bankPath}.order`, S.n02, 'replace-order'));
    }
  }
  return findings;
}

/** N03 — the script contains a draw rule; report the session's item totals. */
export function checkN03(draft: Draft): Finding[] {
  const sources = eachBankSource(draft);
  if (sources.length === 0) {
    return [];
  }
  const drawn = sources.reduce((total, ref) => {
    const count = Number(ref.bank['count']);
    return total + (Number.isInteger(count) && count > 0 ? count : 0);
  }, 0);
  const placeholders = new Set(sources.map((ref) => ref.itemPath));
  const fixed = eachItem(draft).filter((ref) => !placeholders.has(ref.itemPath)).length;
  return [note(
    'N03',
    sources[0].bankPath,
    fillTemplate(S.n03, {drawn, fixed, total: drawn + fixed}),
  )];
}

/** N04 — an edit lifts `minRecorderVersion` above what the draft needed before. */
export function checkN04(draft: Draft, context: ValidationContext = {}): Finding[] {
  const next = minRecorderVersionFor(draft);
  if (next === null) {
    return [];
  }
  const previous = minRecorderVersionFor(context.previousDraft as never);
  if (previous !== null && compareVersions(next, previous) <= 0) {
    return [];
  }
  const feature = featuresUsed(draft).find((name) => FEATURE_VERSIONS[name] === next) ?? 'minRecorderVersion';
  return [note('N04', 'minRecorderVersion', fillTemplate(S.n04, {version: next, feature}))];
}

/** N05 — a speaker-stable draw that also skips what the speaker recorded. */
export function checkN05(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const ref of eachBankSource(draft)) {
    if (ref.bank['fixedBy'] === 'SPEAKER' && ref.bank['skipRecordedBySpeaker'] === true) {
      findings.push(note('N05', ref.bankPath, S.n05));
    }
  }
  return findings;
}

/** N06 — a legacy `promptUnits` section with no `groups`. */
export function checkN06(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {section, path} of eachSection(draft)) {
    const groups = section['groups'];
    const hasGroups = Array.isArray(groups) && groups.length > 0;
    if (section['promptUnits'] !== undefined && section['promptUnits'] !== null && !hasGroups) {
      findings.push(note('N06', path, S.n06, 'convert-groups'));
    }
  }
  return findings;
}

/** Every note check, in catalogue order. */
export function runNoteChecks(draft: Draft, context: ValidationContext = {}): Finding[] {
  return [
    ...checkN01(draft),
    ...checkN02(draft),
    ...checkN03(draft),
    ...checkN04(draft, context),
    ...checkN05(draft),
    ...checkN06(draft),
  ];
}
