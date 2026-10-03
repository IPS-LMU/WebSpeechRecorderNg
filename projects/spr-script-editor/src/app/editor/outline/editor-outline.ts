import {CdkDrag, CdkDragHandle, CdkDropList, CdkDropListGroup, type CdkDragDrop} from '@angular/cdk/drag-drop';
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from '@angular/cdk/scrolling';
import {Component, ElementRef, HostListener, computed, inject, input, output, signal, viewChild} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {DRAFT_STRINGS, ScriptDraftService} from '../../core/script-draft.service';
import {fillTemplate} from '../../core/validation/interpolate';
import type {Finding} from '../../core/validation';
import type {EditorScript} from '../../core/script.model';
import {filterOutline, flattenOutline, type OutlineRow} from '../outline';
import {isTypingTarget} from '../keyboard';
import type {RowMarkers} from '../markers';
import {applyReorder, dropMove, removalSlot, siblingMove, REORDER_FOCUS} from '../reorder';
import {formatSelection, selectionEquals, type Selection} from '../selection';
import {OUTLINE_STRINGS} from './outline-strings';

const VIRTUAL_THRESHOLD = 300;

/** The `OutlineRow.key` of a selection; the key format `outline.ts` builds. */
function keyOf(selection: Selection): string {
  switch (selection.kind) {
    case 'script':
      return 'script';
    case 'section':
      return `s${selection.section}`;
    case 'group':
      return `s${selection.section}.g${selection.group}`;
    case 'item':
      return `s${selection.section}.g${selection.group}.i${selection.item}`;
  }
}

/** The selection of the same node moved by `delta`; `null` for the script. */
function movedSelection(selection: Selection, delta: -1 | 1): Selection | null {
  switch (selection.kind) {
    case 'script':
      return null;
    case 'section':
      return {kind: 'section', section: selection.section + delta};
    case 'group':
      return {kind: 'group', section: selection.section, group: selection.group + delta};
    case 'item':
      return {kind: 'item', section: selection.section, group: selection.group, item: selection.item + delta};
  }
}

/**
 * The selection that should own focus after deleting the node at `index`: the sibling before it,
 * or the parent when it was first. `selection` is never the script here.
 */
function survivingSelection(selection: Selection, index: number): Selection {
  if (index > 0) {
    switch (selection.kind) {
      case 'section':
        return {kind: 'section', section: selection.section - 1};
      case 'group':
        return {kind: 'group', section: selection.section, group: selection.group - 1};
      case 'item':
        return {kind: 'item', section: selection.section, group: selection.group, item: selection.item - 1};
      default:
        return {kind: 'script'};
    }
  }
  switch (selection.kind) {
    case 'section':
      return {kind: 'script'};
    case 'group':
      return {kind: 'section', section: selection.section};
    case 'item':
      return {kind: 'group', section: selection.section, group: selection.group};
    default:
      return {kind: 'script'};
  }
}

/**
 * The outline column (ui-spec §3.1): a flattened tree of buttons, a filter that keeps the
 * ancestors of matches, and virtual scrolling above 300 rows. Rows reorder by drag (a grip handle
 * per row) and by `Alt+↑`/`Alt+↓` among siblings; both are structural edits in
 * `ScriptDraftService`, so a 412 reapply replays them (ui-spec §3.1/§8).
 */
