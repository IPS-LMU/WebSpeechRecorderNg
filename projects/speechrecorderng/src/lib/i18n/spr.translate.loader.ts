import {TranslateLoader, TranslationObject} from "@ngx-translate/core";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {Inject} from "@angular/core";
import {SpeechRecorderConfig} from "../spr.config";
import {SPEECHRECORDER_CONFIG} from "../spr.config";

import translationsEN from "./en.json";
import translationsDE from "./de.json";


export class SprTranslateLoader extends TranslateLoader {
  public static readonly TRANSLATE_API_CTX='application/translate/i18n'

  private translateCtxUrl:string;

  private withCredentials:boolean=false;


  constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {
    super();
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

    this.translateCtxUrl = pubApiEndPoint + SprTranslateLoader.TRANSLATE_API_CTX;
  }
    override getTranslation(lang: string): Observable<TranslationObject> {
      let obs: Observable<TranslationObject>;
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
