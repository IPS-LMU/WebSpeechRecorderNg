import {Component, input, output} from '@angular/core';
import {EDITOR_STRINGS} from '../core/editor-strings';

/**
 * The transport bar of the mock speaker frame (ui-spec §4). It is a *mock* transport: the buttons
 * move the simulated step and the selected item, they never touch a recorder. A control whose
 * target the item does not have (no replay left, a step the item cannot reach, the ends of the
 * order list) is disabled with the reason in its title.
 */
@Component({
  selector: 'spre-preview-transport-bar',
  template: `
    <div class="transport" role="group" [attr.aria-label]="strings.preview.transportLabel">
      <button type="button" [disabled]="!canPrevious()" [title]="title(canPrevious())"
              (click)="previous.emit()">{{ strings.preview.transportPrevious }}</button>
      <button type="button" [disabled]="!canReplay()" [title]="replayTitle()"
              (click)="play.emit()">{{ strings.preview.transportPlay }}</button>
      <button type="button" [disabled]="!canRecord()" [title]="title(canRecord())"
              (click)="record.emit()">{{ strings.preview.transportRecord }}</button>
      <button type="button" [disabled]="!canStop()" [title]="title(canStop())"
              (click)="stop.emit()">{{ strings.preview.transportStop }}</button>
      <button type="button" [disabled]="!canNext()" [title]="title(canNext())"
              (click)="next.emit()">{{ strings.preview.transportNext }}</button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .transport {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
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
export class PreviewTransportBar {
  readonly strings = EDITOR_STRINGS;

  readonly canPrevious = input.required<boolean>();
  readonly canReplay = input.required<boolean>();
  readonly canRecord = input.required<boolean>();
  readonly canStop = input.required<boolean>();
  readonly canNext = input.required<boolean>();
  readonly replayTitle = input.required<string>();

  readonly previous = output<void>();
  readonly play = output<void>();
  readonly record = output<void>();
  readonly stop = output<void>();
  readonly next = output<void>();

  title(enabled: boolean): string {
    return enabled ? this.strings.preview.transportTitle : this.strings.preview.transportDisabledTitle;
  }
}
