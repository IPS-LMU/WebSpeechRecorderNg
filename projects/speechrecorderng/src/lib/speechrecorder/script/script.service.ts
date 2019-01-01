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
import {forEach} from "@angular/router/src/utils/collection";
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
      httpParams.append('order-direction','DESC')
      httpParams.append('order-by', 'sessions._size')
      httpParams.append('limit',ScriptService.SCRIPTS_FETCH_COUNT_LIMIT.toString())
    }

    let obs=new Observable<Array<Script>>(subscriber => {
      let obsHttp = this.http.get<Array<Script>>(scrsUrl, {params:httpParams,withCredentials: this.withCredentials});
      obsHttp.subscribe(scripts => {
        // OK fresh data from server
        // save to indexed db
        let scrsObs = this.sprDb.prepare();
        scrsObs.subscribe(db => {
          let scrTr = db.transaction('script','readwrite')
          let scrSto = scrTr.objectStore('script');
          // delete old scripts
          let scrPrjIdx=scrSto.index('projectIdx')
          let r=scrPrjIdx.getAllKeys(IDBKeyRange.only([projectName]));
          r.onsuccess= (ev) => {
              r.result.forEach((k)=>{
                scrSto.delete(k)
              })
          }

          scripts.forEach((scr)=>{
            scr.project=projectName
            scrSto.put(scr)
          })

          scrTr.oncomplete = () => {
            subscriber.next(scripts)
          }
          scrTr.onerror = () => {
            // We have frech scripts from server
            // Proceed though indexed db failed
            console.error("Failed to store scripts from server")
            subscriber.next(scripts)

          }
        },(err)=>{
          // We have frech scripts from server
          // Proceed though indexed db failed
          console.error("Failed to store scripts from server")
          subscriber.next(scripts)

        })



      }, err => {
        console.info("Fetching scripts from server failed")
        let obs = this.sprDb.prepare();
        obs.subscribe(value => {
              let scrsTr = value.transaction(ScriptService.SCRIPT_KEYNAME)
              let sSto = scrsTr.objectStore(ScriptService.SCRIPT_KEYNAME);
              // TODO only scripts for certain project
              let allS = sSto.getAll();
              allS.onsuccess=(ev)=>{
                console.info("Found " + allS.result.length + " scripts in indexed db")
                subscriber.next(<Array<Script>>allS.result);

              }
              scrsTr.oncomplete=(ev)=>{
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



