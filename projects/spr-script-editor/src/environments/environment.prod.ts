// Production configuration: a production build replaces `environment.ts` with this file
// (angular.json `fileReplacements`). The API base is **absolute** on purpose: a deployment that
// serves the editor under a path prefix (README §4.5 mounts it at `/wsr/edit/`) would otherwise
// resolve a relative `api/v1` against that prefix, while the receiver serves it beside the
// application at `/api/v1`. A deployment behind another path sets this to its own absolute base.

export const environment = {
  production: true,
  apiType: 'normal',
  apiEndPoint: '/api/v1',
  apiVersion: 1,
  /** Tier-2 dry run: `''` when the recorder is served on the editor's own origin, else its base,
   *  e.g. `/wsr/ng` under the documented deployment. */
  recorderBaseUrl: '',
  /** The deployment's login page for the 401 redirect (ui-spec §1); empty when the deployment has none. */
  loginUrl: '',
};
