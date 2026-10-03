/**
 * Strings for the inspector's randomised-items panel (plan M4 `E4 randomised items panel`, D-W).
 * Kept in its own module beside the inspector so the frozen `core/editor-strings.ts` and the shared
 * `editor-strings-ext.ts` stay untouched by this slice.
 *
 * The wording states *when* a source is drawn where the researcher must know: a list at script
 * load, a bank at session creation (data-model.md §2.2).
 */
export const PREFILL_STRINGS = {
  legend: 'Randomised items',
  source: 'Items come from',
  none: 'Nothing drawn — a plain item',
  noneHelp: 'This item is recorded exactly as written.',
  word: 'A word list',
  sentence: 'A sentence list',
  bank: 'An item bank',
  listSource: 'List source',
  listSourceHelp: 'Resource id of the list; fetched from the script endpoint.',
  select: 'Selection',
  selectRandom: 'Random',
  itemcodeFormat: 'Itemcode format',
  itemcodeFormatHelp: '{n} is the 1-based position of the entry in the list.',
  listPreview: 'Generated itemcodes: {codes}',
  drawnAtLoad: 'A list is drawn when the script loads, and the choice is stored on the session.',
  drawnAtSession: 'A bank is drawn once, at session creation; the draw is stored on the session.',
  playBankAudio: 'Model recording',
  playBankAudioYes: 'Plays the bank item’s own model recording',
} as const;
