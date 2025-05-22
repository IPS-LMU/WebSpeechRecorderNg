
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {inject, Inject, Injectable} from "@angular/core";
import {SpeechRecorderConfig} from "../spr.config";
import {SPEECHRECORDER_CONFIG} from "../spr.config";

import translationsEN from "./en.json";
import translationsDE from "./de.json";
import {Translation, TranslocoLoader} from "@jsverse/transloco";

@Injectable()
export class SprTranslocoLoader implements TranslocoLoader {
  private http = inject(HttpClient);
  public static readonly TRANSLATE_API_CTX='application/translate/i18n'

  private translateCtxUrl:string;

  private withCredentials:boolean=false;


  constructor(@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    let apiEndPoint = '';
    let pubApiEndPoint='';

    if(config && config.apiEndPoint) {
      apiEndPoint=config.apiEndPoint;
    }
    if(apiEndPoint !== ''){
      apiEndPoint=apiEndPoint+'/'
    }
    if(config && config.pubApiEndPoint) {
      pubApiEndPoint=config.pubApiEndPoint;
    }
    if(pubApiEndPoint !== ''){
      pubApiEndPoint=pubApiEndPoint+'/'
    }

    if(config!=null && config.withCredentials!=null){
      this.withCredentials=config.withCredentials;
    }

    this.translateCtxUrl = pubApiEndPoint + SprTranslocoLoader.TRANSLATE_API_CTX;
  }

  getTranslation(lang: string): Observable<Translation> {
      let obs: Observable<Translation>;
      if (lang === 'en') {
        console.debug("getTranslation: Return embedded translation en");
        obs = new Observable(observer => {
          observer.next(translationsEN);
        })
      } else if (lang === 'de') {
        console.debug("getTranslation: Return embedded translation de");
        obs = new Observable(observer => {
          observer.next(translationsDE);
        })
      } else {
        console.debug("getTranslation: Return server translation "+lang);
        const langEnc = encodeURIComponent(lang);
        obs = this.http.get<any>(this.translateCtxUrl +'/'+ langEnc, {withCredentials: this.withCredentials});
      }
      return obs;
    }
}
