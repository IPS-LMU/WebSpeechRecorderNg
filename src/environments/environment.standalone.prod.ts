import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";

export const environment = {
  production: false,
  apiType: 'standalone',
  apiEndPoint: 'test'
};

export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: 'test',
  apiType: ApiType.FILES,
  enableDownloadRecordings: true,
  enableUploadRecordings: false
};
