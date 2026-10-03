import {Component, input, output} from '@angular/core';
import {EDITOR_STRINGS} from '../core/editor-strings';
import type {OrderRow} from './preview-order';

/**
 * The session order list (ui-spec §4): sections, groups and items in the order a session walks
 * them, with the drawn example folded in at its place and marked drawn, plus the Re-draw button.
 * The row keys it reports are the deep-linkable state (`?item=`); the list itself is built by
 * `preview-order.ts`.
 */
@Component({
  selector: 'spre-preview-order-panel',
  template: `
    <aside class="order" aria-labelledby="order-title">
      <header class="order-head">
        <h2 id="order-title">{{ strings.preview.orderTitle }}</h2>
        <button type="button" [title]="strings.preview.redrawTitle" (click)="redraw.emit()">
          {{ strings.preview.redraw }}
        </button>
      </header>
      <p class="order-caption">{{ strings.preview.orderCaption }}</p>
      <ul class="order-list">
        @for (row of rows(); track row.key) {
          <li [attr.data-kind]="row.kind" [attr.data-depth]="row.depth"
              [class.selected]="row.key === currentKey()">
            @if (row.item !== null) {
              <button type="button" (click)="select.emit(row)"
                      [attr.aria-current]="row.key === currentKey() ? 'true' : null">
                <span class="row-label">{{ row.label }}</span>
                @if (row.drawn) {
                  <span class="mark">{{ strings.preview.drawnWord }}</span>
                }
                @if (row.detail !== null) {
                  <span class="row-detail">{{ row.detail }}</span>
                }
              </button>
            } @else {
              <p class="row-structural">
                <span class="row-label">{{ row.label }}</span>
                @if (row.kind === 'drawn-group') {
                  <span class="mark">{{ strings.preview.drawnWord }}</span>
                }
                @if (row.detail !== null) {
                  <span class="row-detail">{{ row.detail }}</span>
                }
              </p>
            }
          </li>
        }
      </ul>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .order {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: var(--spr-r-md);
      border: 1px solid var(--spr-border);
      border-radius: var(--spr-r-lg);
      background: var(--spr-surface);
    }

    .order-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spr-r-md);
    }

    .order-head h2 {
      margin: 0;
      color: var(--spr-ink-strong);
      font-size: var(--spr-type-section);
    }

    .order-head button {
      margin-left: auto;
    }

    .order-caption {
      margin: 0;
      color: var(--spr-ink-muted);
      font-size: var(--spr-type-caption);
    }

    .order-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 34rem;
      overflow-y: auto;
    }

    [data-depth='1'] {
      padding-left: 0.75rem;
    }

    [data-depth='2'] {
      padding-left: 1.5rem;
    }

    [data-depth='3'] {
      padding-left: 2.25rem;
    }

    li.selected {
      border-left: 3px solid var(--spr-select-edge);
      background: var(--spr-select-fill);
    }

    button,
    .row-structural {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
      width: 100%;
      min-height: 44px;
      margin: 0;
      padding: 0 0.4rem;
      text-align: left;
      font-family: inherit;
    }

    button {
      border: 1px solid var(--spr-border-strong);
      border-radius: var(--spr-r-sm);
      background: var(--spr-surface-2);
      color: var(--spr-ink);
      font-size: var(--spr-type-label);
      cursor: pointer;
    }

    button:focus-visible {
      outline: 2px solid var(--spr-focus);
      outline-offset: 2px;
    }

    /* The rows read as a list, not as a stack of buttons. */
    .order-list button {
      border-color: transparent;
      background: none;
    }

    .row-label {
      color: var(--spr-ink-strong);
      font-size: var(--spr-type-label);
    }

    [data-kind='section'] .row-label {
      font-size: var(--spr-type-body);
    }

    .row-detail {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--spr-ink-muted);
      font-size: var(--spr-type-caption);
    }

    .mark {
      padding: 0.1rem 0.6rem;
      border-radius: var(--spr-r-pill);
      background: var(--spr-ok);
      color: var(--spr-ok-ink);
      font-size: var(--spr-type-caption);
    }

    @media (max-width: 1100px) {
      .order-list {
        max-height: 20rem;
      }
    }
  `],
})
export class PreviewOrderPanel {
  readonly strings = EDITOR_STRINGS;

  readonly rows = input.required<OrderRow[]>();
  readonly currentKey = input.required<string | null>();
  readonly select = output<OrderRow>();
  readonly redraw = output<void>();
}
