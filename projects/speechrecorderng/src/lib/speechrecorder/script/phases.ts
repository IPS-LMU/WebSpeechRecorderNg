/**
 * When a prompt is visible, how long an item's clocks run, and which phase follows which.
 *
 * These rules used to live inside `sessionmanager.ts`. Extracted as pure functions so the editor's
 * preview and timeline use exactly the same arithmetic as the recorder (decision D6), and so the
 * behaviour can be pinned by unit tests before either side changes it.
 *
 * The characterisation tests in `phases.spec.ts` are the oracle: the recorder's current behaviour
 * was recorded there first, then the manager was rewired to call these functions.
 */
import {Mediaitem, PromptItem, PromptPhase} from './script';
import {PromptitemUtil} from './script';
import {MAX_RECORDING_TIME_MS} from '../session/basicrecorder';
import type {PlaybackWhen, Playback} from './script';

/** Pre-recording delay when the item names neither `prerecdelay` nor the legacy `prerecording`. */
export const DEFAULT_PRE_REC_DELAY = 1000;
/** Post-recording delay when the item names neither `postrecdelay` nor the legacy `postrecording`. */
export const DEFAULT_POST_REC_DELAY = 500;

/** Where the item stands while it is being recorded. */
export type ItemPhase = 'SELECTED' | 'PRE_RECORDING' | 'RECORDING' | 'POST_RECORDING';

/** The phases in order, for the preview's step simulation. */
export const ITEM_PHASES: ReadonlyArray<ItemPhase> = ['SELECTED', 'PRE_RECORDING', 'RECORDING', 'POST_RECORDING'];

/** The phase after `phase`, or null at the end of the item. */
export function nextPhase(phase: ItemPhase): ItemPhase | null {
  const index = ITEM_PHASES.indexOf(phase);
  return index < 0 || index + 1 >= ITEM_PHASES.length ? null : ITEM_PHASES[index + 1];
}

/**
 * Whether the prompt is on the stage in this phase.
 *
 * Recorded from the manager:
 *  - a `nonrecording` item shows its prompt from the moment it is selected, at every prompt phase;
 *  - a section without `promptphase` (or with `IDLE`) shows it from selection onward;
 *  - `PRERECORDING` shows it when the take starts (the pre-recording delay);
 *  - `PRERECORDINGONLY` shows it only during the pre-recording delay, then clears it;
 *  - `RECORDING` hides it until the pre-recording delay ends, and keeps it through the post phase.
 */
export function promptVisibleAt(
  promptphase: PromptPhase | undefined | null,
  phase: ItemPhase,
  itemType: string | undefined,
): boolean {
  if (itemType === 'nonrecording') {
    return true;
  }
  switch (promptphase) {
    case 'PRERECORDINGONLY':
      return phase === 'PRE_RECORDING';
    case 'PRERECORDING':
      return phase !== 'SELECTED';
    case 'RECORDING':
      return phase === 'RECORDING' || phase === 'POST_RECORDING';
    default:
      // No promptphase, or IDLE: visible as soon as the item is selected.
      return true;
  }
}

/** Everything the timers need for one item, and what the editor's timeline shows. */
export interface EffectiveTiming {
  /** Pre-recording delay in ms. */
  preDelay: number;
  /** Recording length in ms, or null when the item runs until it is stopped. */
  recDuration: number | null;
  /** Post-recording delay in ms. */
  postDelay: number;
  /** The item's window from the moment its clocks start; an hour when `recDuration` is unset. */
  maxRecordingTimeMs: number;
  /** When the prompt sound plays (D-V = C); null when the item has no sound. */
  playbackWhen: PlaybackWhen | null;
  /** The sound that plays before the clocks when `playbackWhen` is `WITH_PROMPT`/`BEFORE`, else null. */
  promptAudio: Mediaitem | null;
  /** Clip length in ms when known, else null. */
  playbackDurationMs: number | null;
  /** The clip's span with repeats and gaps when the duration is known, else null. */
  playbackSpanMs: number | null;
}

/**
 * The item's timing. `preDelay`/`postDelay` fall back to the legacy keys exactly as the manager
 * did, and `maxRecordingTimeMs` is `preDelay + recDuration + postDelay` when the item has a
 * duration — the prompt sound and any `BEFORE` playback happen **before** the clocks start, so
 * they are not part of it.
 */
export function effectiveTiming(item: PromptItem | null | undefined): EffectiveTiming {
  const preDelay = item?.prerecdelay ?? item?.prerecording ?? DEFAULT_PRE_REC_DELAY;
  const postDelay = item?.postrecdelay ?? item?.postrecording ?? DEFAULT_POST_REC_DELAY;
  const recDuration = item?.recduration ?? null;
  const maxRecordingTimeMs = recDuration === null
    ? MAX_RECORDING_TIME_MS
    : preDelay + recDuration + postDelay;

  const plan = playbackPlan(item);
  return {
    preDelay,
    recDuration,
    postDelay,
    maxRecordingTimeMs,
    playbackWhen: plan === null ? null : plan.when,
    promptAudio: plan !== null && plan.gatesStart ? plan.mediaitem : null,
    playbackDurationMs: plan?.durationMs ?? null,
    playbackSpanMs: plan === null || plan.durationMs === null
      ? null
      : plan.durationMs * plan.repeats + plan.gap * (plan.repeats - 1),
  };
}

