/**
 * The shell's strings (ui-spec §1). Kept beside the component, in the style of `editor-strings.ts`,
 * rather than appended to that file: two slices appending to one catalogue at once is how the tree
 * got broken once. Where `EDITOR_STRINGS.shell` already has the word, it is reused read-only.
 *
 * `{placeholder}` slots are filled by `validation/interpolate.ts`'s `fillTemplate`.
 */
import {EDITOR_STRINGS} from './editor-strings';

export const SHELL_STRINGS = {
  brand: EDITOR_STRINGS.shell.brand,
  homeLabel: EDITOR_STRINGS.shell.homeLabel,
  breadcrumbLabel: EDITOR_STRINGS.shell.breadcrumbLabel,
  separator: EDITOR_STRINGS.shell.separator,
  scriptWord: EDITOR_STRINGS.shell.scriptWord,

  /** Save state (ui-spec §1): the four visible forms. */
  savedState: EDITOR_STRINGS.shell.saveState,
  savingState: 'Saving…',
  unsavedState: 'Unsaved changes',
  errorState: 'The draft could not be saved:',
  /** A draft that never loaded says so, and says which half failed. */
  loadFailedState: 'The draft could not be loaded:',
  noDraftState: 'No draft loaded',
  retry: 'Retry',

  nameLabel: 'Script name',

  undo: EDITOR_STRINGS.shell.undo,
  redo: EDITOR_STRINGS.shell.redo,
  preview: EDITOR_STRINGS.shell.preview,
  publish: EDITOR_STRINGS.shell.publish,
  readOnlyReason: EDITOR_STRINGS.shell.readOnlyReason,

  warningsLabel: EDITOR_STRINGS.shell.warningLabel,
  errorWordOne: 'error',
  errorWordMany: 'errors',
  warningWordOne: 'warning',
  warningWordMany: 'warnings',

  /** The 412 banner: both sides offered, never a silent failure (ui-spec §1). */
  conflictTitle: 'The draft changed on the server while you were editing.',
  useServer: 'Use server',
  keepMine: 'Keep mine',

  /** Why Publish is disabled. */
  publishBlockedErrors: '{count} errors must be fixed before publishing.',
  publishBlockedConflict: 'Resolve the conflict before publishing.',
  publishBlockedReadOnly: EDITOR_STRINGS.shell.readOnlyReason,
  publishBlockedNoDraft: 'The draft has not loaded yet.',

  /** Publish dialog (ui-spec §5, validation.md "Publish gate"). */
  publishDialogTitle: 'Publish this script?',
  publishWarningsHeading: 'The server will accept this draft, but it has warnings:',
  noteLabel: 'Publisher’s note (optional)',
  cancel: 'Cancel',

  /** Publish outcomes. */
  publishedPrefix: 'Published v',
  publishFailed: 'Publishing failed:',
  publishRejected: 'The server refused to publish this draft.',
  serverFindingsLabel: 'Server findings',
  featureFloor: 'The recorder does not know these features yet: {features}',
  unknownError: 'the server did not say why.',

  dismiss: 'Dismiss',
} as const;
