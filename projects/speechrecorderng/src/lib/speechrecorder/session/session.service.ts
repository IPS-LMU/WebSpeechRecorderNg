import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {ProjectService} from "../project/project.service";



@Injectable()
export class SessionService {
  get uploadCount(): number {
    return this._uploadCount;
  }
  public static readonly SESSION_API_CTX='session';
  private apiEndPoint='';
  private sessionsUrl:string;
  private withCredentials:boolean=false;
  private _uploadCount=0;

  constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    if(config && config.apiEndPoint) {
      this.apiEndPoint=config.apiEndPoint;
    }
    if(this.apiEndPoint !== ''){
      this.apiEndPoint=this.apiEndPoint+'/'
    }
    if(config!=null && config.withCredentials!=null){
      this.withCredentials=config.withCredentials;
    }
    this.sessionsUrl = this.apiEndPoint + SessionService.SESSION_API_CTX;
  }

  sessionObserver(id: string): Observable<Session> {

    let sessUrl = this.sessionsUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sessUrl = sessUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<Session>(sessUrl,{ withCredentials: this.withCredentials });

  }

  patchSessionObserver(session:Session,body:any): Observable<Session> {

    let sesssUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + session.project + '/' + SessionService.SESSION_API_CTX + '/' + session.sessionId

    let wrapObs = new Observable<Session>(subscriber => {
      this._uploadCount++;
      let obs = this.http.patch<Session>(sesssUrl, body, {withCredentials: this.withCredentials});
      obs.subscribe((value) => {
        subscriber.next(value);
      }, error => {
        this._uploadCount--;
        subscriber.error(error);
      }, () => {
        this._uploadCount--;
        subscriber.complete();
      });
    });
    return wrapObs;
  }

  projectSessionsObserver(projectName: string,orderBy?:string,orderDirection?:string,compat=true): Observable<Array<Session>> {

    let sesssUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' + SessionService.SESSION_API_CTX
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sesssUrl = sesssUrl + '_list.json?requestUUID=' + UUID.generate();
    }
    let params=new HttpParams();
    if(orderBy) {
      if(compat) {
        params = params.set('order-by', orderBy);
      }else{
        params = params.set('_order-by', orderBy);
      }
      let od='DESC';
      if(orderDirection){
        od=orderDirection.toUpperCase();
      }
      if(compat) {
        params = params.set('order-direction', od);
      }else{
        params = params.set('_order-direction', od);
      }
    }
    return this.http.get<Array<Session>>(sesssUrl,{ params:params,withCredentials: this.withCredentials });
  }

  // putSessionObserver(session: Session): Observable<Session> {
  //
  //   let sesssUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + session.project + '/' + SessionService.SESSION_API_CTX + '/' + session.session
  //
  //   let wrapObs = new Observable<Session>(subscriber => {
  //     this._uploadCount++;
  //     let obs = this.http.put<Session>(sesssUrl, session, {withCredentials: this.withCredentials});
  //     obs.subscribe((value) => {
  //       subscriber.next(value);
  //     }, error => {
  //       this._uploadCount--;
  //       subscriber.error(error);
  //     }, () => {
  //       this._uploadCount--;
  //       subscriber.complete();
  //     });
  //   });
  //   return wrapObs;
  // }
  //


}



