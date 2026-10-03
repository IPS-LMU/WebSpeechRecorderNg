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
import type {Draft, Finding, ValidationContext} from './types';
import {filterOf, queryBank} from './filter';
import {eachBankSource, eachItem, eachSection, isAudio, isImage, isNonRecordingItem, mediaitemsOf} from './walk';

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
        findings.push(warning(
          'W01',
          `${path}.recduration`,
          'The section records automatically, but this item has no duration. The recording runs until the speaker presses Next.',
        ));
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
        findings.push(warning(
          'W02',
          `${path}.mediaitems[${index}].alt`,
          'Image prompt has no alt text. Screen-reader users get no prompt, and lists show only the file name.',
        ));
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
    if (playback !== null && typeof playback === 'object'
      && (playback as Record<string, unknown>)['when'] === 'DURING'
      && (playback as Record<string, unknown>)['headphones'] !== true) {
      findings.push(warning(
        'W03',
        `${path}.playback.headphones`,
        'Playing while recording captures the sound through the microphone unless headphones are required.',
      ));
    }
  }
  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    if (playback !== null && typeof playback === 'object'
      && (playback as Record<string, unknown>)['when'] === 'DURING'
      && (playback as Record<string, unknown>)['headphones'] !== true) {
      findings.push(warning(
        'W03',
        `${ref.bankPath}.playback.headphones`,
        'Playing while recording captures the sound through the microphone unless headphones are required.',
      ));
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
      findings.push(warning(
        'W04',
        `${ref.bankPath}.playBankAudio`,
        `${withoutAudio} of the ${matchCount} matching items have no model recording. Those items would appear without sound.`,
      ));
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
    if (playback === null || typeof playback !== 'object' || (playback as Record<string, unknown>)['when'] !== 'PRERECORDING') {
      continue;
    }
    const timing = effectiveTiming(item as unknown as PromptItem);
    if (timing.playbackSpanMs !== null && timing.playbackSpanMs > timing.preDelay) {
      findings.push(warning(
        'W05',
        `${path}.playback.when`,
        `The clip is ${timing.playbackSpanMs} ms but the pre-recording delay is ${timing.preDelay} ms, so recording starts while it still plays.`,
      ));
    }
  }

  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    const when = playback !== null && typeof playback === 'object' ? (playback as Record<string, unknown>)['when'] : undefined;
    if (when !== 'PRERECORDING') {
      continue;
    }
    const durations = context.clipDurations?.(ref.bankId);
    const view = context.bankLookup?.(ref.bankId);
    if (durations === undefined || view === undefined || view === null) {
      findings.push(suspended(
        'W05',
        `${ref.bankPath}.playback.when`,
        'The drawn items\u2019 clip durations are unknown because the bank could not be read. Playback timing validation is suspended.',
      ));
      continue;
    }
    const matching = queryBank(view, filterOf(ref.bank)).items;
    const known = matching.map((bankItem) => durations.get(String(bankItem.bankItemId)));
    if (known.some((duration) => duration === undefined)) {
      findings.push(suspended(
        'W05',
        `${ref.bankPath}.playback.when`,
        'Some drawn items have no known clip duration. Playback timing validation is suspended.',
      ));
      continue;
    }
    const repeats = typeof (playback as Record<string, unknown>)['repeats'] === 'number'
      ? Math.max(1, (playback as Record<string, unknown>)['repeats'] as number)
      : 1;
    const gap = typeof (playback as Record<string, unknown>)['gap'] === 'number'
      ? Math.max(0, (playback as Record<string, unknown>)['gap'] as number)
      : DEFAULT_POST_REC_DELAY;
    const defaults = ref.bank['itemDefaults'];
    const delay = defaults !== null && typeof defaults === 'object'
      && typeof (defaults as Record<string, unknown>)['prerecdelay'] === 'number'
      ? (defaults as Record<string, unknown>)['prerecdelay'] as number
      : DEFAULT_PRE_REC_DELAY;
    const spans = known
      .map((duration) => spanMs(duration as number, repeats, gap))
      .filter((span): span is number => span !== null);
    const longest = spans.length === 0 ? null : Math.max(...spans);
    if (longest !== null && longest > delay) {
      findings.push(warning(
        'W05',
        `${ref.bankPath}.playback.when`,
        `The clip is ${longest} ms but the pre-recording delay is ${delay} ms, so recording starts while it still plays.`,
      ));
    }
  }
  return findings;
}

