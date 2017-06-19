/**
 * Created by klausj on 17.06.2017.
 */
import { Injectable } from '@angular/core';
import {Http} from "@angular/http";
import 'rxjs/add/operator/toPromise';


@Injectable()
export class SessionService {
    private sessionsUrl = 'test/session/';  // URL to web api
    constructor(private http: Http) {

    }
   getSession(id:string):Promise<any>{

        // TODO REST without .json extension !!
       let sessProms=this.http.get(this.sessionsUrl+id+'.json').toPromise()
           .then(response => {return response.json();})
           .catch(this.handleError);
       return sessProms;
   }

    private handleError(error: any): Promise<any> {
        console.error('An error occurred', error); // for demo purposes only
        return Promise.reject(error.message || error);
    }
}



