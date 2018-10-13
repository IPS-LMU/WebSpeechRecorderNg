
import {Uploader} from "../net/uploader";
import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

@Injectable()
 export class SpeechRecorderUploader extends Uploader{

  constructor(private httpClient:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig){
    super(httpClient,(config)?config.withCredentials:false);
  }
}
