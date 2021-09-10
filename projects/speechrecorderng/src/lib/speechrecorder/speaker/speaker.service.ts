import {BasicService} from "../../net/basic_service";
import {Speaker} from "./speaker";
import {HttpClient} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Observable} from "rxjs";


@Injectable()
export class SpeakerService extends BasicService<Speaker>{
  public static readonly SPEAKER_API_CTX='speaker';

  constructor(protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(http,config);
  }

  speakerObservable(speakerId:number|string):Observable<Speaker>{
      let encSpkId=encodeURIComponent(speakerId);
      let url=this.apiEndPoint+SpeakerService.SPEAKER_API_CTX+'/'+encSpkId;
      return this.entityObserver(url);
  }

}
