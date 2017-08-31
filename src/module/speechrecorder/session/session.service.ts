import {Inject, Injectable, Optional} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import 'rxjs/add/operator/toPromise';

import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

export const SESSION_API_CTX='session';

@Injectable()
export class SessionService {

  private sessionsUrl:string;
  private withCredentials:boolean=false;

  constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    let apiEndPoint = ''

    if(config && config.apiEndPoint) {
      apiEndPoint=config.apiEndPoint;
    }
    if(apiEndPoint !== ''){
      apiEndPoint=apiEndPoint+'/'
    }
    if(config!=null && config.withCredentials!=null){
      this.withCredentials=config.withCredentials;
    }
    this.sessionsUrl = apiEndPoint + SESSION_API_CTX;
  }

  getSession(id: string): Promise<any> {

    let sessUrl = this.sessionsUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      sessUrl = sessUrl + '.json';
    }
    let sessProms = this.http.get(sessUrl,{ withCredentials: this.withCredentials }).toPromise()
      .then(response => {

        return response;
      })
      .catch(this.handleError);

    return sessProms;
  }

  private handleError(error: any): Promise<any> {
    console.error('An error occurred', error); // for demo purposes only
    return Promise.reject(error.message || error);
  }
}



