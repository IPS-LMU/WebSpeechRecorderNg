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
