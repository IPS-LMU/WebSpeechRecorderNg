import {Component, computed, input} from '@angular/core';
import type {EffectiveTiming, PromptPhase} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {segmentWeight, timelineSegments, promptVisibilityText, type TimelineSegment} from '../timeline';

/**
 * The timeline bar at the end of the inspector's timing block (ui-spec §3.3). It draws playback,
 * the pre-recording delay, the recording and the post-recording delay proportionally, hatches an
 * open-ended recording and a clip that plays over an open microphone, and states when the prompt
 * becomes visible. The values come from `effectiveTiming`; the sentence from `promptVisibleAt`.
 */
@Component({
  selector: 'spr-editor-timeline',
  templateUrl: './editor-timeline.html',
  styleUrl: './editor-timeline.scss',
})
export class EditorTimeline {
  readonly timing = input.required<EffectiveTiming>();
  readonly promptphase = input<PromptPhase | undefined>(undefined);
  readonly itemType = input<string | undefined>(undefined);

  readonly strings = EDITOR_STRINGS;

  readonly segments = computed(() => timelineSegments(this.timing()));

  readonly total = computed(() => {
    const segments = this.segments();
    const known = segments.reduce((sum, segment) => sum + (segment.ms ?? 0), 0);
    return segments.reduce((sum, segment) => sum + segmentWeight(segment, known), 0) || 1;
  });

  readonly sentence = computed(() => promptVisibilityText(this.promptphase(), this.itemType()));

  readonly ariaLabel = computed(() => `${this.strings.inspector.timing.previewLabel} ${this.sentence()}`);

  widthPercent(segment: TimelineSegment): number {
    const segments = this.segments();
    const known = segments.reduce((sum, other) => sum + (other.ms ?? 0), 0);
    return (segmentWeight(segment, known) / this.total()) * 100;
  }

  label(segment: TimelineSegment): string {
    switch (segment.kind) {
      case 'playback':
        return this.strings.inspector.timing.playbackSpan;
      case 'preDelay':
        return this.strings.inspector.timing.preRecording;
      case 'recording':
        return this.strings.inspector.timing.recording;
      default:
        return this.strings.inspector.timing.postRecording;
    }
  }

  millis(segment: TimelineSegment): string {
    return segment.ms === null
      ? this.strings.centre.recUnbounded
      : `${Math.round(segment.ms)} ms`;
  }
}
