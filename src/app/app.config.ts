import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";
import {environment} from "../environments/environment";


export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: environment.apiEndPoint,
  apiType: (environment.apiType==='files')?ApiType.FILES:ApiType.NORMAL,
  withCredentials:true,
  enableDownloadRecordings: environment.enableDownloadRecordings,
  enableUploadRecordings: environment.enableUploadRecordings
};


