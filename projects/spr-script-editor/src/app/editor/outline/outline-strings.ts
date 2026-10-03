/**
 * The outline's strings introduced after `core/editor-strings.ts` was frozen (Main, this round:
 * one strings module per screen beside its components, `as const`, still centralised for a later
 * i18n pass). The outline's original strings remain in `EDITOR_STRINGS.outline`; only what the
 * keyboard work added lives here.
 */
export const OUTLINE_STRINGS = {
  deleteRow: 'Delete',
  deleteRowTitle: 'Delete this node. Undo restores it.',
  /** Shown on the delete affordance when the draft cannot be written. */
  deleteDisabledTitle: 'Read-only: this draft cannot be changed here.',
  deleteScriptTitle: 'The script itself cannot be deleted.',
  expand: 'Expand',
  collapse: 'Collapse',
  filterHint: 'Press / to focus this filter.',
} as const;
