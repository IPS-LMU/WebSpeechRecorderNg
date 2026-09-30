// Default configuration: `ng serve` and `ng build --configuration development` use this file.
// A production build replaces it with the deployment specific `environment.prod.ts`, see the
// `fileReplacements` entry in angular.json and environment.prod.sample.ts.
//
// It talks to the evaluation receiver (`npm run serve:api`, see README), so a recording made in
// the development server is stored on disk instead of only in the browser. `ng serve` proxies
// `/api/v1` to the receiver (`proxy.conf.json`), so the endpoint stays relative and there is no
// cross origin request to configure.

export const environment = {
  production: false,
  apiType: 'normal',
  apiEndPoint: '/api/v1',
  apiVersion: 1,
  enableDownloadRecordings: true,
  enableUploadRecordings: true,
  // The recording session the "Open the recorder" action leads to. Unset: the start page opens
  // the configuration picker (standalone), which offers the bundled configurations in
  // src/assets/configurations.json so a session can be picked and tried out without a configured
  // recording procedure.
  defaultSessionId: undefined,
  configurationCatalogUrl: 'assets/configurations.json'
};
