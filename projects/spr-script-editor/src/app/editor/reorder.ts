/**
 * Structural reordering for the outline (ui-spec §3.1/§8). Drag-drop and the `Alt+↑`/`Alt+↓`
 * keyboard move both end here: this module turns "what the operator grabbed / where the pointer
 * landed" into the `ScriptDraftService` edits that record the move, so a 412 reapply replays it.
 *
 * Everything here is a pure function of the model and two selections, which keeps the drop rule
 * testable without a renderer: only same-kind drops are allowed (a section can be dropped among
 * sections, a group among groups, an item among items), a move inside one array is a single
 * `move` op, and a drop into another parent's array is a `remove` + `insert` pair.
 */
import type {DraftPath} from '../core/script-draft.service';
import {arrayOf} from '../core/validation/walk';
import type {Selection} from './selection';

/** The single undo-coalescing focus key every reorder edit shares. */
export const REORDER_FOCUS = 'reorder';

/** One structural step of a reorder, in the order it must be applied. */
export type ReorderOp =
  | {kind: 'move'; path: DraftPath; from: number; to: number}
  | {kind: 'remove'; path: DraftPath; index: number}
  | {kind: 'insert'; path: DraftPath; index: number};

/** A move within one sibling array, as the keyboard and the arrow buttons use. */
export interface SiblingMove {
  path: DraftPath;
  from: number;
  to: number;
}

/** The ops a drop resolves to. */
export interface DropMove {
  ops: ReorderOp[];
}

/** The array a selection is an element of, and its index in it. */
interface Slot {
  path: DraftPath;
  index: number;
}

/** The `ScriptDraftService` methods `applyReorder` needs; the service satisfies this structurally. */
export interface ReorderDraft {
  move(focus: string, path: DraftPath, from: number, to: number): void;
  remove(focus: string, path: DraftPath, index: number): void;
  insert(focus: string, path: DraftPath, index: number, value: unknown): void;
}

/** The array a selection lives in; `null` for the script, which has no siblings. */
function slotOf(selection: Selection): Slot | null {
  switch (selection.kind) {
    case 'script':
      return null;
    case 'section':
      return {path: ['sections'], index: selection.section};
    case 'group':
      return {path: ['sections', selection.section, 'groups'], index: selection.group};
    case 'item':
      return {
        path: ['sections', selection.section, 'groups', selection.group, 'promptItems'],
        index: selection.item,
      };
  }
}

function valueAt(script: unknown, path: DraftPath): unknown {
  let cursor: unknown = script;
  for (const key of path) {
    if (cursor === null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string | number, unknown>)[key];
  }
  return cursor;
}

/**
 * The array a selection is an element of and the index to remove, for `Delete`. `null` for the
 * script, which has no siblings and is never deleted (ui-spec §8).
 */
export function removalSlot(selection: Selection): Slot | null {
  return slotOf(selection);
}

/**
 * The move of the selected node among its siblings by `delta` positions, or `null` when the
 * selection is the script or the move would leave the array (first `Up`, last `Down`).
 */
export function siblingMove(script: unknown, selection: Selection, delta: -1 | 1): SiblingMove | null {
  const slot = slotOf(selection);
  if (slot === null) {
    return null;
  }
  const length = arrayOf(valueAt(script, slot.path)).length;
  if (slot.index < 0 || slot.index >= length) {
    return null;
  }
  const to = slot.index + delta;
  if (to < 0 || to >= length) {
    return null;
  }
  return {path: slot.path, from: slot.index, to};
}

/**
 * The ops a drop of `dragged` onto `target` resolves to, or `null` when the drop is not allowed:
 * the script cannot be dragged or targeted, and only same-kind nodes may exchange places (a
 * section is never dropped among groups, an item never among sections).
 *
 * A same-array drop is one `move`; a drop into another parent's array is a `remove` from the old
 * array followed by an `insert` at the target's index in the new one.
 */
export function dropMove(script: unknown, dragged: Selection, target: Selection): DropMove | null {
  const from = slotOf(dragged);
  const to = slotOf(target);
  if (from === null || to === null || dragged.kind !== target.kind) {
    return null;
  }
  const fromLength = arrayOf(valueAt(script, from.path)).length;
  const toLength = arrayOf(valueAt(script, to.path)).length;
  if (from.index < 0 || from.index >= fromLength || to.index < 0 || to.index >= toLength) {
    return null;
  }
  const sameArray =
    from.path.length === to.path.length && from.path.every((key, index) => key === to.path[index]);
  if (sameArray) {
    if (from.index === to.index) {
      return null;
    }
    return {ops: [{kind: 'move', path: from.path, from: from.index, to: to.index}]};
  }
  return {
    ops: [
      {kind: 'remove', path: from.path, index: from.index},
      {kind: 'insert', path: to.path, index: to.index},
    ],
  };
}

/**
 * Applies the ops of a drop through `draft`. The inserted value is read from `model` *before* the
 * `remove` op runs, because a cross-parent drop carries no value of its own — the draft service
 * clones whatever it is handed.
 */
export function applyReorder(draft: ReorderDraft, ops: ReadonlyArray<ReorderOp>, model: unknown): void {
  let removed: unknown;
  for (const op of ops) {
    switch (op.kind) {
      case 'move':
        draft.move(REORDER_FOCUS, op.path, op.from, op.to);
        break;
      case 'remove':
        removed = arrayOf(valueAt(model, op.path))[op.index];
        draft.remove(REORDER_FOCUS, op.path, op.index);
        break;
      case 'insert':
        draft.insert(REORDER_FOCUS, op.path, op.index, removed);
        break;
    }
  }
}
