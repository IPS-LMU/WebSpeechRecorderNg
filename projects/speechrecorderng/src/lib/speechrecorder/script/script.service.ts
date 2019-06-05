/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Script} from "./script";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {Session} from "../session/session";
import {ProjectService} from "../project/project.service";
import {SprDb, Sync} from "../../db/inddb";
import {GenericSprService} from "../generic_sync_service";

interface ScriptServiceRESTParams{
  'order-direction'?: string,
  'order-by'?: string,
  'limit'?: number,
  'requestUUID'?: string
}

@Injectable()
export class ScriptService extends GenericSprService<Script>{
  public static readonly SCRIPT_KEYNAME='script';
  // Limit of fetched scripts count
  public static readonly SCRIPTS_FETCH_COUNT_LIMIT=100;

  private scriptCtxUrl:string;

  constructor(protected sprDb:SprDb,protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(ScriptService.SCRIPT_KEYNAME,sprDb,http,config)

    this.scriptCtxUrl = this.apiEndPoint + ScriptService.SCRIPT_KEYNAME;

  }

  scriptObservable(id:string | number):Observable<Script>{
    let httpParams=new HttpParams()
    httpParams.set('cache','false');

    let scriptUrl = this.scriptCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      scriptUrl = scriptUrl + '.json?requestUUID='+UUID.generate();
    }
    //return  this.http.get<Script>(scriptUrl,{params:httpParams, withCredentials: this.withCredentials })
    return this.getAndCacheEntity(id, scriptUrl,httpParams)
   }


   randomProjectScriptObserver(projectName: string):Observable<Script>{
      let obs=new Observable<Script>((subscriber) => {
          let scripts:Array<Script>;
          let allscrsObs=this.projectScriptsObserver(projectName).subscribe((nextScrs)=>{
              scripts=nextScrs;
          },(err)=>{
              subscriber.error(err)
          },()=>{
              let lenScrs=scripts.length;
              if(lenScrs>0) {
                  // TODO is this corrcet?
                  let scrsRanIdx = Math.floor(Math.random() * lenScrs);
                  let ranScr = scripts[scrsRanIdx];
                  subscriber.next(ranScr);
              } // else no next call
              subscriber.complete();
          })
      });
     return obs;
   }

  projectScriptsObserver(projectName: string): Observable<Array<Script>> {

    // Example URL: /api/v1/project/_iOS_Test/script?order-direction=DESC&order-by=sessions._size&limit=10
    let httpParams=new HttpParams()
    httpParams.set('cache','false');

    let scrsUrl = this.apiEndPoint+ '/'+ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+ScriptService.SCRIPT_KEYNAME


    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      scrsUrl = scrsUrl + '/_list.json?requestUUID='+UUID.generate();

    }else{
        // Some projects may have many scripts, limit the count of fetched scripts and let them be ordered by the server:
        // Scripts with fewer count of sessions first (lowest usage).
        // This should make sure that the scripts are used evenly
      httpParams.append('order-direction','DESC')
      httpParams.append('order-by', 'sessions._size')
      httpParams.append('limit',ScriptService.SCRIPTS_FETCH_COUNT_LIMIT.toString())
    }

    return this.getAndCacheEntities(scrsUrl,httpParams,'projectIdx',[projectName])

  }

  addProjectScript(projectName:string,script:Script):Observable<Script>{
      let httpParams=new HttpParams()

      let scrUrl = this.apiEndPoint+ '/'+ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+ScriptService.SCRIPT_KEYNAME+'/'+script.scriptId


      if (this.config && this.config.apiType === ApiType.FILES) {
          // for development and demo
          // append UUID to make request URL unique to avoid localhost server caching
          scrUrl = scrUrl + '/.json?requestUUID='+UUID.generate();

      }
      return this.addEntityObserver(script,script.scriptId,scrUrl);
  }
    // postProjectScriptObserver(session:Script): Observable<Session> {
    //
    //     let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+session.project+'/'+SessionService.SESSION_API_CTX +'/'+session.sessionId
    //
    //     return this.http.post<Session>(sesssUrl, session,{withCredentials: this.withCredentials});
    //
    // }
    //
    //
    // projectAddSessionObserver(projectName: string,script:Script): Observable<Script> {
    //
    //     let scrUrl = this.apiEndPoint+ '/'+ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+ScriptService.SCRIPT_KEYNAME+'/'+script.scriptId
    //
    //
    //     if (this.config && this.config.apiType === ApiType.FILES) {
    //         // for development and demo
    //         // append UUID to make request URL unique to avoid localhost server caching
    //         scrUrl = scrUrl + '/.json?requestUUID='+UUID.generate();
    //
    //     }
    //     let obs=new Observable<Script>(subscriber => {
    //
    //         console.info("Adding script to db")
    //         let obs = this.sprDb.prepare();
    //         obs.subscribe(value => {
    //             let scrTr = value.transaction('script','readwrite')
    //             let sSto = scrTr.objectStore('script');
    //             sSto.add(script)
    //             scrTr.oncomplete = () => {
    //                 this.postProjectScriptObserver(script).subscribe((s)=>{
    //                     // stored to db and to server
    //                     subscriber.next(script)
    //                 },(err)=>{
    //                     // Offline or other HTTP error
    //                     // mark for delayed synchronisation
    //                     let syncTr = value.transaction('_sync','readwrite')
    //                     let syncSto = syncTr.objectStore('_sync');
    //                     let sync=new Sync('script',script.scriptId)
    //                     syncSto.add(sync)
    //                     syncTr.oncomplete=()=>{
    //                         // OK: stored to db and marked for sync
    //                         subscriber.next(script)
    //                         subscriber.complete()
    //                     }
    //                     syncTr.onerror=()=>{
    //                         subscriber.error(err)
    //                     }
    //                 },() => {
    //                     // OK stored to db and to server complete
    //                     subscriber.complete()
    //                 })
    //
    //             }
    //         },(err)=>{
    //             subscriber.error(err)
    //         })
    //     });
    //     return obs;
    // }
    //


}



