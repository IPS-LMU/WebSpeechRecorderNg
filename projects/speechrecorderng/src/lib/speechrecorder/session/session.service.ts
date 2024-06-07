import {Inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {UUID} from "../../utils/utils";
import {BehaviorSubject, Observable} from "rxjs";
import {ProjectService} from "../project/project.service";
import {Project} from "../project/project";



@Injectable()
export class SessionService {
  get uploadCount(): number {
    return this._uploadCount;
  }
  public static readonly SESSION_API_CTX='session';
  private apiEndPoint='';
  private readonly sessionsUrl:string;
  private readonly withCredentials:boolean=false;
  private _uploadCount=0;
  private static _behaviourSubjectSession:BehaviorSubject<Session>|null=null;

  constructor(private http:HttpClient,private projectService:ProjectService,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

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
      obs.subscribe({
      next:(value) =>
      {
        subscriber.next(value);
      }
      ,error: error => {
        this._uploadCount--;
        subscriber.error(error);
      }, complete:() => {
        this._uploadCount--;
        subscriber.complete();
      }
    });
    });
    return wrapObs;
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

  static behaviourSubjectSession(): BehaviorSubject<Session> {
    if(!SessionService._behaviourSubjectSession){
      const bsStandalonePrj=ProjectService.behaviourSubjectProject();
      const newSess:Session={sessionId:0,project:bsStandalonePrj.value.name,status:'LOADED',type:"NORM",script:0};

      SessionService._behaviourSubjectSession=new BehaviorSubject<Session>(newSess);
      console.debug("Behavior subject for session created.");
    }
    return SessionService._behaviourSubjectSession;
  }

}



