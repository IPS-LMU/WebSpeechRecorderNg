import {Injectable, InjectionToken} from "@angular/core";

export const SPEECHRECORDER_CONFIG = new InjectionToken<SpeechRecorderConfig>('speechrecorder.config');


export enum ApiType {
  NORMAL,FILES
}
@Injectable()
export class SpeechRecorderConfig{
  pubApiEndPoint?: string | null=null;
  apiEndPoint?: string | null=null;
  apiType?: ApiType | null=null;
  apiVersion: number=1;
  withCredentials?: boolean=false;
  enableDownloadRecordings?: boolean=false;
  enableUploadRecordings?: boolean=true;
  constructor(){
    this.apiEndPoint=null;
    this.apiType=null;
    this.withCredentials=false;
  }
}

