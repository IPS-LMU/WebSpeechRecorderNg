/**
 * User-visible strings introduced by the bank browser and the draw-rule editor (plan M4, ui-spec
 * §6/§9), in one place so a later i18n retrofit is mechanical.
 *
 * Ownership: this slice owns `app/bank/**`; the frozen `core/editor-strings.ts` is never edited.
 * Strings the catalogue already carries for the same concept — the filter in words, the live match
 * count, the draw-rule fields (`count`, `fixedBy`, `itemcodePrefix`, playback), the example draw and
 * the check messages (E03–E05, W04, W05) — are **reused** from `EDITOR_STRINGS` so this screen, the
 * centre card and the inspector cannot describe one rule differently. Only strings new to this
 * screen live here.
 */
export const BANK_STRINGS = {
  /** Project-scoped bank browser (`project/{p}/bank`). */
  browserTitle: 'Item banks',
  /** Reached from a drawn group (`project/{p}/script/{id}/bank/{groupRef}`), ui-spec §6. */
  ruleScreenTitle: 'Item bank and draw rule',
  regionLabel: 'Item bank',
  backToEditor: 'Back to the editor',
  backToLibrary: 'Back to the scripts',

  picker: {
    legend: 'Banks',
    groupProject: 'This project',
    groupBuiltin: 'Ships with SpeechRecorder',
    emptyProject: 'This project has no banks yet.',
    originProject: 'Project bank',
    originBuiltin: 'Ships with SpeechRecorder',
    originLegend: 'Origin',
    readOnlyTitle: 'Read-only',
    readOnlyBody:
      'This bank ships with SpeechRecorder, so its items cannot be edited here. Copy it into the '
      + 'project to edit a version of it.',
    copy: 'Copy to this project',
    copyTitle: 'Copies the shipped bank into this project as an editable bank.',
    readOnlyTrade:
      'A shipped bank travels between installations and is replaced on update; a project bank is '
      + 'editable here but belongs to this project only.',
  },

  filter: {
    browseLegend: 'Browse filter',
    browseHint: 'Applied to the item table only. This filter is never written to the draft.',
    browseWiden: 'Widen the filter',
    ruleLegend: 'Filter (part of the draw rule)',
    ruleHint: 'This filter is stored on the bank source and decides which items a session may draw.',
    category: 'Category',
    categoryPlaceholder: 'Any category',
    minWords: 'Min words',
    maxWords: 'Max words',
    audio: 'Model recording',
    audioAny: 'With or without a recording',
    audioWith: 'Only with a model recording',
    audioWithout: 'Only without a model recording',
    tags: 'Tags',
    tagsPlaceholder: 'Comma separated; all must match',
    q: 'Free text',
    qPlaceholder: 'Substring of the item text',
    summary: 'In words',
    clear: 'Clear the filter',
  },

  table: {
    caption: 'Bank items',
    columnId: 'Bank id',
    columnItem: 'Item',
    columnCategory: 'Category',
    columnWords: 'Words',
    columnTags: 'Tags',
    columnAudio: 'Model recording',
    columnUsed: 'Times used',
    columnActions: 'Actions',
    noAudio: 'No recording',
    audioPresent: 'Has a recording',
    audition: 'Audition',
    auditionTitle: 'Plays the item’s model recording. Nothing is recorded or uploaded.',
    auditionFailed: 'This clip could not be played.',
    upload: 'Upload recording',
    replace: 'Replace recording',
    uploading: 'Uploading…',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Confirm delete',
    deleteCancel: 'Cancel',
    addItem: 'Add item',
    importCsv: 'Import CSV',
    importTitle: 'Appends items from a CSV file whose columns are text,category,words,tags,audio.',
    importResult: '{imported} imported, {skipped} skipped.',
    importProblem: 'Line {line}: {message}',
    importFailed: 'The CSV file could not be imported.',
    loading: 'Loading items…',
    errorPrefix: 'The bank items could not be loaded.',
    retry: 'Retry',
    emptyTitle: 'The filter matches no item',
    emptyBody: 'Every item is hidden by the current filter. Widen it to see items again.',
    emptyBank: 'This bank has no items yet.',
    page: 'Showing {from}–{to} of {match}',
    prev: 'Previous',
    next: 'Next',
  },

  item: {
    newTitle: 'New bank item',
    editTitle: 'Edit bank item',
    id: 'Bank id',
    idHint: 'Leave blank to let the server assign one.',
    text: 'Item text',
    category: 'Category',
    words: 'Words',
    tags: 'Tags',
    save: 'Save item',
    saving: 'Saving…',
    cancel: 'Cancel',
    required: 'Item text is required.',
    saveFailed: 'The item could not be saved.',
    deleteFailed: 'The item could not be deleted.',
    uploadFailed: 'The recording could not be uploaded.',
  },

  rule: {
    heading: 'Draw rule',
    noBank: 'No bank chosen',
    findingsLabel: 'Checks',
    changeBank: 'Choose another bank',
    bankField: 'Bank',
    order: 'Order',
    orderRandom: 'Random (shuffled once, at creation)',
    orderSequential: 'Sequential (the filter’s order)',
    playbackLegend: 'Playback of the model recording',
    playBankAudio: 'Play the bank item’s model recording',
    playBankAudioHelp: 'Each drawn item plays its own model recording instead of one fixed file.',
    codesLabel: 'Generated codes',
    defaultsLegend: 'Timing applied to every drawn item',
    countPending: 'counting…',
    countAgainstNoTotal: 'matches {match} items',
    exampleIgnores: 'It ignores “Same items for” and “Skip recorded”, and it samples the whole match, not just the first page.',
    useRule: 'Use this rule',
    useRuleTitle: 'Returns to the editor and keeps this rule in the draft.',
    openDraws: 'Open the draw record',
    noDrawsLink: 'Save the script before opening the draw record.',
  },

  group: {
    missingTitle: 'That group is not in this script',
    missingBody: 'The group the link names no longer exists. Open the editor and choose the group again.',
    notDrawnTitle: 'This group does not draw from a bank',
    notDrawnBody:
      'Only a group whose placeholder item carries a bank source has a draw rule. Add a randomised '
      + 'item in the editor first, or pick another group.',
    loading: 'Loading the group’s rule…',
    errorTitle: 'The draft could not be loaded',
    errorBody: 'The rule is read-only until the draft loads; this is not an empty rule.',
  },

  write: {
    filesMode: 'This deployment serves the fixtures read-only (FILES mode), so banks and recordings cannot be changed here.',
  },
} as const;
