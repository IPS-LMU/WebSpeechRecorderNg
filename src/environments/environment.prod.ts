import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";

export const environment = {
  production: true,
  apiEndPoint: 'api/v1'
};
export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: 'api/v1',
  apiType: ApiType.NORMAL,
  enableDownloadRecordings: true,
  enableUploadRecordings: true
};