/**
 * Created by klausj on 17.06.2017.
 */
import { Injectable } from '@angular/core';
import {Http} from "@angular/http";
import 'rxjs/add/operator/toPromise';


@Injectable()
export class ScriptService {
    private scriptsUrl = 'test/script/';
    constructor(private http: Http) {

    }
   getScript(id:string):Promise<any>{

        // TODO REST without .json extension !!
       let scriptProms=this.http.get(this.scriptsUrl+id+'.json').toPromise()
           .then(response => {
             return response.json();
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



