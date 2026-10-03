import {ITEM_PHASES, nextPhase, playbackPlan, type ItemPhase, type PromptItem} from 'speechrecorderng';
import {
  advanceStep,
  nextStep,
  phaseForStep,
  previousStep,
  retreatStep,
  SIM_STEPS,
  soundStep,
  stepForPhase,
  stepViews,
} from './preview-steps';

const AUDIO = {mimetype: 'audio/wav', src: 'media/model-01.wav'};
const TEXT = {mimetype: 'text/plain', text: 'Say the sentence.'};

function recording(extra: Partial<PromptItem> = {}): PromptItem {
  return {itemcode: 'P1', mediaitems: [TEXT, AUDIO], prerecdelay: 500, recduration: 4000, ...extra};
}

describe('preview step simulation', () => {
  it('derives its order from the library phase table', () => {
    expect(SIM_STEPS).toEqual(['IDLE', 'LISTENING', 'PRE_REC', 'RECORDING', 'POST_REC']);
    expect(SIM_STEPS.slice(2).map((step) => phaseForStep(step))).toEqual([...ITEM_PHASES.slice(1)]);
  });

  it('walks the recorded phases with nextPhase, not with a local order', () => {
    let phase: ItemPhase = ITEM_PHASES[0];
    for (const step of SIM_STEPS.slice(2)) {
      phase = nextPhase(phase) as ItemPhase;
      expect(phaseForStep(step)).toBe(phase);
    }

    expect(nextStep('IDLE')).toBe('LISTENING');
    expect(nextStep('LISTENING')).toBe('PRE_REC');
    expect(nextStep('RECORDING')).toBe('POST_REC');
    expect(nextStep('POST_REC')).toBeNull();
    expect(stepForPhase('SELECTED')).toBe('IDLE');
  });

  it('walks backwards through the same order', () => {
    expect(previousStep('POST_REC')).toBe('RECORDING');
    expect(previousStep('RECORDING')).toBe('PRE_REC');
    expect(previousStep('PRE_REC')).toBe('LISTENING');
    expect(previousStep('LISTENING')).toBe('IDLE');
    expect(previousStep('IDLE')).toBeNull();
  });

  it('places the sound by `playbackStart`', () => {
    expect(soundStep(playbackPlan(recording()))).toBe('LISTENING');
    expect(soundStep(playbackPlan(recording({playback: {when: 'BEFORE'}})))).toBe('LISTENING');
    expect(soundStep(playbackPlan(recording({playback: {when: 'PRERECORDING'}})))).toBe('PRE_REC');
    expect(soundStep(playbackPlan(recording({playback: {when: 'DURING'}})))).toBe('RECORDING');
    expect(soundStep(playbackPlan(recording({playback: {when: 'ONDEMAND'}})))).toBeNull();
    expect(soundStep(null)).toBeNull();
  });

  it('disables the steps an item cannot reach, and says why', () => {
    const views = stepViews(recording(), {promptphase: 'IDLE'});

    expect(views.map((view) => view.applies)).toEqual([true, true, true, true, true]);
    expect(views.map((view) => view.blockedBy)).toEqual([null, null, null, null, null]);
    expect(views.map((view) => view.sound)).toEqual([false, true, false, false, false]);
  });

  it('shows the sound of a during-recording item in the recording step', () => {
    const views = stepViews(recording({playback: {when: 'DURING'}}), {promptphase: 'IDLE'});
    const sound = views.find((view) => view.sound);

    expect(sound?.step).toBe('RECORDING');
  });

  it('blocks Listening when the item has no sound at all', () => {
    const views = stepViews({itemcode: 'N1', mediaitems: [TEXT]}, {promptphase: 'IDLE'});
    const listening = views.find((view) => view.step === 'LISTENING');

    expect(listening?.applies).toBe(false);
    expect(listening?.blockedBy).toBe('NO_SOUND');
  });

  it('blocks Listening when only the operator can start the sound', () => {
    const views = stepViews(recording({playback: {when: 'ONDEMAND'}}), {promptphase: 'IDLE'});
    const listening = views.find((view) => view.step === 'LISTENING');

    expect(listening?.applies).toBe(false);
    expect(listening?.blockedBy).toBe('ON_DEMAND');
    expect(views.filter((view) => view.sound)).toEqual([]);
  });

  it('blocks the take steps of a non-recording item', () => {
    const views = stepViews(
      {itemcode: 'B1', type: 'nonrecording', mediaitems: [TEXT, AUDIO]},
      {promptphase: 'RECORDING'},
    );

    expect(views.map((view) => view.applies)).toEqual([true, true, false, false, false]);
    expect(views.slice(2).map((view) => view.blockedBy)).toEqual(['NOT_RECORDED', 'NOT_RECORDED', 'NOT_RECORDED']);
    // A non-recording item keeps its prompt up in every step (promptVisibleAt).
    expect(views.every((view) => view.promptVisible)).toBe(true);
  });

  it('reads prompt visibility from the section phase', () => {
    const phaseOf = (promptphase: 'IDLE' | 'PRERECORDING' | 'PRERECORDINGONLY' | 'RECORDING' | undefined) =>
      stepViews(recording(), {promptphase}).map((view) => view.promptVisible);

    expect(phaseOf('RECORDING')).toEqual([false, false, false, true, true]);
    expect(phaseOf('PRERECORDINGONLY')).toEqual([false, false, true, false, false]);
    expect(phaseOf('PRERECORDING')).toEqual([false, false, true, true, true]);
    expect(phaseOf('IDLE')).toEqual([true, true, true, true, true]);
    expect(phaseOf(undefined)).toEqual([true, true, true, true, true]);
  });

  it('advances only through the steps that apply', () => {
    const all = () => true;
    const none = (candidate: string) => candidate === 'IDLE';

    expect(advanceStep('IDLE', all)).toBe('LISTENING');
    expect(advanceStep('IDLE', none)).toBeNull();
    expect(advanceStep('POST_REC', all)).toBeNull();

    // A non-recording item: only Idle and Listening happen, so the walk stops after Listening.
    const views = stepViews({itemcode: 'B1', type: 'nonrecording', mediaitems: [TEXT, AUDIO]}, {promptphase: 'IDLE'});
    const applies = (candidate: (typeof views)[number]['step']) =>
      views.find((view) => view.step === candidate)?.applies === true;
    expect(advanceStep('IDLE', applies)).toBe('LISTENING');
    expect(advanceStep('LISTENING', applies)).toBeNull();
  });

  it('retreats only through the steps that apply', () => {
    const all = () => true;

    expect(retreatStep('POST_REC', all)).toBe('RECORDING');
    expect(retreatStep('LISTENING', all)).toBe('IDLE');
    expect(retreatStep('IDLE', all)).toBeNull();
  });
});
