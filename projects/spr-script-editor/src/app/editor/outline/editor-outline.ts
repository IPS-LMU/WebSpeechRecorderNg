import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from '@angular/cdk/scrolling';
import {Component, computed, input, output, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {fillTemplate} from '../../core/validation/interpolate';
import type {Finding} from '../../core/validation';
import type {EditorScript} from '../../core/script.model';
import {filterOutline, flattenOutline, type OutlineRow} from '../outline';
import type {RowMarkers} from '../markers';
import {formatSelection, selectionEquals, type Selection} from '../selection';

const VIRTUAL_THRESHOLD = 300;

/**
 * The outline column (ui-spec §3.1): a flattened tree of buttons, a filter that keeps the
 * ancestors of matches, and virtual scrolling above 300 rows. Reordering is M3, so the move
 * affordances are visible but disabled with a title saying so.
 */
@Component({
  selector: 'spr-editor-outline',
  // The fixed-size directive is what actually reads `itemSize` (CDK 20 throws without it), so it is
  // imported explicitly rather than relying on the whole ScrollingModule.
  imports: [NgTemplateOutlet, CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  templateUrl: './editor-outline.html',
  styleUrl: './editor-outline.scss',
})
export class EditorOutline {
  readonly script = input<EditorScript | null>(null);
  readonly findings = input<ReadonlyArray<Finding>>([]);
  readonly selection = input<Selection>({kind: 'script'});
  readonly bankNames = input<ReadonlyMap<string, string>>(new Map());

  readonly select = output<Selection>();

  readonly strings = EDITOR_STRINGS;
  readonly filter = signal('');
  readonly focusKey = signal<string | null>('script');

  readonly rows = computed(() => flattenOutline(this.script(), this.findings(), {bankNames: this.bankNames()}));
  readonly visible = computed(() => filterOutline(this.rows(), this.filter()));
  readonly virtual = computed(() => this.rows().length > VIRTUAL_THRESHOLD);

  readonly trackKey = (index: number, row: OutlineRow): string => row.key;

  isCurrent(row: OutlineRow): boolean {
    return selectionEquals(row.selection, this.selection());
  }

  choose(row: OutlineRow): void {
    this.focusKey.set(row.key);
    this.select.emit(row.selection);
  }

  drawnText(marker: {count: number; bank: string}): string {
    return fillTemplate(this.strings.outline.drawnMarker, {count: marker.count, bank: marker.bank});
  }

  onFilterInput(value: string): void {
    this.filter.set(value);
  }

  clearFilter(): void {
    this.filter.set('');
  }

  /** Arrow navigation inside the outline (ui-spec §8). `Enter` selects the focused row. */
  onKeydown(event: KeyboardEvent): void {
    const rows = this.visible();
    if (rows.length === 0) {
      return;
    }
    const currentIndex = Math.max(0, rows.findIndex((row) => row.key === this.focusKey()));
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(rows, Math.min(currentIndex + 1, rows.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(rows, Math.max(currentIndex - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this.moveFocus(rows, 0);
        break;
      case 'End':
        event.preventDefault();
        this.moveFocus(rows, rows.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        this.select.emit(rows[currentIndex].selection);
        break;
      default:
        break;
    }
  }

  private moveFocus(rows: ReadonlyArray<OutlineRow>, index: number): void {
    const row = rows[index];
    this.focusKey.set(row.key);
    document.getElementById(this.rowId(row))?.focus();
  }

  rowId(row: OutlineRow): string {
    return `outline-${formatSelection(row.selection).replace(/[^\w]+/g, '-')}`;
  }

  /** Exposed for the template; the markers come straight from `markers.ts`. */
  markerTitle(marker: keyof RowMarkers): string {
    switch (marker) {
      case 'drawn':
        return this.strings.outline.drawnMarkerTitle;
      case 'training':
        return this.strings.outline.trainingTitle;
      case 'playsMedia':
        return this.strings.outline.playsMediaTitle;
      default:
        return this.strings.outline.warningTitle;
    }
  }
}
