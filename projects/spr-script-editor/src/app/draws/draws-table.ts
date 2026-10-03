import {Component, input, output} from '@angular/core';
import {DRAWS_STRINGS} from './draws-strings';
import {firstItemcodes, statusKind, type DrawItemModel, type DrawRowModel} from './draws-map';
import {speakerLabel} from './draws-speaker';

/**
 * The session table of the resolved-draws screen (ui-spec §7): one row per drawn session, with its
 * status, its drawn/recorded counts and the first itemcodes. Selecting a row is the screen's
 * deep-linkable state (`?session=`), so the row is a real button and the selected row carries
 * `aria-current`.
 */
@Component({
  selector: 'spre-draws-table',
  standalone: true,
  imports: [],
  templateUrl: './draws-table.html',
  styleUrl: './draws-table.scss',
})
export class DrawsTable {
  readonly strings = DRAWS_STRINGS;
  readonly statusKind = statusKind;
  readonly speakerLabel = speakerLabel;

  readonly rows = input.required<DrawRowModel[]>();
  readonly selectedId = input<string | null>(null);
  readonly select = output<string>();

  itemcodes(items: DrawItemModel[]): string {
    return firstItemcodes(items);
  }
}
