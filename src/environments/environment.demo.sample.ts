// Example of an offline/standalone configuration: `apiType: 'files'` reads the recordings from
// `src/test` instead of a REST API. angular.json defines no configuration for it — copy it over
// `environment.ts` (used by `ng serve` and `ng build --configuration development`) to run with it.

export const environment = {
  production: true,
  apiType: 'files',
  apiEndPoint: 'test',
  apiVersion:1,
  enableDownloadRecordings:true,
  enableUploadRecordings: false
};
