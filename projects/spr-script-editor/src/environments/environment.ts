// Development configuration: `npm run start_editor` and `ng build spr-script-editor
// --configuration development` use this file. A production build replaces it with
// `environment.prod.ts`, see the `fileReplacements` entry in angular.json.
//
// `ApiType.FILES` makes the read services append `.json?requestUUID=…` and lets the editor work
// against the repository's fixtures: the dev server serves `src/test` at `/test`, and
// `apiEndPoint: 'test'` resolves a request such as `project/Demo1/script` to
// `/test/project/Demo1/script.json`. Writes are unavailable in this mode (rest-api.md).

export const environment = {
  production: false,
  apiType: 'files',
  apiEndPoint: 'test',
  apiVersion: 1,
  /** Tier 2 is disabled in fixture mode; a normal-mode dev run points this at the receiver. */
  recorderBaseUrl: '',
};
