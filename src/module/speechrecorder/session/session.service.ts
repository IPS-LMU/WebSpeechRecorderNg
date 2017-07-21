import {Inject, Injectable} from '@angular/core';
import {Http} from "@angular/http";
import 'rxjs/add/operator/toPromise';
import {environment} from "../../../environments/environment";
import {Config} from "../spr.module";


@Injectable()
export class SessionService {
  private sessionsApiCtx = 'session';  // URL to web api
  private sessionsUrl:string;
  private config:Config|null=null;

  constructor(private http: Http) {
    let apiEndPoint = 'test'

    if(this.config) {
      apiEndPoint=this.config.apiEndPoint ? this.config.apiEndPoint : 'api/v1';
    }

    this.sessionsUrl = apiEndPoint + '/' + this.sessionsApiCtx;
  }

  getSession(id: string): Promise<any> {

    let sessUrl = this.sessionsUrl + '/' + id;
    if (environment.apiType === 'files') {
      // for development and demo
      sessUrl = sessUrl + '.json';
    }
    let sessProms = this.http.get(sessUrl).toPromise()
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