@Component({
  selector: 'spr-editor-outline',
  // The fixed-size directive is what actually reads `itemSize` (CDK 20 throws without it), so it is
  // imported explicitly rather than relying on the whole ScrollingModule. The drag-drop directives
  // are standalone; `DragDrop` itself is `providedIn: 'root'`.
  imports: [
    NgTemplateOutlet,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  templateUrl: './editor-outline.html',
  styleUrl: './editor-outline.scss',
})
export class EditorOutline {
  readonly script = input<EditorScript | null>(null);
  readonly findings = input<ReadonlyArray<Finding>>([]);
  readonly selection = input<Selection>({kind: 'script'});
  readonly bankNames = input<ReadonlyMap<string, string>>(new Map());

  readonly select = output<Selection>();

  private readonly draft = inject(ScriptDraftService);

  readonly strings = EDITOR_STRINGS;
  readonly filter = signal('');
  readonly focusKey = signal<string | null>('script');
  /** Keys whose children are hidden (`→`/`←`); ignored while a filter is active, which expands. */
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  /** Makes each Delete its own undo step (the draft coalesces consecutive edits by focus). */
  private deleteSeq = 0;

  readonly outlineStrings = OUTLINE_STRINGS;

  readonly rows = computed(() => flattenOutline(this.script(), this.findings(), {
    bankNames: this.bankNames(),
    // A filter must reveal the matches and their ancestors, so a filtered tree is fully expanded.
    collapsed: this.filter() === '' ? this.collapsed() : undefined,
  }));
  readonly visible = computed(() => filterOutline(this.rows(), this.filter()));
  readonly virtual = computed(() => this.rows().length > VIRTUAL_THRESHOLD);

  /**
   * Drag-drop is off when the filter hides rows (visible indices no longer match the model) and in
   * the virtual viewport, which cannot host the drag preview reliably. The keyboard move and the
   * arrow buttons stay available in both cases.
   */
  readonly dragDisabled = computed(() => this.filter() !== '' || this.virtual());

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

  /** ui-spec §8: `/` focuses the filter from anywhere on the editor route, unless typing. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    event.preventDefault();
    this.focusFilter();
  }

  focusFilter(): void {
    this.filterInput()?.nativeElement.focus();
  }

  /** True while a filter hides the tree's shape, so collapse keys are inert (the tree is expanded). */
  isCollapsed(row: OutlineRow): boolean {
    return this.filter() === '' && this.collapsed().has(row.key);
  }

  toggleRow(row: OutlineRow): void {
    if (this.filter() !== '' || !row.hasChildren) {
      return;
    }
    this.collapsed.update((keys) => {
      const next = new Set(keys);
      if (next.has(row.key)) {
        next.delete(row.key);
      } else {
        next.add(row.key);
      }
      return next;
    });
  }

  expandLabel(row: OutlineRow): string {
    return this.isCollapsed(row) ? this.outlineStrings.expand : this.outlineStrings.collapse;
  }

  canDelete(row: OutlineRow): boolean {
    return row.kind !== 'script' && !this.draft.writesDisabled();
  }

  deleteTitle(row: OutlineRow): string {
    if (row.kind === 'script') {
      return this.outlineStrings.deleteScriptTitle;
    }
    if (this.draft.writesDisabled()) {
      return `${this.outlineStrings.deleteDisabledTitle} ${DRAFT_STRINGS.filesMode}`;
    }
    return this.outlineStrings.deleteRowTitle;
  }

  deleteAria(row: OutlineRow): string {
    return `${this.outlineStrings.deleteRow} ${row.label}`;
  }

  deleteRow(row: OutlineRow): void {
    this.deleteSelection(row.selection);
  }

  /** The same structural delete as the `Delete` key (ui-spec §8); never the script itself. */
  private deleteSelection(selection: Selection): void {
    if (selection.kind === 'script' || this.draft.writesDisabled()) {
      return;
    }
    const model = this.draft.model();
    const slot = removalSlot(selection);
    if (model === null || slot === null) {
      return;
    }
    const next = survivingSelection(selection, slot.index);
    this.draft.remove(`outline-delete:${this.deleteSeq++}`, slot.path, slot.index);
    this.focusKey.set(keyOf(next));
    this.select.emit(next);
  }

  /** The arrow buttons (ui-spec §3.1): the same structural move as `Alt+↑`/`Alt+↓`. */
  moveRow(row: OutlineRow, delta: -1 | 1): void {
    this.move(row.selection, delta);
  }

  /** Whether the arrow button for `delta` should be enabled; false at the first/last sibling. */
  canMove(row: OutlineRow, delta: -1 | 1): boolean {
    const model = this.draft.model() ?? this.script();
    return model !== null && siblingMove(model, row.selection, delta) !== null;
  }

  /**
   * One reorder through the draft service. The model is read before the edit so the op is recorded
   * against the current structure, and the moved node becomes the selection so focus follows it.
   */
  private move(source: Selection, delta: -1 | 1): void {
    const model = this.draft.model() ?? this.script();
    if (model === null) {
      return;
    }
    const planned = siblingMove(model, source, delta);
    if (planned === null) {
      return;
    }
    this.draft.move(REORDER_FOCUS, planned.path, planned.from, planned.to);
    const moved = movedSelection(source, delta);
    if (moved !== null) {
      this.focusKey.set(keyOf(moved));
      this.select.emit(moved);
    }
  }

  /**
   * `cdkDropListDropped`: the drop indices address `visible()`, whose rows carry the selections.
   * The moved node ends up at the target's position, so the target becomes the selection.
   */
  onDrop(event: CdkDragDrop<Selection>): void {
    const rows = this.visible();
    const dragged = rows[event.previousIndex]?.selection;
    const target = rows[event.currentIndex]?.selection;
    const model = this.draft.model() ?? this.script();
    if (dragged === undefined || target === undefined || model === null) {
      return;
    }
    const move = dropMove(model, dragged, target);
    if (move === null) {
      return;
    }
    applyReorder(this.draft, move.ops, model);
    this.focusKey.set(keyOf(target));
    this.select.emit(target);
  }

  /** Arrow navigation inside the outline (ui-spec §8). `Enter` selects the focused row. */
  onKeydown(event: KeyboardEvent): void {
    const rows = this.visible();
    if (rows.length === 0) {
      return;
    }
    const currentIndex = Math.max(0, rows.findIndex((row) => row.key === this.focusKey()));
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.move(this.selection(), event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
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
      case 'ArrowRight':
        event.preventDefault();
        this.expandOrEnterTree(rows, currentIndex);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.collapseOrLeaveTree(rows, currentIndex);
        break;
      case 'Delete':
        event.preventDefault();
        this.deleteSelection(this.selection());
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

  /** `→`: expand a collapsed parent, else step into its first child; a leaf does nothing. */
  private expandOrEnterTree(rows: ReadonlyArray<OutlineRow>, index: number): void {
    const row = rows[index];
    if (!row.hasChildren) {
      return;
    }
    if (this.isCollapsed(row)) {
      this.toggleRow(row);
      return;
    }
    const child = rows[index + 1];
    if (child !== undefined && child.parentKey === row.key) {
      this.moveFocus(rows, index + 1);
    }
  }

  /** `←`: collapse an expanded parent, else step out to the parent row; the script has none. */
  private collapseOrLeaveTree(rows: ReadonlyArray<OutlineRow>, index: number): void {
    const row = rows[index];
    if (this.filter() === '' && row.hasChildren && !this.isCollapsed(row)) {
      this.toggleRow(row);
      return;
    }
    if (row.parentKey === null) {
      return;
    }
    const parentIndex = rows.findIndex((candidate) => candidate.key === row.parentKey);
    if (parentIndex >= 0) {
      this.moveFocus(rows, parentIndex);
    }
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