/** W06 — a timing field on the kind of item that ignores it. */
export function checkW06(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (isNonRecordingItem(item) && item['recduration'] !== undefined && item['recduration'] !== null) {
      findings.push(warning('W06', `${path}.recduration`, 'recduration has no effect on this kind of item.'));
    }
    if (!isNonRecordingItem(item) && item['duration'] !== undefined && item['duration'] !== null) {
      findings.push(warning('W06', `${path}.duration`, 'duration has no effect on this kind of item.'));
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
      findings.push(warning(
        'W07',
        ref.bankPath,
        'Training items are exempt from the completeness check, so a draw here consumes bank items without producing required recordings.',
      ));
    }
  }
  return findings;
}

/** W08 — more than one mediaitem; the recorder shows only the first. */
export function checkW08(draft: Draft): Finding[] {
  const findings: Finding[] = [];
  for (const {item, itemPath: path} of eachItem(draft)) {
    if (mediaitemsOf(item).length > 1) {
      findings.push({
        ...warning('W08', `${path}.mediaitems`, 'Only the first media item is shown by the recorder. The others are ignored.'),
        fix: 'keep-first-mediaitem',
      });
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
      if (playback !== null && typeof playback === 'object') {
        if ((playback as Record<string, unknown>)['replayable'] === true
          && ((playback as Record<string, unknown>)['maxReplays'] === undefined || (playback as Record<string, unknown>)['maxReplays'] === null)) {
          findings.push(warning('W09', `${path}.playback.maxReplays`, 'The speaker can replay without limit while the section advances on its own.'));
        }
        continue;
      }
      mediaitemsOf(item).forEach((mediaitem, index) => {
        if (!isAudio(mediaitem)) {
          return;
        }
        if ((mediaitem as Record<string, unknown>)['replay'] === true) {
          findings.push(warning('W09', `${path}.mediaitems[${index}].replay`, 'The speaker can replay without limit while the section advances on its own.'));
        }
      });
    }
  }
  for (const ref of eachBankSource(draft)) {
    const playback = ref.bank['playback'];
    if (playback !== null && typeof playback === 'object'
      && (playback as Record<string, unknown>)['replayable'] === true) {
      findings.push(warning('W09', `${ref.bankPath}.playback.replayable`, 'The speaker can replay without limit while the section advances on its own.'));
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
    findings.push(warning(
      'W10',
      'minRecorderVersion',
      `This script needs recorder ${required}; the deployment runs ${actual}. Playback would be skipped silently.`,
    ));
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
      const src = (mediaitem as Record<string, unknown>)?.['src'];
      if (typeof src !== 'string' || src.trim() === '') {
        return;
      }
      if (known === null) {
        findings.push(suspended('W11', `${path}.mediaitems[${mediaIndex}].src`, `${src} cannot be checked because the project\u2019s media list could not be fetched.`));
      } else if (!known.has(src)) {
        findings.push(warning('W11', `${path}.mediaitems[${mediaIndex}].src`, `${src} is not in the project's media.`));
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
    if (!isNonRecordingItem(item) || playback === null || typeof playback !== 'object') {
      continue;
    }
    const when = (playback as Record<string, unknown>)['when'];
    if (when === 'PRERECORDING' || when === 'DURING') {
      findings.push(warning(
        'W12',
        `${path}.playback.when`,
        'The item has no recording phase, so the clip plays at the wrong moment; use WITH_PROMPT, BEFORE or ONDEMAND.',
      ));
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
      findings.push({
        ...warning('W13', `${path}.playback`, 'The item declares its placement twice; `playback` wins and the mediaitem flags are ignored.'),
        data: {count: clashes.length},
      });
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
