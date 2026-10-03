import {Component, computed, input, output} from '@angular/core';
import {PREVIEW_STRINGS} from './preview-strings';

/** Which lamps of the traffic light are lit (ui-spec §4: the recorder's three plus playback). */
export interface Lamps {
  hold: boolean;
  cue: boolean;
  live: boolean;
  playback: boolean;
}

/**
 * The playing state and the signal (ui-spec §4, §8): the level display, the replay control that the
 * item's `replayAllowed` decides, the three-lamp traffic light plus the fourth playback lamp, and
 * the status line. The lamps and the meter are `aria-hidden`: the status line always says the same
 * thing in words, which is what §8 requires of this screen.
 */
@Component({
  selector: 'spre-preview-playback-panel',
  template: `
    <div class="playing" [attr.data-active]="level() > 0">
      <div class="level">
        <p class="level-label" aria-hidden="true">
          {{ strings.levelValue }} {{ level() }}{{ strings.percent }}
        </p>
        <div class="level-meter" aria-hidden="true">
          @for (segment of segments; track segment) {
            <span class="level-segment" [class.lit]="segment < litSegments()"></span>
          }
        </div>
        <p class="level-caption">{{ strings.levelLabel }}</p>
      </div>
      <div class="replay">
        <button type="button" [disabled]="!canReplay()" [title]="replayTitle()" (click)="replay.emit()">
          {{ strings.replay }}
        </button>
        <p class="replay-count">{{ strings.replaysUsed }}: {{ replayCount() }}</p>
      </div>
    </div>

    <div class="signal">
      <div class="lights">
        <div class="housing" aria-hidden="true">
          <span class="lamp lamp-hold" [class.lit]="lamps().hold"></span>
          <span class="lamp lamp-cue" [class.lit]="lamps().cue"></span>
          <span class="lamp lamp-live" [class.lit]="lamps().live"></span>
        </div>
        <div class="housing housing-playback" aria-hidden="true">
          <span class="lamp lamp-playback" [class.lit]="lamps().playback"></span>
        </div>
        <p class="lamp-caption">{{ strings.lampPlayback }}</p>
      </div>
      <p class="status" role="status" aria-live="polite">{{ status() }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--spr-r-md);
    }

    .playing,
    .signal {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spr-r-md);
    }

    .playing {
      padding: 0.6rem 0.9rem;
      border-radius: var(--spr-r-md);
      background: var(--spr-surface-2);
    }

    .playing[data-active='true'] {
      background: var(--spr-surface-3);
    }

    .level,
    .replay {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .level-label {
      margin: 0;
      color: var(--spr-ink-strong);
      font-size: var(--spr-type-label);
    }

    .level-meter {
      display: flex;
      gap: 2px;
    }

    .level-segment {
      width: 8px;
      height: 18px;
      border-radius: 2px;
      background: var(--spr-disabled-bg);
    }

    .level-segment.lit {
      background: var(--spr-ok);
    }

    .replay {
      margin-left: auto;
      align-items: flex-end;
    }

    .level-caption,
    .replay-count,
    .lamp-caption {
      margin: 0;
      color: var(--spr-ink-muted);
      font-size: var(--spr-type-caption);
    }

    .lights {
      display: flex;
      align-items: flex-end;
      gap: 0.4rem;
    }

    .housing {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border-radius: var(--spr-r-md);
      background: var(--spr-black);
      box-shadow: inset 0 0 0 1px var(--spr-housing-edge);
    }

    .lamp {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--spr-lamp-off);
      box-shadow: inset 0 0 0 1px var(--spr-canvas-grid);
    }

    .lamp-hold.lit {
      background: var(--spr-alert);
      box-shadow: inset 0 0 0 2px var(--spr-alert-ink);
    }

    .lamp-cue.lit {
      background: var(--spr-caution);
      box-shadow: inset 0 0 0 2px var(--spr-caution-ink);
    }

    .lamp-live.lit {
      background: var(--spr-ok);
      box-shadow: inset 0 0 0 2px var(--spr-ok-ink);
    }

    /* The fourth lamp: playback, beside the traffic light but not one of its states. */
    .lamp-playback.lit {
      background: var(--spr-chrome-ink);
    }

    .status {
      margin: 0;
      color: var(--spr-ink-strong);
      font-size: var(--spr-type-body);
    }

    button {
      min-height: 44px;
      padding: 0 0.8rem;
      border: 1px solid var(--spr-border-strong);
      border-radius: var(--spr-r-sm);
      background: var(--spr-surface-2);
      color: var(--spr-ink);
      font-family: inherit;
      font-size: var(--spr-type-label);
      cursor: pointer;
    }

    button:focus-visible {
      outline: 2px solid var(--spr-focus);
      outline-offset: 2px;
    }

    button:disabled {
      background: var(--spr-disabled-bg);
      color: var(--spr-ink-disabled);
      cursor: not-allowed;
    }
  `],
})
export class PreviewPlaybackPanel {
  readonly strings = PREVIEW_STRINGS;
  readonly segments = Array.from({length: 12}, (_, index) => index);
  readonly litSegments = computed(() => Math.round((this.level() / 100) * this.segments.length));

  readonly lamps = input.required<Lamps>();
  readonly status = input.required<string>();
  readonly level = input.required<number>();
  readonly canReplay = input.required<boolean>();
  readonly replayCount = input.required<string>();
  readonly replayTitle = input.required<string>();
  readonly replay = output<void>();
}
