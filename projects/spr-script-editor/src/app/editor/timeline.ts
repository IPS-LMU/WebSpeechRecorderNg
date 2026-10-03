/**
 * The inspector's timeline bar and prompt-visibility sentence (ui-spec §3.3).
 *
 * The numbers come from the library's `effectiveTiming(item)`, and the visibility answer from
 * `promptVisibleAt` — never from a local copy of the recorder's rules (README §5). This module
 * only arranges them into segments a bar can draw.
 */
import {
  ITEM_PHASES,
  promptVisibleAt,
  type EffectiveTiming,
  type ItemPhase,
  type PromptPhase,
} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {fillTemplate} from '../core/validation/interpolate';

const S = EDITOR_STRINGS;

export interface TimelineSegment {
  kind: 'playback' | 'preDelay' | 'recording' | 'postDelay';
  /** Length in ms; `null` for an open-ended recording. */
  ms: number | null;
  /** Hatch: an open-ended recording, or a clip that plays over an open microphone. */
  hatched: boolean;
  /** The clip plays inside this segment rather than before it. */
  overlayPlayback: boolean;
}

/** The bar's segments in order. A `DURING` clip hatches the recording it plays over. */
export function timelineSegments(timing: EffectiveTiming): TimelineSegment[] {
  const when = timing.playbackWhen;
  const span = timing.playbackSpanMs;
  const segments: TimelineSegment[] = [];

  if (span !== null && (when === 'WITH_PROMPT' || when === 'BEFORE')) {
    segments.push({kind: 'playback', ms: span, hatched: false, overlayPlayback: false});
  }
  segments.push({
    kind: 'preDelay',
    ms: timing.preDelay,
    hatched: false,
    overlayPlayback: when === 'PRERECORDING' && span !== null,
  });
  segments.push({
    kind: 'recording',
    ms: timing.recDuration,
    hatched: timing.recDuration === null || when === 'DURING',
    overlayPlayback: when === 'DURING' && span !== null,
  });
  segments.push({kind: 'postDelay', ms: timing.postDelay, hatched: false, overlayPlayback: false});
  return segments;
}

/** A flexible width for the segment: an open-ended recording borrows the width of the known parts. */
export function segmentWeight(segment: TimelineSegment, fallbackMs: number): number {
  if (segment.ms !== null && segment.ms > 0) {
    return segment.ms;
  }
  return segment.kind === 'recording' ? Math.max(fallbackMs, 1) : 0;
}

export type PromptVisibilityKind = 'all' | 'from' | 'only' | 'never';

export interface PromptVisibility {
  kind: PromptVisibilityKind;
  /** The first visible phase (`from`) or every visible phase (`only`). */
  phases: ItemPhase[];
}

/** Classifies the phases `promptVisibleAt` reports, without restating its rules. */
export function promptVisibility(
  promptphase: PromptPhase | undefined | null,
  itemType: string | undefined,
): PromptVisibility {
  const phases = ITEM_PHASES.filter((phase) => promptVisibleAt(promptphase, phase, itemType));
  if (phases.length === 0) {
    return {kind: 'never', phases: []};
  }
  if (phases.length === ITEM_PHASES.length) {
    return {kind: 'all', phases};
  }
  if (ITEM_PHASES.indexOf(phases[0]) === ITEM_PHASES.length - phases.length) {
    return {kind: 'from', phases: [phases[0]]};
  }
  return {kind: 'only', phases};
}

function phaseLabel(phase: ItemPhase): string {
  return S.inspector.timing.phase[phase];
}

/** The one sentence under the bar saying when the prompt becomes visible. */
export function promptVisibilityText(
  promptphase: PromptPhase | undefined | null,
  itemType: string | undefined,
): string {
  const visibility = promptVisibility(promptphase, itemType);
  const body = visibility.kind === 'all'
    ? S.inspector.timing.visibility.all
    : visibility.kind === 'never'
      ? S.inspector.timing.visibility.never
      : fillTemplate(
        visibility.kind === 'from' ? S.inspector.timing.visibility.from : S.inspector.timing.visibility.only,
        {phase: visibility.phases.map(phaseLabel).join(', ')},
      );
  return S.inspector.timing.visibilityPrefix + body;
}