/** When the item's sound starts, and whether the clocks wait for it (D-V = C). */
export type PlaybackStart = 'BEFORE_CLOCKS' | 'PRE_RECORDING' | 'RECORDING' | 'OPERATOR';

/**
 * The phase in which the plan's sound plays: `BEFORE_CLOCKS` means the clocks wait for it (the
 * shipped autoplay, or an explicit `BEFORE`), `OPERATOR` means only the play control starts it.
 * Null when the item has no sound.
 */
export function playbackStart(plan: PlaybackPlan | null): PlaybackStart | null {
  if (plan === null) {
    return null;
  }
  switch (plan.when) {
    case 'BEFORE':
    case 'WITH_PROMPT':
      return 'BEFORE_CLOCKS';
    case 'PRERECORDING':
      return 'PRE_RECORDING';
    case 'DURING':
      return 'RECORDING';
    case 'ONDEMAND':
      return 'OPERATOR';
  }
}

/**
 * Where the item's sound runs relative to its clocks (L3): the manager's placement decision, kept
 * here so the contract is testable without a recording session.
 */
export type PlaybackTiming = 'CLOCKS_ONLY' | 'SOUND_GATES_CLOCKS' | 'SOUND_WITH_CLOCKS' | 'SOUND_AT_WINDOW';

export function playbackTiming(start: PlaybackStart | null): PlaybackTiming {
  switch (start) {
    case 'BEFORE_CLOCKS':
      return 'SOUND_GATES_CLOCKS';
    case 'PRE_RECORDING':
      return 'SOUND_WITH_CLOCKS';
    case 'RECORDING':
      return 'SOUND_AT_WINDOW';
    case 'OPERATOR':
    case null:
      return 'CLOCKS_ONLY';
  }
}

/** Whether the operator may still play the item's sound, given the repeats used so far. */
export function replayAllowed(plan: PlaybackPlan | null, used: number): boolean {
  if (plan === null || !(plan.replayable || plan.when === 'ONDEMAND')) {
    return false;
  }
  return plan.maxReplays === null || used < plan.maxReplays;
}

/** Whether any item of the section asks the speaker to put on headphones (D-V = C). */
export function sectionNeedsHeadphones(
  section: {groups?: Array<{promptItems?: Array<PromptItem>}>} | null | undefined,
): boolean {
  for (const group of section?.groups ?? []) {
    for (const item of group?.promptItems ?? []) {
      // A drawn placeholder asks on behalf of every item it will generate.
      if (item?.playback?.headphones === true || item?.prefill?.bank?.playback?.headphones === true) {
        return true;
      }
    }
  }
  return false;
}

/** How the item's sound is played (D-V = C). */
export interface PlaybackPlan {
  /** The prompt's audio mediaitem: the sound source and the shipped default placement. */
  mediaitem: Mediaitem;
  when: PlaybackWhen;
  /** Defaults: 1 repeat, 500 ms gap, uncapped replays. */
  repeats: number;
  gap: number;
  replayable: boolean;
  maxReplays: number | null;
  headphones: boolean;
  /** Whether the item's clocks wait for the sound (the shipped autoplay, or an explicit `BEFORE`). */
  gatesStart: boolean;
  /** Clip length in ms when the item declares it. */
  durationMs: number | null;
}

/**
 * The playback plan of an item: its first audio mediaitem plus the `playback` modifier when the
 * item has one. Without a modifier the shipped `Mediaitem.autoplay`/`replay` behaviour applies and
 * is reported as `when: 'WITH_PROMPT'`; an item whose audio is `autoplay: false` and has no
 * modifier has no plan.
 */
export function playbackPlan(item: PromptItem | null | undefined): PlaybackPlan | null {
  const modifier: Playback | undefined = item?.playback;
  let mediaitem: Mediaitem | null = null;
  if (modifier !== undefined) {
    for (const candidate of item?.mediaitems ?? []) {
      if (String(candidate?.mimetype ?? '').startsWith('audio')) {
        mediaitem = candidate;
        break;
      }
    }
  } else {
    mediaitem = PromptitemUtil.autoplayAudioitem(item);
  }
  if (mediaitem === null) {
    return null;
  }
  const shippedReplay = mediaitem.replay !== false;
  const when: PlaybackWhen = modifier?.when ?? 'WITH_PROMPT';
  return {
    mediaitem,
    when,
    repeats: Math.max(1, modifier?.repeats ?? 1),
    gap: Math.max(0, modifier?.gap ?? DEFAULT_POST_REC_DELAY),
    replayable: modifier?.replayable ?? shippedReplay,
    maxReplays: modifier?.maxReplays ?? null,
    headphones: modifier?.headphones === true,
    gatesStart: when === 'WITH_PROMPT' || when === 'BEFORE',
    durationMs: modifier?.durationMs ?? null,
  };
}
