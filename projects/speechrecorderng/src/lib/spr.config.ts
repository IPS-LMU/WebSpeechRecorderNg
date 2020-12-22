import {Injectable, InjectionToken} from "@angular/core";

export const SPEECHRECORDER_CONFIG = new InjectionToken<SpeechRecorderConfig>('speechrecorder.config');


export enum ApiType {
  NORMAL,FILES
}
@Injectable()
export class SpeechRecorderConfig{
  apiEndPoint?: string | null=null;
  apiType?: ApiType | null=null;
  withCredentials?: boolean=false;
  enableDownloadRecordings?: boolean=false;
  enableUploadRecordings?: boolean=true;
  recordingFileMediaBytesCacheLimit?:number=1000*1000*100;

  constructor(){
    this.apiEndPoint=null;
    this.apiType=null;
    this.withCredentials=false;
  }
}

