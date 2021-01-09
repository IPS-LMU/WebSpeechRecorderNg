import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {ProjectService} from "../project/project.service";
import {SprDb, Sync} from "../../db/inddb";
import {GenericSprService} from "../generic_sync_service";



@Injectable()
export class SessionService extends GenericSprService<Session>{
  public static readonly SESSION_API_CTX='session';
  private sessionsUrl:string;

  constructor(protected sprDb:SprDb,protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(SessionService.SESSION_API_CTX,sprDb,http,config)
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
    this.sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;


  }

  sessionObserver(id: string): Observable<Session> {

    let sessUrl = this.sessionsUrl + '/' + id;
    let httpParams=new HttpParams()
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sessUrl = sessUrl + '.json'
      httpParams.append('requestUUID',UUID.generate())
    }
    let obs=new Observable<Session>(subscriber => {
      let obsHttp = this.http.get<Session>(sessUrl, {withCredentials: this.withCredentials});
      obsHttp.subscribe(value => {
        // OK fresh data from server
        subscriber.next(value)

      }, err => {
        console.info("Fetching session from server failed")
        let obs = this.sprDb.prepare();
        obs.subscribe(value => {
              let sessTr = value.transaction('session')
              let sSto = sessTr.objectStore('session');
              let s = sSto.get(id)
              s.onsuccess = (ev) => {
                console.info("Found session in indexed db")
                subscriber.next(s.result);
                subscriber.complete()
              }

            }, (err) => {
              console.info("Db store not available")
              subscriber.error(err)

            }, () => {
              //subscriber.complete()
            }
        )
      }, () => {
        subscriber.complete()
      });
    });
    return obs
  }

  projectSessionsObserver(projectName: string): Observable<Array<Session>> {

    let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+SessionService.SESSION_API_CTX
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sesssUrl = sesssUrl + '_list.json?requestUUID='+UUID.generate();
    }

    return this.getAndCacheEntities(sesssUrl, new HttpParams(),'projectIdx',[projectName]);


  //   let obs=new Observable<Array<Session>>(subscriber => {
  //     let obsHttp = this.http.get<Array<Session>>(sesssUrl, {withCredentials: this.withCredentials});
  //     obsHttp.subscribe(value => {
  //       // OK fresh data from server
  //       subscriber.next(value)
  //
  //     }, err => {
  //       console.info("Fetching recordingFiles from server failed")
  //       let obs = this.sprDb.prepare();
  //       obs.subscribe(value => {
  //             let sessTr = value.transaction('session')
  //             let sSto = sessTr.objectStore('session');
  //             let allS = sSto.getAll();
  //             allS.onsuccess=(ev)=>{
  //               console.info("Found " + allS.result.length + " recordingFiles")
  //               subscriber.next(<Array<Session>>allS.result);
  //               subscriber.complete()
  //           }
  //
  //           }, (err) => {
  //             console.info("Db store not available")
  //             subscriber.error(err)
  //
  //           }, () => {
  //             //subscriber.complete()
  //           }
  //       )
  //     }, () => {
  //       subscriber.complete()
  //     });
  //   })
  // return obs


  }

  postProjectSessionObserver(session:Session): Observable<Session> {

    let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+session.project+'/'+SessionService.SESSION_API_CTX +'/'+session.sessionId

    return this.http.post<Session>(sesssUrl, session,{withCredentials: this.withCredentials});

  }
  projectAddSessionObserver(projectName: string,session:Session): Observable<Session> {

    let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+SessionService.SESSION_API_CTX+'/'+session.sessionId

    let obs=new Observable<Session>(subscriber => {

        console.info("Adding session to db")
        let obs = this.sprDb.prepare();
        obs.subscribe(value => {
          let sessTr = value.transaction('session','readwrite')
          let sSto = sessTr.objectStore('session');
          sSto.add(session)
          sessTr.oncomplete = () => {
            this.postProjectSessionObserver(session).subscribe((s)=>{
              // stored to db and to server
              subscriber.next(session)
            },(err)=>{
              // Offline or other HTTP error
              // mark for delayed synchronisation
              let syncTr = value.transaction('_sync','readwrite')
              let syncSto = syncTr.objectStore('_sync');
              let sync=new Sync('session',session.sessionId)
              syncSto.add(sync)
              syncTr.oncomplete=()=>{
                // OK: stored to db and marked for sync
                subscriber.next(session)
                subscriber.complete()
              }
              syncTr.onerror=()=>{
                subscriber.error(err)
              }
            },() => {
              // OK stored to db and to server complete
              subscriber.complete()
            })

          }
        },(err)=>{
          subscriber.error(err)
        })
  });
  return obs;
  }

  putSessionObserver(session:Session): Observable<Session> {

    let sesssUrl = this.apiEndPoint+ProjectService.PROJECT_API_CTX +'/'+session.project+'/'+SessionService.SESSION_API_CTX +'/'+session.sessionId

    //console.log("PUT session ID: "+session.sessionId+ " status: "+session.status)
    return this.http.put<Session>(sesssUrl, session,{withCredentials: this.withCredentials});

  }

}





