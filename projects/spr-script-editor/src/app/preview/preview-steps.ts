/**
 * The tier-1 preview's step simulation (ui-spec §4).
 *
 * The five steps the screen offers — Idle, Listening, Pre-rec, Recording, Post-rec — are a view of
 * the library's phase machine, not a second copy of it (plan M2, E2: "no local copy of the state
 * machine", D8). `ITEM_PHASES` and `nextPhase` are the order; `promptVisibleAt` decides whether
 * the prompt is on the stage in a step, and `playbackStart`/`playbackTiming` decide where the item's
 * sound sits. The only thing this module adds is `LISTENING`: the sound that runs *before* the
 * clocks start, which the recorder models as the tail of the selection phase.
 *
 * Applicability is computed, never hidden: a step that cannot happen for the current item is
 * rendered disabled with the reason (ui-spec §4 — "steps that do not apply to the current item are
 * disabled, not hidden, so the model is legible").
 */
import {
  ITEM_PHASES,
  nextPhase,
  playbackPlan,
  playbackStart,
  promptVisibleAt,
  type ItemPhase,
  type PlaybackPlan,
  type PromptItem,
  type PromptPhase,
} from 'speechrecorderng';

export type SimStep = 'IDLE' | 'LISTENING' | 'PRE_REC' | 'RECORDING' | 'POST_REC';

/** The library phase a step shows. */
export function phaseForStep(step: SimStep): ItemPhase {
  switch (step) {
    case 'IDLE':
    case 'LISTENING':
      return 'SELECTED';
    case 'PRE_REC':
      return 'PRE_RECORDING';
    case 'RECORDING':
      return 'RECORDING';
    case 'POST_REC':
      return 'POST_RECORDING';
  }
}

/**
 * The step that shows a phase. `SELECTED` maps to Idle; the caller substitutes Listening when the
 * item's sound runs before the clocks.
 */
export function stepForPhase(phase: ItemPhase): SimStep {
  switch (phase) {
    case 'SELECTED':
      return 'IDLE';
    case 'PRE_RECORDING':
      return 'PRE_REC';
    case 'RECORDING':
      return 'RECORDING';
    case 'POST_RECORDING':
      return 'POST_REC';
  }
}

/**
 * The simulated steps in order. The tail is derived from the library's `ITEM_PHASES`, so the
 * recorder's order is the only definition of it; Listening is the inserted pre-clock state.
 */
export const SIM_STEPS: readonly SimStep[] = Object.freeze<SimStep[]>([
  'IDLE',
  'LISTENING',
  ...ITEM_PHASES.slice(1).map((phase) => stepForPhase(phase)),
]);

/** The step after `step` in the recorder's order, or null at the end of the item. */
export function nextStep(step: SimStep): SimStep | null {
  if (step === 'IDLE') {
    // Listening has no library phase of its own: it is the sound before the clocks.
    return 'LISTENING';
  }
  const phase = nextPhase(phaseForStep(step));
  return phase === null ? null : stepForPhase(phase);
}

/** The step before `step`, or null at the start of the item. */
export function previousStep(step: SimStep): SimStep | null {
  if (step === 'LISTENING') {
    return 'IDLE';
  }
  const index = ITEM_PHASES.indexOf(phaseForStep(step));
  if (index <= 1) {
    // PRE_RECORDING is the first recorded phase: Listening sits between it and Idle.
    return step === 'IDLE' ? null : 'LISTENING';
  }
  return stepForPhase(ITEM_PHASES[index - 1]);
}

/** Why a step does not happen for the item (the template turns this into a sentence). */
export type StepBlock = 'NOT_RECORDED' | 'NO_SOUND' | 'ON_DEMAND';

export interface StepView {
  step: SimStep;
  phase: ItemPhase;
  applies: boolean;
  blockedBy: StepBlock | null;
  /** The prompt is on the stage in this step (`promptVisibleAt`). */
  promptVisible: boolean;
  /** The item's sound plays in this step (`playbackStart`). */
  sound: boolean;
}

/** The step in which the item's sound plays, or null when the sound is not automatic. */
export function soundStep(plan: PlaybackPlan | null): SimStep | null {
  switch (playbackStart(plan)) {
    case 'BEFORE_CLOCKS':
      return 'LISTENING';
    case 'PRE_RECORDING':
      return 'PRE_REC';
    case 'RECORDING':
      return 'RECORDING';
    case 'OPERATOR':
    case null:
      return null;
  }
}

/** Every step of the simulation for one item, applicable or not. */
export function stepViews(
  item: PromptItem | null | undefined,
  section: {promptphase?: PromptPhase} | null | undefined,
  plan: PlaybackPlan | null = playbackPlan(item),
): StepView[] {
  const recorded = item?.type !== 'nonrecording';
  const start = playbackStart(plan);
  const at = soundStep(plan);
  return SIM_STEPS.map((step) => {
    let blockedBy: StepBlock | null = null;
    if (step === 'LISTENING') {
      if (start === null) {
        blockedBy = 'NO_SOUND';
      } else if (start === 'OPERATOR') {
        blockedBy = 'ON_DEMAND';
      }
    } else if (step !== 'IDLE' && !recorded) {
      blockedBy = 'NOT_RECORDED';
    }
    const phase = phaseForStep(step);
    return {
      step,
      phase,
      applies: blockedBy === null,
      blockedBy,
      promptVisible: promptVisibleAt(section?.promptphase, phase, item?.type),
      sound: at === step,
    };
  });
}

/**
 * The next step that applies, skipping the ones that cannot happen. Used by the transport's
 * Record/Next and by the Re-draw-independent walk; null when the item is finished.
 */
export function advanceStep(step: SimStep, applies: (candidate: SimStep) => boolean): SimStep | null {
  let candidate = nextStep(step);
  while (candidate !== null && !applies(candidate)) {
    candidate = nextStep(candidate);
  }
  return candidate;
}

/** The previous step that applies, or null before the first one. */
export function retreatStep(step: SimStep, applies: (candidate: SimStep) => boolean): SimStep | null {
  let candidate = previousStep(step);
  while (candidate !== null && !applies(candidate)) {
    candidate = previousStep(candidate);
  }
  return candidate;
}
