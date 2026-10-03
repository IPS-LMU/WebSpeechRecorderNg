/**
 * Warning checks W01–W13 (doc/script-editor/validation.md). Warnings never block a publish; three
 * of them (E04's sibling W05 on a drawn group, and W11) are *suspended* when the data they need
 * cannot be fetched, per ui-spec §9 — a suspended check emits a warning marked `suspended` rather
 * than silently passing.
 */
import {
  compareVersions,
  DEFAULT_POST_REC_DELAY,
  DEFAULT_PRE_REC_DELAY,
  effectiveTiming,
  type PromptItem,
} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../editor-strings';
import type {Draft, Finding, ValidationContext} from './types';
import {filterOf, queryBank} from './filter';
import {fillTemplate} from './interpolate';
import {eachBankSource, eachItem, eachSection, isAudio, isImage, isNonRecordingItem, isObject, mediaitemsOf} from './walk';

const S = EDITOR_STRINGS.validation;

function warning(id: string, path: string, message: string, data?: Finding['data']): Finding {
  const finding: Finding = {id, severity: 'warning', path, message};
  if (data !== undefined) {
    finding.data = data;
  }
  return finding;
}

function suspended(id: string, path: string, message: string): Finding {
  return {id, severity: 'warning', path, message, suspended: true};
}

/** W01 — an item inside an AUTORECORDING section records with no `recduration`. */
export function checkW01(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {section} of eachSection(draft)) {
    if (section['mode'] !== 'AUTORECORDING') {
      continue;
    }
    for (const {item, itemPath: path} of eachItem({sections: [section]})) {
      if (isNonRecordingItem(item)) {
        continue;
      }
      if (item['recduration'] === undefined || item['recduration'] === null) {
        findings.push(warning('W01', `${path}.recduration`, S.w01));
      }
    }
  }
  return findings;
}

/** W02 — an image prompt with no `alt`. */
export function checkW02(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    mediaitemsOf(item).forEach((mediaitem, index) => {
      if (!isImage(mediaitem)) {
        return;
      }
      const alt = (mediaitem as Record<string, unknown>)['alt'];
      if (alt === undefined || alt === null || String(alt).trim() === '') {
        findings.push(warning('W02', `${path}.mediaitems[${index}].alt`, S.w02));
      }
    });
  }
  return findings;
}

/** W03 — `DURING` playback without headphones, on an item or on a draw's playback (D-V = C). */
export function checkW03(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    const playback = item['playback'];
    if (isObject(playback) && playback['when'] === 'DURING' && playback['headphones'] !== true) {
      findings.push(warning('W03', `${path}.playback.headphones`, S.w03));
    }
  }
  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    if (isObject(playback) && playback['when'] === 'DURING' && playback['headphones'] !== true) {
      findings.push(warning('W03', `${ref.bankPath}.playback.headphones`, S.w03));
    }
  }
  return findings;
}

/** W04 — a draw that plays bank audio while some matching items have no model recording. */
export function checkW04(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  for (const ref of eachBankSource(draft)) {
    if (ref.bank['playBankAudio'] !== true || ref.bankId.trim() === '') {
      continue;
    }
    const view = context.bankLookup?.(ref.bankId);
    if (view === undefined || view === null) {
      continue;
    }
    const {withoutAudio, matchCount} = queryBank(view, filterOf(ref.bank));
    if (withoutAudio > 0) {
      findings.push(warning('W04', `${ref.bankPath}.playBankAudio`, fillTemplate(S.w04, {withoutAudio, matchCount})));
    }
  }
  return findings;
}

function spanMs(durationMs: number | null, repeats: number, gap: number): number | null {
  if (durationMs === null) {
    return null;
  }
  return durationMs * repeats + gap * (repeats - 1);
}

/** W05 — a `PRERECORDING` clip longer than the pre-recording delay. */
export function checkW05(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    const playback = item['playback'];
    if (!isObject(playback) || playback['when'] !== 'PRERECORDING') {
      continue;
    }
    const timing = effectiveTiming(item as unknown as PromptItem);
    if (timing.playbackSpanMs !== null && timing.playbackSpanMs > timing.preDelay) {
      findings.push(warning('W05', `${path}.playback.when`, fillTemplate(S.w05, {clip: timing.playbackSpanMs, delay: timing.preDelay})));
    }
  }

  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    const when = isObject(playback) ? playback['when'] : undefined;
    if (when !== 'PRERECORDING') {
      continue;
    }
    const durations = context.clipDurations?.(ref.bankId);
    const view = context.bankLookup?.(ref.bankId);
    if (durations === undefined || view === undefined || view === null) {
      findings.push(suspended('W05', `${ref.bankPath}.playback.when`, S.w05SuspendedMissing));
      continue;
    }
    const matching = queryBank(view, filterOf(ref.bank)).items;
    const known = matching.map((bankItem) => durations.get(String(bankItem.bankItemId)));
    if (known.some((duration) => duration === undefined)) {
      findings.push(suspended('W05', `${ref.bankPath}.playback.when`, S.w05SuspendedPartial));
      continue;
    }
    const repeats = typeof (playback as Record<string, unknown>)['repeats'] === 'number'
      ? Math.max(1, (playback as Record<string, unknown>)['repeats'] as number)
      : 1;
    const gap = typeof (playback as Record<string, unknown>)['gap'] === 'number'
      ? Math.max(0, (playback as Record<string, unknown>)['gap'] as number)
      : DEFAULT_POST_REC_DELAY;
    const defaults = ref.bank['itemDefaults'];
    const delay = isObject(defaults) && typeof defaults['prerecdelay'] === 'number'
      ? defaults['prerecdelay'] as number
      : DEFAULT_PRE_REC_DELAY;
    const spans = known
      .map((duration) => spanMs(duration as number, repeats, gap))
      .filter((span): span is number => span !== null);
    const longest = spans.length === 0 ? null : Math.max(...spans);
    if (longest !== null && longest > delay) {
      findings.push(warning('W05', `${ref.bankPath}.playback.when`, fillTemplate(S.w05, {clip: longest, delay})));
    }
  }
  return findings;
}

