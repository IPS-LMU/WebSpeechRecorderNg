/**
 * Strings added by the inspector's M3 write slice. `core/editor-strings.ts` is frozen (a shared
 * file two slices appending to at once is how the tree broke once), so this module exports its own
 * `…_STRINGS` object in the same style and the inspector reads both.
 *
 * Only strings the inspector does not already have live here; the field labels, the playback
 * options and the E01/E02/E05 messages stay in `EDITOR_STRINGS` and are reused read-only.
 */
export const EDITOR_STRINGS_EXT = {
  /** Shown instead of a disabled control's explanation when the deployment is read-only (FILES). */
  writesDisabled:
    'This deployment serves the fixtures read-only (FILES mode): the draft is shown but cannot be changed.',
  inspector: {
    script: {
      published: 'Published',
      sessions: '{count} sessions',
    },
    section: {
      orderLegacy: 'Randomized (the recorder treats it as sequential)',
    },
    group: {
      kindHelpFixed: 'The same items are recorded in the same order every time.',
      kindHelpDrawn: 'The items are drawn from a bank once, when a session is created.',
      splitNeedsTwo: 'A group needs at least two items to split.',
      countSuspended: 'The bank could not be read, so the items-per-session count cannot be validated.',
      defaultsTitle: 'Applied to every drawn item',
    },
    item: {
      itemcodeInvalid: 'This itemcode is not valid yet.',
      itemcodeValid: 'No itemcode clash and not inside a reserved range.',
    },
    playback: {
      upload: 'Upload…',
      uploadNote: 'An upload is immediate and stays outside the draft’s undo history.',
      deleteFile: 'Delete the file from the project',
      uploadFailed: 'The file could not be uploaded.',
      deleteFailed: 'The file could not be deleted.',
      inUse: 'The file is referenced by a published version, so it cannot be deleted.',
      pickMedia: 'Project media',
      pickMediaNone: 'Choose a file…',
    },
  },
} as const;
