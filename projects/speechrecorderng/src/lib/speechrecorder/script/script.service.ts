/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Script} from "./script";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {BasicService} from "../../net/basic_service";


@Injectable()
export class ScriptService extends BasicService<Script>{

  public static readonly SCRIPT_API_CTX='script';

  private readonly scriptCtxUrl:string;

  constructor() {
    super();
    this.scriptCtxUrl = this.apiEndPoint + ScriptService.SCRIPT_API_CTX;
  }

  scriptUrlString(id:string | number):string{
    let encScriptId=encodeURIComponent(id);
    let scriptUrlStr = this.scriptCtxUrl + '/' + encScriptId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      scriptUrlStr = scriptUrlStr + '.json?requestUUID='+UUID.generate();
    }
    return scriptUrlStr
  }

  scriptUrl(id:string | number):URL{
    const scriptUrlStr=this.scriptUrlString(id);
    const url=new URL(scriptUrlStr);
    return url;
  }

  scriptObservable(id:string | number):Observable<Script>{
    let encScriptId=encodeURIComponent(id);
    let scriptUrl = this.scriptCtxUrl + '/' + encScriptId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      scriptUrl = scriptUrl + '.json?requestUUID='+UUID.generate();
    }
    return  this.http.get<Script>(scriptUrl,{withCredentials: this.withCredentials })
   }

  scriptAsXmlObservable(id:string ):Observable<string>{
    const encScriptId=encodeURIComponent(id);
    let scriptUrl = this.scriptCtxUrl + '/' + encScriptId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      scriptUrl = scriptUrl + '.json?requestUUID='+UUID.generate();
    }
    let headers = new HttpHeaders();
    headers = headers.set('Accept', 'application/xml');

    return  this.http.get(scriptUrl,{
      withCredentials: this.withCredentials,
      responseType: 'text',
      headers:headers
    });
  }


}



