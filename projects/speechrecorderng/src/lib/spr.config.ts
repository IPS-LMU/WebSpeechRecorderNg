import {Injectable, InjectionToken} from "@angular/core";

export const SPEECHRECORDER_CONFIG = new InjectionToken<SpeechRecorderConfig>('speechrecorder.config');


export enum ApiType {
  NORMAL,STANDALONE,FILES
}
@Injectable()
export class SpeechRecorderConfig{
  apiEndPoint?: string | null=null;
  apiType?: ApiType | null=null;
  withCredentials?: boolean=false;
  enableDownloadRecordings?: boolean=false;
  enableUploadRecordings?: boolean=true;
  constructor(){
    this.apiEndPoint=null;
    this.apiType=null;
    this.withCredentials=false;
  }
}

