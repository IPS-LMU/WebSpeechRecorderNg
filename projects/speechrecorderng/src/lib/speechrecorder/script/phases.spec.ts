/**
 * Characterisation tests for `phases.ts`.
 *
 * These pin the behaviour the recorder had before the extraction (sessionmanager.ts), so the
 * manager can be rewired to call this module without changing what a session does — and so the
 * editor's preview and timeline share the same arithmetic.
 */
import {MAX_RECORDING_TIME_MS} from '../session/basicrecorder';
import {ITEM_PHASES, effectiveTiming, nextPhase, playbackPlan, playbackStart, promptVisibleAt} from './phases';
import {PromptItem} from './script';

const item = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  itemcode: '1',
  mediaitems: [{mimetype: 'text/plain', text: 'x'}],
  ...overrides,
});

const audio = {mimetype: 'audio/wav', src: 'media/a.wav'};

describe('phases', () => {
  describe('prompt visibility', () => {
    it('shows the prompt from selection when promptphase is missing or IDLE', () => {
      for (const phase of ITEM_PHASES) {
        expect(promptVisibleAt(undefined, phase, undefined)).toBe(true);
        expect(promptVisibleAt('IDLE', phase, undefined)).toBe(true);
      }
    });

    it('shows a PRERECORDING prompt only once the take has started', () => {
      expect(promptVisibleAt('PRERECORDING', 'SELECTED', undefined)).toBe(false);
      expect(promptVisibleAt('PRERECORDING', 'PRE_RECORDING', undefined)).toBe(true);
      expect(promptVisibleAt('PRERECORDING', 'RECORDING', undefined)).toBe(true);
      expect(promptVisibleAt('PRERECORDING', 'POST_RECORDING', undefined)).toBe(true);
    });

    it('shows a PRERECORDINGONLY prompt only during the pre-recording delay', () => {
      expect(promptVisibleAt('PRERECORDINGONLY', 'SELECTED', undefined)).toBe(false);
      expect(promptVisibleAt('PRERECORDINGONLY', 'PRE_RECORDING', undefined)).toBe(true);
      expect(promptVisibleAt('PRERECORDINGONLY', 'RECORDING', undefined)).toBe(false);
      expect(promptVisibleAt('PRERECORDINGONLY', 'POST_RECORDING', undefined)).toBe(false);
    });

    it('hides a RECORDING prompt until the pre-recording delay ends', () => {
      expect(promptVisibleAt('RECORDING', 'SELECTED', undefined)).toBe(false);
      expect(promptVisibleAt('RECORDING', 'PRE_RECORDING', undefined)).toBe(false);
      expect(promptVisibleAt('RECORDING', 'RECORDING', undefined)).toBe(true);
      expect(promptVisibleAt('RECORDING', 'POST_RECORDING', undefined)).toBe(true);
    });

    it('always shows the prompt of a nonrecording item', () => {
      const phases: Array<'IDLE' | 'PRERECORDING' | 'PRERECORDINGONLY' | 'RECORDING' | undefined> =
        [undefined, 'IDLE', 'PRERECORDING', 'PRERECORDINGONLY', 'RECORDING'];
      for (const phase of phases) {
        for (const itemPhase of ITEM_PHASES) {
          expect(promptVisibleAt(phase, itemPhase, 'nonrecording')).toBe(true);
        }
      }
    });
  });

  describe('timing', () => {
    it('uses the documented defaults when nothing is set', () => {
      const timing = effectiveTiming(item());
      expect(timing.preDelay).toBe(1000);
      expect(timing.postDelay).toBe(500);
      expect(timing.recDuration).toBeNull();
      expect(timing.maxRecordingTimeMs).toBe(MAX_RECORDING_TIME_MS);
    });

    it('reads the legacy keys as fallbacks', () => {
      const timing = effectiveTiming(item({prerecording: 250, postrecording: 125}));
      expect(timing.preDelay).toBe(250);
      expect(timing.postDelay).toBe(125);
    });

    it('prefers the modern keys over the legacy ones', () => {
      const timing = effectiveTiming(item({prerecording: 250, prerecdelay: 300, postrecording: 125, postrecdelay: 175}));
      expect(timing.preDelay).toBe(300);
      expect(timing.postDelay).toBe(175);
    });

    it('sums the window when the item has a duration', () => {
      const timing = effectiveTiming(item({prerecdelay: 1000, recduration: 4000, postrecdelay: 500}));
      expect(timing.recDuration).toBe(4000);
      expect(timing.maxRecordingTimeMs).toBe(5500);
    });
  });

  describe('playback plan', () => {
    it('uses the shipped autoplay mediaitem when the item has no modifier', () => {
      const plan = playbackPlan(item({mediaitems: [audio]}));
      expect(plan).not.toBeNull();
      expect(plan?.when).toBe('WITH_PROMPT');
      expect(plan?.gatesStart).toBe(true);
      expect(plan?.repeats).toBe(1);
      expect(plan?.replayable).toBe(true);
      expect(plan?.maxReplays).toBeNull();
      expect(plan?.headphones).toBe(false);
    });

    it('reports no plan for an audio item that is not autoplayed and has no modifier', () => {
      expect(playbackPlan(item({mediaitems: [{...audio, autoplay: false}]}))).toBeNull();
    });

    it('takes placement, repeats, cap and headphones from the modifier', () => {
      const plan = playbackPlan(item({
        mediaitems: [{...audio, autoplay: false}],
        playback: {when: 'DURING', repeats: 2, gap: 300, replayable: false, maxReplays: 2, headphones: true, durationMs: 1000},
      }));
      expect(plan?.when).toBe('DURING');
      expect(plan?.gatesStart).toBe(false);
      expect(plan?.repeats).toBe(2);
      expect(plan?.gap).toBe(300);
      expect(plan?.replayable).toBe(false);
      expect(plan?.maxReplays).toBe(2);
      expect(plan?.headphones).toBe(true);
    });

    it('makes the item clocks wait only for WITH_PROMPT and BEFORE', () => {
      for (const when of ['WITH_PROMPT', 'BEFORE'] as const) {
        expect(playbackPlan(item({mediaitems: [audio], playback: {when}}))?.gatesStart).toBe(true);
      }
      for (const when of ['PRERECORDING', 'DURING', 'ONDEMAND'] as const) {
        expect(playbackPlan(item({mediaitems: [audio], playback: {when}}))?.gatesStart).toBe(false);
      }
    });

    it('reports the clip span with repeats and gaps when the length is known', () => {
      const before = effectiveTiming(item({mediaitems: [audio], playback: {when: 'BEFORE', repeats: 3, gap: 500, durationMs: 1000}}));
      expect(before.playbackWhen).toBe('BEFORE');
      expect(before.promptAudio).not.toBeNull();
      expect(before.playbackDurationMs).toBe(1000);
      expect(before.playbackSpanMs).toBe(1000 * 3 + 500 * 2);

      const during = effectiveTiming(item({mediaitems: [audio], playback: {when: 'DURING', durationMs: 1000}}));
      expect(during.promptAudio).toBeNull();
      expect(during.playbackSpanMs).toBe(1000);

      const unknown = effectiveTiming(item({mediaitems: [audio], playback: {when: 'BEFORE'}}));
      expect(unknown.promptAudio).not.toBeNull();
      expect(unknown.playbackDurationMs).toBeNull();
      expect(unknown.playbackSpanMs).toBeNull();
    });
  });

  describe('playback placement', () => {
    const planOf = (playback?: {when: 'WITH_PROMPT' | 'BEFORE' | 'PRERECORDING' | 'DURING' | 'ONDEMAND'}) =>
      playbackPlan(item({mediaitems: [audio], playback}));

    it('maps each placement to where the sound starts', () => {
      expect(playbackStart(null)).toBeNull();
      expect(playbackStart(planOf({when: 'WITH_PROMPT'}))).toBe('BEFORE_CLOCKS');
      expect(playbackStart(planOf({when: 'BEFORE'}))).toBe('BEFORE_CLOCKS');
      expect(playbackStart(planOf({when: 'PRERECORDING'}))).toBe('PRE_RECORDING');
      expect(playbackStart(planOf({when: 'DURING'}))).toBe('RECORDING');
      expect(playbackStart(planOf({when: 'ONDEMAND'}))).toBe('OPERATOR');
    });

    it('keeps the shipped autoplay as the default placement', () => {
      expect(playbackStart(playbackPlan(item({mediaitems: [audio]})))).toBe('BEFORE_CLOCKS');
      expect(playbackStart(playbackPlan(item({mediaitems: [{...audio, autoplay: false}]})))).toBeNull();
    });
  });

  describe('phase order', () => {
    it('walks SELECTED, PRE_RECORDING, RECORDING, POST_RECORDING and then ends', () => {
      expect(ITEM_PHASES).toEqual(['SELECTED', 'PRE_RECORDING', 'RECORDING', 'POST_RECORDING']);
      expect(nextPhase('SELECTED')).toBe('PRE_RECORDING');
      expect(nextPhase('PRE_RECORDING')).toBe('RECORDING');
      expect(nextPhase('RECORDING')).toBe('POST_RECORDING');
      expect(nextPhase('POST_RECORDING')).toBeNull();
    });
  });
});
