/**
 * Every user-visible string of the resolved-draws screen (ui-spec §7), in one module so a later
 * i18n retrofit is mechanical. Slice-local by the same decision as `preview-strings.ts`:
 * `core/editor-strings.ts` is frozen because several slices read it, so each screen owns its own
 * `…strings.ts`. Only this screen reads `DRAWS_STRINGS`.
 */
export const DRAWS_STRINGS = {
  title: 'Resolved draws',
  subtitle: 'What each session actually drew, and which bank items it drew',

  /**
   * The paragraph ui-spec §7 keeps on the page: it is the answer to the question the screen exists
   * for (plan D-U — the server resolves the draw once, the editor only reads it).
   */
  fixedNote:
    'The draw is fixed when the session is created: the server picks the items, materialises them ' +
    'into that session\u2019s script and records them here. Re-opening a session and the files it ' +
    'already recorded always agree; re-drawing is only possible before a session has started.',

  // Table
  tableCaption: 'Sessions of this script and the bank items they drew',
  colSession: 'Session',
  colSpeaker: 'Speaker',
  colStatus: 'Status',
  colDrawn: 'Drawn',
  colRecorded: 'Recorded',
  colItems: 'First itemcodes',
  colDraws: 'Draws',
  showPreview: 'Show preview sessions',
  previewChip: 'Preview',
  previewTitle: 'A tier-2 dry run (type: TEST); hidden from the record unless asked for.',
  listDrawsChip: 'List draw',
  bankDrawsChip: 'Bank draw',
  unrecorded: '\u2014',
  speakerUnknown: '(no speaker)',

  // States (ui-spec §9)
  loading: 'Loading the draw record\u2026',
  empty: 'No session has drawn from this script yet.',
  emptyHint: 'A session appears here once it is created against a version of this script.',
  errorPrefix: 'The draw record could not be loaded.',
  detailLoading: 'Loading the session trace\u2026',
  detailErrorPrefix: 'The session trace could not be loaded.',

  // Detail panel
  detailTitle: 'Session detail',
  chooseSession: 'Select a session in the table to see its trace.',
  fieldStatus: 'Status',
  fieldSpeaker: 'Speaker',
  fieldScript: 'Script',
  fieldVersion: 'Script version',
  fieldDrawnAt: 'Draw made',
  fieldRedraws: 'Re-draws',
  fieldBank: 'Bank',
  fieldOrigin: 'Origin',
  fieldFixedBy: 'Fixed by',
  fieldSeed: 'Seed key',
  fieldCount: 'Requested',
  fieldPrefix: 'Itemcode prefix',
  fieldFilter: 'Filter',
  fieldPlaceholder: 'Placeholder item',
  originProject: 'This project',
  originBuiltin: 'Ships with SpeechRecorder',
  originUnknown: 'Unknown',
  fixedBySession: 'Session (a fresh draw per session)',
  fixedBySpeaker: 'Speaker (a returning speaker draws again)',
  fixedByScript: 'Script version (everyone on this version draws alike)',
  filterNone: 'No filter \u2014 every item of the bank',
  filterCategory: 'category',
  filterWords: 'words',
  filterAudioWith: 'with a model recording',
  filterAudioWithout: 'without a model recording',
  filterQ: 'text contains',
  filterTags: 'tags (all of)',

  // Trace / items
  traceTitle: 'Drawn items',
  materialisedTitle: 'Materialised session script',
  materialisedNote:
    'These are the items stored into the session script; the recorder reads them unchanged.',
  listTraceTitle: 'List draws',
  listTraceNote: 'Entries drawn at load time from a list source (the shipped prefill mechanism).',
  colBankItem: 'Bank item',
  colItemcode: 'Itemcode',
  colText: 'Text',
  colRecordedDot: 'Recorded',
  textUnknown: 'not in the bank now',
  textUnavailable: 'bank unreachable',
  textFormatted: 'Formatted text',
  bankUnreachableNote:
    'The bank could not be read, so item texts are unknown. The drawn ids above are the record.',
  seedFallback: 'fixedBy SPEAKER but the session has no speaker, so the session seed was used.',
  noteSkipped:
    'Items this speaker had already recorded were skipped because the rule asks for it.',
  noteRefilled:
    'Too few unrecorded items matched, so skipped items were put back, newest-recorded last.',
  noteRedrawn: 'This session was re-drawn; the seed key carries a counter, so the trace stayed the truth.',
  recordedYes: 'recorded',
  recordedNo: 'not recorded',

  // Actions
  downloadCsv: 'Download CSV',
  downloadCsvTitle: 'One row per drawn item: sessionId,speaker,itemcode,bankItemId,recorded',
  csvFileName: (scriptId: string) => `draws-${scriptId}.csv`,
  redraw: 'Re-draw',
  redrawTitle: 'Re-resolve this session\u2019s draw from the original script.',
  redrawDisabledStarted:
    'Only a session that has not started can be re-drawn; this one has started, and its draw is fixed.',
  redrawDisabledReadOnly:
    'Re-drawing is a write; the editor is reading development fixtures and cannot reach the server.',
  redrawBusy: 'Re-drawing\u2026',
  redrawDone: 'The draw was re-resolved. The session keeps its id and its recorded files.',
  redrawFailed: 'The re-draw was refused.',
  unknownStatus: 'Unknown',

  // Project-scoped entry (route project/:p/draws)
  scriptPickerLabel: 'Script',
  scriptPickerPlaceholder: 'Choose a script\u2026',
  scriptPickerLoading: 'Loading scripts\u2026',
  scriptPickerEmpty: 'This project has no scripts.',
  pickScript: 'Choose a script to see its draw record.',

  // Status labels (session statuses, library `Status`)
  status: {
    created: 'Not started',
    loaded: 'Loaded',
    training: 'In training',
    started: 'Started',
    completed: 'Completed',
    unknown: 'Unknown',
  } as Record<string, string>,
} as const;
