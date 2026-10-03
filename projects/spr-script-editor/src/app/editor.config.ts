import {ApiType, SpeechRecorderConfig} from 'speechrecorderng';
import {environment} from '../environments/environment';

/**
 * The project the editor opens when it is reached without one (`/`). The routes carry the project
 * id in the URL (ui-spec §1); a deployment that always edits one project can point this at it.
 */
export const DEFAULT_PROJECT = 'Demo1';

/**
 * The library injectables the editor bootstraps with (README §4.3). Built like the recorder's
 * `SPR_CFG` so `apiEndPoint`, `withCredentials`, `apiType` and `logLevel` behave identically.
 *
 * `enableUploadRecordings: false` and no `uploadConfig`: the editor never uploads recordings.
 * Development drives the read side from the `src/test` fixtures (`ApiType.FILES`); production
 * talks to the REST base beside the application.
 */
export const EDITOR_CFG: SpeechRecorderConfig = {
  apiEndPoint: environment.apiEndPoint,
  apiType: environment.apiType === 'files' ? ApiType.FILES : ApiType.NORMAL,
  apiVersion: environment.apiVersion,
  withCredentials: true,
  enableDownloadRecordings: false,
  enableUploadRecordings: false,
};

/**
 * Where the recorder application is served, for the tier-2 dry run (rest-api §6, plan M4 row
 * "E4 tier-2 preview"). The session opens at `{base}/spr/session/{id}` (the library's
 * `SPR_ROUTES` path); a deployment that mounts the recorder under a prefix sets it here. `''`
 * means the recorder is on the editor's own origin; `undefined` means the deployment has no
 * recorder, and tier 2 stays disabled with that reason.
 */
export const EDITOR_RECORDER_BASE_URL: string | undefined = environment.recorderBaseUrl;
