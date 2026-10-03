import {Component, input} from '@angular/core';
import {EDITOR_STRINGS} from '../core/editor-strings';
import type {StagePart} from './preview-stage';

/**
 * The prompt stage (ui-spec §4): the beige surface the recorder shows the prompt on, with the
 * labelled media chips — including the "Playback file not found" placeholder for a declared file
 * the project's media list does not carry (ui-spec §9). Its own component so its styles stay small
 * and it can be reused by any later screen that needs to show an item's prompt.
 */
@Component({
  selector: 'spre-preview-stage-panel',
  template: `
    <div class="stage">
      <h3 class="stage-label">{{ strings.preview.stageLabel }}</h3>
      <div class="stage-body">
        @for (part of parts(); track $index) {
          @switch (part.kind) {
            @case ('text') {
              <p class="prompt-text">{{ part.text }}</p>
            }
            @case ('prompt') {
              <p class="prompt-text">{{ part.text }}</p>
            }
            @case ('image') {
              <p class="media-chip">{{ strings.preview.stageImage }} · {{ part.text }}</p>
            }
            @case ('audio') {
              <p class="media-chip media-audio">
                {{ strings.preview.stageAudio }} · {{ part.text }}
                <span class="media-note">{{ durationLabel(part) }}</span>
              </p>
            }
            @case ('audio-missing') {
              <p class="media-chip media-missing" role="note">{{ label(part) }}</p>
            }
            @case ('bank-audio') {
              <p class="media-chip media-bank">{{ label(part) }}</p>
            }
            @default {
              <p class="media-chip media-unsupported">{{ label(part) }}</p>
            }
          }
        } @empty {
          <p class="prompt-text">{{ strings.preview.stageEmpty }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .stage {
      padding: var(--spr-r-md);
      border-radius: var(--spr-r-md);
      background: var(--spr-stage);
      color: var(--spr-stage-ink);
      min-height: 7rem;
    }

    .stage-label {
      margin: 0 0 0.4rem;
      font-size: var(--spr-type-caption);
    }

    .stage-body {
      display: flex;
      flex-direction: column;
      gap: var(--spr-r-md);
    }

    .prompt-text {
      margin: 0;
      font-size: var(--spr-type-title);
      line-height: 1.35;
    }

    .media-chip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0;
      padding: 0.35rem 0.6rem;
      border-radius: var(--spr-r-sm);
      background: var(--spr-chrome-tint);
      font-size: var(--spr-type-label);
    }

    /* A declared file the media list does not know: named, never a silent gap (ui-spec §9). */
    .media-missing {
      border: 1px dashed var(--spr-alert);
      background: var(--spr-alert);
      color: var(--spr-alert-ink);
    }
  `],
})
export class PreviewStagePanel {
  readonly strings = EDITOR_STRINGS;
  readonly parts = input.required<StagePart[]>();

  label(part: StagePart): string {
    switch (part.kind) {
      case 'audio-missing':
        return part.text === ''
          ? this.strings.preview.stageAudioNoSrc
          : `${this.strings.preview.stageAudioMissing}: ${part.text}`;
      case 'bank-audio':
        return this.strings.preview.stageBankAudio;
      case 'image':
        return `${this.strings.preview.stageImage}: ${part.text}`;
      case 'unsupported':
        return `${this.strings.preview.stageUnsupported}: ${part.text}`;
      default:
        return part.text;
    }
  }

  durationLabel(part: StagePart): string {
    if (part.durationMs === null) {
      return this.strings.preview.stageDurationUnknown;
    }
    return `${part.durationMs} ${this.strings.preview.msWord}`;
  }
}
