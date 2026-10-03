import {Component, input, output} from '@angular/core';
import {PREVIEW_STRINGS} from './preview-strings';
import {advanceStep, retreatStep, type SimStep, type StepView} from './preview-steps';

/**
 * The step simulation (ui-spec §4): Idle, Listening, Pre-rec, Recording, Post-rec as a
 * `role="radiogroup"` (ui-spec §8). A step the item cannot reach is disabled with the reason in its
 * title — never hidden — and the arrow keys move along the applicable steps, which is the
 * radiogroup behaviour §8 asks for. The step order and applicability are computed by
 * `preview-steps.ts` from the library's phase table; this component only draws them.
 */
@Component({
  selector: 'spre-preview-step-simulation',
  template: `
    <section class="simulation" aria-labelledby="sim-label">
      <h3 id="sim-label">{{ strings.stepsLabel }}</h3>
      <div class="steps" role="radiogroup" [attr.aria-label]="strings.stepsLabel"
           (keydown)="onKeydown($event)">
        @for (view of views(); track view.step) {
          <button type="button" class="step" role="radio"
                  [attr.aria-checked]="view.step === current()"
                  [attr.tabindex]="view.step === current() ? 0 : -1"
                  [disabled]="!view.applies"
                  [title]="title(view)"
                  (click)="select.emit(view.step)">
            <span class="step-name">{{ name(view.step) }}</span>
            <span class="step-flags">
              <span class="step-flag">
                {{ view.promptVisible ? strings.stepPromptVisible : strings.stepPromptHidden }}
              </span>
              <span class="step-flag">
                {{ view.sound ? strings.stepSoundPlays : strings.stepSoundSilent }}
              </span>
            </span>
          </button>
        }
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .simulation {
      padding: var(--spr-r-md);
      border: 1px solid var(--spr-border);
      border-radius: var(--spr-r-lg);
      background: var(--spr-surface);
    }

    h3 {
      margin: 0 0 0.5rem;
      color: var(--spr-ink-strong);
      font-size: var(--spr-type-section);
    }

    .steps {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.4rem;
    }

    .step {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-start;
      min-height: 44px;
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--spr-border-strong);
      border-radius: var(--spr-r-sm);
      background: var(--spr-surface-2);
      color: var(--spr-ink);
      font-family: inherit;
      font-size: var(--spr-type-label);
      text-align: left;
      cursor: pointer;
    }

    .step[aria-checked='true'] {
      border-color: var(--spr-select-edge);
      background: var(--spr-select-fill);
    }

    .step:focus-visible {
      outline: 2px solid var(--spr-focus);
      outline-offset: 2px;
    }

    .step:disabled {
      background: var(--spr-disabled-bg);
      color: var(--spr-ink-disabled);
      cursor: not-allowed;
    }

    .step-name {
      color: inherit;
      font-size: var(--spr-type-body);
    }

    .step-flags {
      display: flex;
      flex-direction: column;
    }

    .step-flag {
      color: var(--spr-ink-muted);
      font-size: var(--spr-type-caption);
    }

    .step:disabled .step-flag {
      color: inherit;
    }

    @media (max-width: 700px) {
      .steps {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `],
})
export class PreviewStepSimulation {
  readonly strings = PREVIEW_STRINGS;

  readonly views = input.required<StepView[]>();
  readonly current = input.required<SimStep>();
  readonly select = output<SimStep>();

  name(step: SimStep): string {
    switch (step) {
      case 'IDLE':
        return this.strings.stepIdle;
      case 'LISTENING':
        return this.strings.stepListening;
      case 'PRE_REC':
        return this.strings.stepPreRec;
      case 'RECORDING':
        return this.strings.stepRecording;
      case 'POST_REC':
        return this.strings.stepPostRec;
    }
  }

  title(view: StepView): string {
    if (view.applies) {
      return this.status(view.step);
    }
    switch (view.blockedBy) {
      case 'NOT_RECORDED':
        return this.strings.stepBlockNotRecorded;
      case 'NO_SOUND':
        return this.strings.stepBlockNoSound;
      case 'ON_DEMAND':
        return this.strings.stepBlockOnDemand;
      default:
        // Unreachable in practice (`applies` is exactly `blockedBy === null`); the generic
        // "no target for the selected item" sentence is the honest fallback.
        return this.strings.transportDisabledTitle;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) {
      return;
    }
    event.preventDefault();
    const applies = (candidate: SimStep) => this.views().find((view) => view.step === candidate)?.applies === true;
    const next = forward ? advanceStep(this.current(), applies) : retreatStep(this.current(), applies);
    if (next !== null) {
      this.select.emit(next);
    }
  }

  private status(step: SimStep): string {
    switch (step) {
      case 'IDLE':
        return this.strings.statusIdle;
      case 'LISTENING':
        return this.strings.statusListening;
      case 'PRE_REC':
        return this.strings.statusPreRec;
      case 'RECORDING':
        return this.strings.statusRecording;
      case 'POST_REC':
        return this.strings.statusPostRec;
    }
  }
}
