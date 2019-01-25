import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";


export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: 'test',
  apiType: ApiType.FILES,
  enableDownloadRecordings: true,
  enableUploadRecordings: false
};

// export const SPR_CFG:SpeechRecorderConfig={
//   apiEndPoint: 'api/v1',
//   apiType: null,
//   withCredentials:true
// }



