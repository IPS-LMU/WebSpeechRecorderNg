// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";

export const environment = {
  production: false,
  apiType: 'standalone',
  apiEndPoint: 'test'
};

export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: 'test',
  apiType: ApiType.STANDALONE,
  enableDownloadRecordings: true,
  enableUploadRecordings: false
};

