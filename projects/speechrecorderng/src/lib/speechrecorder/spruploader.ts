
import {Uploader} from "../net/uploader";
import {inject, Injectable} from "@angular/core";
import {SPEECHRECORDER_CONFIG} from "../spr.config";

@Injectable()
 export class SpeechRecorderUploader extends Uploader{

  constructor(){
    const config=inject(SPEECHRECORDER_CONFIG);
    super((config)?config.withCredentials:false);
  }
}
