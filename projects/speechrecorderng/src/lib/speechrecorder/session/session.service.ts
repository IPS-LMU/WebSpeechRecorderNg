import {Inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {ProjectService} from "../project/project.service";
import {SprDb} from "../../../../../../src/app/db/inddb";



@Injectable()
export class SessionService {
  public static readonly SESSION_API_CTX='session';
  private sessionsUrl:string;
  private withCredentials:boolean=false;

  constructor(private sprDb:SprDb,private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

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
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sessUrl = sessUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<Session>(sessUrl,{ withCredentials: this.withCredentials });

  }

  projectSessionsObserver(projectName: string): Observable<Array<Session>> {

    let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+SessionService.SESSION_API_CTX
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sesssUrl = sesssUrl + '_list.json?requestUUID='+UUID.generate();
    }

    let obs=new Observable<Array<Session>>(subscriber => {
      let obsHttp = this.http.get<Array<Session>>(sesssUrl, {withCredentials: this.withCredentials});
      obsHttp.subscribe(value => {
        // OK fresh data from server
        subscriber.next(value)

      }, err => {
        console.info("Fetching sessions from server failed")
        let obs = this.sprDb.prepare();
        obs.subscribe(value => {
              let sessTr = value.transaction('session')
              let sSto = sessTr.objectStore('session');
              let allS = sSto.getAll();
              allS.onsuccess=(ev)=>{
                console.info("Found " + allS.result.length + " sessions")
                subscriber.next(<Array<Session>>allS.result);
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
    })
  return obs


  }

}





