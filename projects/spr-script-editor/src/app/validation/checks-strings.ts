/**
 * The checks panel's user-visible strings. Kept beside the component (not appended to
 * `editor-strings.ts`) per the round-2 rule: one module per screen keeps the i18n retrofit cheap
 * without concurrent appends to the shared file.
 */
export const CHECKS_STRINGS = {
  title: 'Checks',
  countsLabel: 'Findings by severity',
  errorWord: 'Error',
  warningWord: 'Warning',
  noteWord: 'Note',
  errorsLabel: '{count} errors',
  warningsLabel: '{count} warnings',
  notesLabel: '{count} notes',
  suspendedChip: 'Count unknown',
  serverChip: 'From the server',
  lineLabel: 'Line {line}',
  noLine: 'no line',
  openInEditor: 'Open in editor',
  empty: 'No findings. The draft passes every check.',
} as const;
