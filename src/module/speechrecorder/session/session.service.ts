import {Inject, Injectable, Optional} from '@angular/core';
import {Http} from "@angular/http";
import 'rxjs/add/operator/toPromise';

import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

export const SESSION_API_CTX='session';

@Injectable()
export class SessionService {

  private sessionsUrl:string;

  constructor(private http:Http,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    let apiEndPoint = ''

    if(config && config.apiEndPoint) {
      apiEndPoint=config.apiEndPoint;
    }
    if(apiEndPoint !== ''){
      apiEndPoint=apiEndPoint+'/'
    }

    this.sessionsUrl = apiEndPoint + SESSION_API_CTX;
  }

  getSession(id: string): Promise<any> {

    let sessUrl = this.sessionsUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      sessUrl = sessUrl + '.json';
    }
    let sessProms = this.http.get(sessUrl,{ withCredentials: true }).toPromise()
      .then(response => {
        return response.json();
      })
      .catch(this.handleError);

    return sessProms;
  }

  private handleError(error: any): Promise<any> {
    console.error('An error occurred', error); // for demo purposes only
    return Promise.reject(error.message || error);
  }
}



