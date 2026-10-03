/**
 * Tier-2 dry-run logic (ui-spec §4, plan M4 row "E4 tier-2 preview", rest-api §6).
 *
 * Pure so the availability rule, the recorder link and the failure mapping are spec'd without a
 * browser: the component only calls `PreviewTier2Service` and renders what these functions decide.
 */
import {ApiType} from 'speechrecorderng';
import {PREVIEW_TIER2_STRINGS} from './preview-tier2-strings';

/** The recorder application's route (`SPR_ROUTES`: `spr/session/:id`). */
export const RECORDER_SESSION_PATH = 'spr/session';

export type Tier2Reason = 'fixtures' | 'noRecorder' | null;

export interface Tier2Availability {
  enabled: boolean;
  reason: Tier2Reason;
}

/**
 * The dry run needs two things the editor cannot fake: a REST server to create the session and an
 * address to open the recorder at. `ApiType.FILES` means the deployment is reading fixtures, so
 * there is no server at all; that is the case the button stays disabled and explains.
 */
export function tier2Availability(
  apiType: ApiType | null | undefined,
  recorderBaseUrl: string | undefined,
): Tier2Availability {
  if (recorderBaseUrl === undefined) {
    return {enabled: false, reason: 'noRecorder'};
  }
  if (apiType === ApiType.FILES) {
    return {enabled: false, reason: 'fixtures'};
  }
  return {enabled: true, reason: null};
}

/**
 * Where the created session opens. The receiver serves the recorder under `spr/session/{id}`; a
 * deployment mounts the whole application under a base path, which is what `recorderBaseUrl` is
 * for. `''` means the recorder lives on the editor's own origin.
 */
export function recorderSessionUrl(recorderBaseUrl: string, sessionId: string): string {
  const base = recorderBaseUrl.replace(/\/+$/, '');
  return `${base}/${RECORDER_SESSION_PATH}/${encodeURIComponent(sessionId)}`;
}

/** The receiver's error envelope `{error, message, code?, details?}` (rest-api §1). */
function readError(status: number, body: unknown): {code: string | null; message: string | null} {
  if (body === null || typeof body !== 'object') {
    return {code: null, message: null};
  }
  const envelope = body as {code?: unknown; message?: unknown; error?: unknown};
  return {
    code: typeof envelope.code === 'string' ? envelope.code : null,
    message: typeof envelope.message === 'string'
      ? envelope.message
      : typeof envelope.error === 'string' ? envelope.error : null,
  };
}

/**
 * The 4xx/5xx cases the receiver defines for `POST …/preview-session`: `404` when the script has no
 * draft or version to preview, `409 RECORDER_VERSION_TOO_OLD` when its floor is unmet, the
 * deployment's `401`/`403`, and a transport failure (`status 0`).
 */
export function describePreviewFailure(status: number, body: unknown): string {
  const {code, message} = readError(status, body);
  const suffix = message === null ? '' : ` ${message}`;
  if (status === 0) {
    return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorUnreachable}`;
  }
  if (status === 404) {
    return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorNotFound}${suffix}`;
  }
  if (status === 401 || status === 403) {
    return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorForbidden}${suffix}`;
  }
  if (status === 409 && code === 'RECORDER_VERSION_TOO_OLD') {
    return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorVersion}${suffix}`;
  }
  if (status >= 500) {
    return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorServer}${suffix}`;
  }
  return `${PREVIEW_TIER2_STRINGS.errorPrefix} ${PREVIEW_TIER2_STRINGS.errorUnknown}${suffix}`;
}
