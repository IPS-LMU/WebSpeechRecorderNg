import {Injectable} from '@angular/core';
import {Http} from "@angular/http";
import 'rxjs/add/operator/toPromise';
import {environment} from "../../../../environments/environment";


@Injectable()
export class SessionService {
  private sessionsApiCtx = 'session';  // URL to web api
  private sessionsUrl;

  constructor(private http: Http) {

    let apiEndPoint = environment.apiEndPoint ? environment.apiEndPoint : 'api';

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



