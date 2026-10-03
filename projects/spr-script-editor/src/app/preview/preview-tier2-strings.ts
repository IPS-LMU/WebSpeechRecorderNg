/**
 * The tier-2 dry-run strings (ui-spec §4: "the full dry run (tier 2, rest-api §6) is one button
 * away"). One module per slice, like `preview-strings.ts`; this one belongs to the tier-2 wiring.
 */
export const PREVIEW_TIER2_STRINGS = {
  button: 'Open the tier-2 dry run',
  buttonBusy: 'Starting the dry run\u2026',
  buttonTitle: 'Creates a throwaway session over this script and opens the real recorder on it.',
  /** The guarantee rest-api §6 makes: a `type: "TEST"` session cannot store a recording. */
  guaranteeTitle: 'Nothing is uploaded',
  guarantee:
    'The session is created with type "TEST": the recorder disables uploads in its tab, and the ' +
    'receiver refuses every recording for it. Anything recorded in the dry run is discarded, and ' +
    'the session is left out of reports, usage counts and the draw record.',
  sessionLabel: 'Dry-run session',
  expiresLabel: 'Expires',
  openLink: 'Open in the recorder',
  openLinkTitle: 'Opens the session in the recorder application in a new tab.',
  startAnother: 'Start another',
  disabledFixtures:
    'Tier 2 needs the REST server; this deployment reads development fixtures (ApiType.FILES), ' +
    'so no session can be created. Point apiEndPoint at the REST base to use the dry run.',
  disabledNoRecorder:
    'No recorder base URL is configured for this deployment, so the dry-run session has nowhere ' +
    'to open.',
  errorPrefix: 'The dry run could not be started.',
  errorNotFound: 'This script has no draft or version to preview.',
  errorVersion:
    'The receiver refuses this script: it asks for a newer recorder than the deployment serves.',
  errorForbidden: 'You may not create a session in this project.',
  errorUnreachable: 'The receiver could not be reached.',
  errorServer: 'The receiver failed to create the session.',
  errorUnknown: 'The receiver refused the request.',
} as const;
