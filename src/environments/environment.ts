// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

import {SPR_ENVIRONMENT_DEFAULTS} from "../../projects/speechrecorderng/src/lib/environment/environment.defaults";
export const environment = {
  ...SPR_ENVIRONMENT_DEFAULTS,

  production: false,
  apiType: 'files',
  apiEndPoint: 'test',
  enableDownloadRecordings:true,
  enableUploadRecordings: false
};
