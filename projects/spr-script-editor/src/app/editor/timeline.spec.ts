import {effectiveTiming, type PromptItem} from 'speechrecorderng';
import {promptVisibility, promptVisibilityText, segmentWeight, timelineSegments} from './timeline';

const audio = {mimetype: 'audio/wav', src: 'a.wav'};

const item = (over: Partial<PromptItem> = {}): PromptItem => ({
  itemcode: 'A',
  mediaitems: [{mimetype: 'text/plain', text: 'hello'}],
  ...over,
});

describe('timeline: segments', () => {
  it('marks an open-ended recording as hatched', () => {
    const segments = timelineSegments(effectiveTiming(item({prerecdelay: 500, postrecdelay: 300})));
    expect(segments.map((segment) => segment.kind)).toEqual(['preDelay', 'recording', 'postDelay']);
    const recording = segments.find((segment) => segment.kind === 'recording');
    expect(recording?.ms).toBeNull();
    expect(recording?.hatched).toBe(true);
  });

  it('puts a clip before the clocks when it plays with or before the prompt', () => {
    const timing = effectiveTiming(item({mediaitems: [audio], playback: {when: 'BEFORE', durationMs: 1000, repeats: 1, gap: 0}}));
    const segments = timelineSegments(timing);
    expect(segments[0]).toEqual({kind: 'playback', ms: 1000, hatched: false, overlayPlayback: false});
  });

  it('hatches the recording when the clip plays over an open microphone', () => {
    const timing = effectiveTiming(item({
      mediaitems: [audio],
      recduration: 5000,
      playback: {when: 'DURING', durationMs: 1000, repeats: 1, gap: 0},
    }));
    const recording = timelineSegments(timing).find((segment) => segment.kind === 'recording');
    expect(recording?.hatched).toBe(true);
    expect(recording?.overlayPlayback).toBe(true);
  });

  it('overlays a pre-recording clip on the pre-recording delay', () => {
    const timing = effectiveTiming(item({
      mediaitems: [audio],
      playback: {when: 'PRERECORDING', durationMs: 800, repeats: 1, gap: 0},
    }));
    const segments = timelineSegments(timing);
    expect(segments.some((segment) => segment.kind === 'playback')).toBe(false);
    expect(segments.find((segment) => segment.kind === 'preDelay')?.overlayPlayback).toBe(true);
  });

  it('gives an open-ended recording a visible width', () => {
    const segments = timelineSegments(effectiveTiming(item({prerecdelay: 1000, postrecdelay: 500})));
    const recording = segments.find((segment) => segment.kind === 'recording');
    expect(recording).toBeDefined();
    expect(segmentWeight(recording!, 1500)).toBe(1500);
    expect(segmentWeight(segments[0], 1500)).toBe(1000);
  });
});

describe('timeline: prompt visibility from promptVisibleAt', () => {
  it('is always visible without a phase, or for an information-only item', () => {
    expect(promptVisibility(undefined, undefined).kind).toBe('all');
    expect(promptVisibility('RECORDING', 'nonrecording').kind).toBe('all');
  });

  it('stays visible from a phase onward', () => {
    expect(promptVisibility('RECORDING', undefined)).toEqual({kind: 'from', phases: ['RECORDING']});
    expect(promptVisibility('PRERECORDING', undefined)).toEqual({kind: 'from', phases: ['PRE_RECORDING']});
  });

  it('is visible only during the pre-recording delay for PRERECORDINGONLY', () => {
    expect(promptVisibility('PRERECORDINGONLY', undefined)).toEqual({kind: 'only', phases: ['PRE_RECORDING']});
  });

  it('turns the classification into one sentence', () => {
    expect(promptVisibilityText('PRERECORDINGONLY', undefined)).toContain('the pre-recording delay');
    expect(promptVisibilityText(undefined, undefined).length).toBeGreaterThan(0);
  });
});
