// import {Inject, Injectable, Optional} from '@angular/core';
//
// import 'rxjs/add/operator/toPromise';
//
// import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
// import {HttpClient} from "@angular/common/http";
//
// export const SESSION_API_CTX='session';
//
// export const RECFILE_API_CTX='recfile';
//
// @Injectable()
// export class SessionService {
//
//
//
//   constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {
//
//     let apiEndPoint = ''
//
//     if(config && config.apiEndPoint) {
//       apiEndPoint=config.apiEndPoint;
//     }
//     if(apiEndPoint !== ''){
//       apiEndPoint=apiEndPoint+'/'
//     }
//
//
//   }
//
//   postRecFile(sessionId: string,itemcode: string,recFile:any): Promise<any> {
//
//     let rfUrl = SESSION_API_CTX + '/' + sessionId+'/'+RECFILE_API_CTX+'/'+itemcode;
//
//     let rfProms = this.http.post(rfUrl,recFile,{ withCredentials: true }).toPromise()
//       .then(response => {
//         return response;
//       })
//       .catch(this.handleError);
//
//     return rfProms;
//   }
//
//   private handleError(error: any): Promise<any> {
//     console.error('An error occurred', error); // for demo purposes only
//     return Promise.reject(error.message || error);
//   }
// }
//
//
//
