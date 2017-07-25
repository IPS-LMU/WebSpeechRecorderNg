import {Injectable, InjectionToken} from "@angular/core";

export let SPEECHRECORDER_CONFIG = new InjectionToken<SpeechRecorderConfig>('speechrecorder.config');


@Injectable()
export class SpeechRecorderConfig{
  apiEndPoint: string | null=null;
  apiType: string | null=null;
  constructor(){
    this.apiEndPoint=null;
    this.apiType=null;
  }
}

