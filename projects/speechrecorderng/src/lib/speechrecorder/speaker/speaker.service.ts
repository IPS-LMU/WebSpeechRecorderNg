import {BasicService} from "../../net/basic_service";
import {Speaker} from "./speaker";
import {HttpClient} from "@angular/common/http";
import {Inject} from "@angular/core";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Observable} from "rxjs";

export const SPEAKER_API_CTX='speaker'

export class SpeakerService extends BasicService<Speaker>{

  constructor(protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(http,config);

  }

  speakerObservable(speakerId:number|string):Observable<Speaker>{
      let url=this.apiEndPoint+'/'+SPEAKER_API_CTX;
      return this.entityObserver(url);
  }

}
