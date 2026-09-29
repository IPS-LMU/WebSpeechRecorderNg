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
  enableUploadRecordings: true
};
