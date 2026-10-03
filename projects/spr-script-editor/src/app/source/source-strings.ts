/**
 * The JSON source screen's user-visible strings, kept beside the component (one module per screen;
 * `editor-strings.ts` is frozen).
 */
export const SOURCE_STRINGS = {
  title: 'JSON source',
  textLabel: 'Draft JSON',
  format: 'Format',
  formatTitle: 'Re-indent the JSON. Disabled while the text does not parse.',
  importJson: 'Import JSON',
  importHint: 'Replace the draft from a JSON file.',
  download: 'Download',
  downloadTitle: 'Download the draft as script-{id}.json.',
  publish: 'Publish',
  publishBlocked: 'Fix {errors} error(s) before publishing.',
  publishDone: 'Published version {version}.',
  publishFailed: 'Publishing failed: {message}',
  publishUnknown: 'Publishing failed.',
  parseErrorAt: '{message} (line {line}, column {column})',
  mustBeObject: 'The draft must be a JSON object.',
  frozenBody: 'The checks still describe the last valid draft. The text is kept in this box and in the local backup until it parses again.',
  loading: 'Loading the draft…',
  loadErrorTitle: 'The draft could not be loaded',
  loadErrorBody: 'The source view is unavailable until the draft loads.',
  back: 'Back to the editor',
  readOnly: 'This deployment serves the fixtures read-only (FILES mode): text edits stay local and are never saved.',
} as const;
