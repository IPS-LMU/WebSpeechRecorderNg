/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import 'rxjs/add/operator/toPromise';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";


export const SCRIPT_API_CTX='script'

@Injectable()
export class ScriptService {
  private scriptCtxUrl:string;

  constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    let apiEndPoint = ''

    if(config && config.apiEndPoint) {
      apiEndPoint=config.apiEndPoint;
    }
    if(apiEndPoint !== ''){
      apiEndPoint=apiEndPoint+'/'
    }

    this.scriptCtxUrl = apiEndPoint + SCRIPT_API_CTX;
  }

  getScript(id:string):Promise<any>{

    let scriptUrl = this.scriptCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      scriptUrl = scriptUrl + '.json';
    }
    let scriptProms = this.http.get(scriptUrl,{ withCredentials: true }).toPromise()
      .then(response => {
        return response;
      })
      .catch(this.handleError);

    return scriptProms;
   }

    private handleError(error: any): Promise<any> {

        let errMsg='Could not load script '+error.message;
        console.error(errMsg, error);
        return Promise.reject(errMsg);
    }
}