/** W06 — a timing field on the kind of item that ignores it. */
export function checkW06(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (isNonRecordingItem(item) && item['recduration'] !== undefined && item['recduration'] !== null) {
      findings.push(warning('W06', `${path}.recduration`, fillTemplate(S.w06, {field: 'recduration'})));
    }
    if (!isNonRecordingItem(item) && item['duration'] !== undefined && item['duration'] !== null) {
      findings.push(warning('W06', `${path}.duration`, fillTemplate(S.w06, {field: 'duration'})));
    }
  }
  return findings;
}

/** W07 — a training section containing a drawn group. */
export function checkW07(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {section} of eachSection(draft)) {
    if (section['training'] !== true) {
      continue;
    }
    for (const ref of eachBankSource({sections: [section]})) {
      findings.push(warning('W07', ref.bankPath, S.w07));
    }
  }
  return findings;
}

/** W08 — more than one mediaitem; the recorder shows only the first. */
export function checkW08(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (mediaitemsOf(item).length > 1) {
      findings.push({...warning('W08', `${path}.mediaitems`, S.w08), fix: 'keep-first-mediaitem'});
    }
  }
  return findings;
}

/** W09 — an unlimited replay in a section that advances on its own. */
export function checkW09(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {section} of eachSection(draft)) {
    if (section['mode'] !== 'AUTORECORDING') {
      continue;
    }
    for (const {item, itemPath: path} of eachItem({sections: [section]})) {
      const playback = item['playback'];
      if (isObject(playback)) {
        if (playback['replayable'] === true && (playback['maxReplays'] === undefined || playback['maxReplays'] === null)) {
          findings.push(warning('W09', `${path}.playback.maxReplays`, S.w09));
        }
        continue;
      }
      mediaitemsOf(item).forEach((mediaitem, index) => {
        if (isAudio(mediaitem) && (mediaitem as Record<string, unknown>)['replay'] === true) {
          findings.push(warning('W09', `${path}.mediaitems[${index}].replay`, S.w09));
        }
      });
    }
  }
  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    if (isObject(playback) && playback['replayable'] === true) {
      findings.push(warning('W09', `${ref.bankPath}.playback.replayable`, S.w09));
    }
  }
  return findings;
}

/** W10 — the script needs a newer recorder than this deployment reports. */
export function checkW10(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  const required = draft?.minRecorderVersion;
  const actual = context.recorderVersion;
  if (typeof required === 'string' && required.trim() !== '' && typeof actual === 'string' && actual.trim() !== ''
    && compareVersions(required, actual) > 0) {
    findings.push(warning('W10', 'minRecorderVersion', fillTemplate(S.w10, {required, actual})));
  }
  return findings;
}

/** W11 — a referenced playback or image file missing from the project's media. */
export function checkW11(draft: Draft, context: ValidationContext = {}): Finding[] {
  const findings: Finding[] = [];
  const index = context.mediaIndex;
  const known = index == null ? null : new Set(index);
  for (const {item, itemPath: path} of eachItem(draft)) {
    mediaitemsOf(item).forEach((mediaitem, mediaIndex) => {
      const src = isObject(mediaitem) ? mediaitem['src'] : undefined;
      if (typeof src !== 'string' || src.trim() === '') {
        return;
      }
      if (known === null) {
        findings.push(suspended('W11', `${path}.mediaitems[${mediaIndex}].src`, fillTemplate(S.w11Suspended, {src})));
      } else if (!known.has(src)) {
        findings.push(warning('W11', `${path}.mediaitems[${mediaIndex}].src`, fillTemplate(S.w11Missing, {src})));
      }
    });
  }
  return findings;
}

/** W12 — `PRERECORDING`/`DURING` on an item with no recording phase. */
export function checkW12(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    const playback = item['playback'];
    if (!isNonRecordingItem(item) || !isObject(playback)) {
      continue;
    }
    const when = playback['when'];
    if (when === 'PRERECORDING' || when === 'DURING') {
      findings.push(warning('W12', `${path}.playback.when`, S.w12));
    }
  }
  return findings;
}

/** W13 — `playback` set together with the shipped mediaitem placement flags. */
export function checkW13(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (item['playback'] === undefined || item['playback'] === null) {
      continue;
    }
    const clashes = mediaitemsOf(item).filter((mediaitem) => {
      const record = mediaitem as Record<string, unknown>;
      return record['autoplay'] !== undefined || record['replay'] !== undefined;
    });
    if (clashes.length > 0) {
      findings.push({...warning('W13', `${path}.playback`, S.w13), data: {count: clashes.length}});
    }
  }
  return findings;
}

/** Every warning check, in catalogue order. */
export function runWarningChecks(draft: Draft, context: ValidationContext = {}): Finding[] {
  return [
    ...checkW01(draft),
    ...checkW02(draft),
    ...checkW03(draft),
    ...checkW04(draft, context),
    ...checkW05(draft, context),
    ...checkW06(draft),
    ...checkW07(draft),
    ...checkW08(draft),
    ...checkW09(draft),
    ...checkW10(draft, context),
    ...checkW11(draft, context),
    ...checkW12(draft),
    ...checkW13(draft),
  ];
}
