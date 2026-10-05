// Template for the deployment specific `src/environments/environment.prod.ts`.
//
// A production build (`npm run build`, the default configuration) replaces `environment.ts` with
// that file, see the `fileReplacements` entry in angular.json. It is not tracked by git, so every
// deployment configures its own API endpoint: copy this sample over and edit the values. `npm run
// build` performs that copy when the file is missing, so a fresh checkout builds with these
// defaults.

// Deployment options of the recorder (SpeechRecorderConfig); the full list is documented in
// projects/speechrecorderng/README.md. Example: move the respondent display off `D`:
//   respondentDisplayKey: 'F9',

export const environment = {
  production: true,
  apiType: 'normal',
  // Absolute on purpose, like the editor's production environment: a deployment that mounts the
  // recorder under a path prefix (README §4.5 mounts it at `/wsr/ng/`) would otherwise resolve a
  // relative `api/v1` against that prefix - `/wsr/ng/api/v1` - and never reach the API. A
  // deployment behind another path sets this to its own absolute base.
  apiEndPoint: '/api/v1',
  apiVersion:1,
  enableDownloadRecordings:false,
  enableUploadRecordings: true,
  // The recording session the "Open the recorder" action leads to. Unset: the start page opens
  // the configuration picker, which offers the bundled configurations in
  // src/assets/configurations.json. A deployment that always runs one script sets its session id:
  //   defaultSessionId: 2,
  defaultSessionId: undefined,
  configurationCatalogUrl: 'assets/configurations.json'
};
