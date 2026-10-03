// Production configuration: a production build replaces `environment.ts` with this file
// (angular.json `fileReplacements`). Every deployment points `apiEndPoint` at the REST base beside
// the editor; the value here mirrors the recorder's `environment.prod.sample.ts` (`api/v1`).

export const environment = {
  production: true,
  apiType: 'normal',
  apiEndPoint: 'api/v1',
  apiVersion: 1,
};
