import {SprDb, Sync} from "../db/inddb";
import {HttpClient} from "@angular/common/http";
import {Inject} from "@angular/core";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

import {Observable} from "rxjs";

export class GenericSprService<T> {

    private withCredentials: boolean = false;

    constructor(private keyname: string, private sprDb: SprDb, private http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) private config?: SpeechRecorderConfig) {

        let apiEndPoint = ''

        if (config && config.apiEndPoint) {
            apiEndPoint = config.apiEndPoint;
        }
        if (apiEndPoint !== '') {
            apiEndPoint = apiEndPoint + '/'
        }
        if (config != null && config.withCredentials != null) {
            this.withCredentials = config.withCredentials;
        }

    }

    postEntityObserver(entity:T,restUrl:string): Observable<T> {
        return this.http.post<T>(restUrl, entity,{withCredentials: this.withCredentials});
    }

    addEntityObserver(entity:T,entityId:string|number,restUrl:string): Observable<T> {

        let obs=new Observable<T>(subscriber => {

            let obs = this.sprDb.prepare();
            obs.subscribe(value => {
                let sessTr = value.transaction(this.keyname)
                let sSto = sessTr.objectStore(this.keyname);
                sSto.add(entity)
                sessTr.oncomplete = () => {
                    this.postEntityObserver(entity,restUrl).subscribe((value)=>{
                        // stored to db and to server
                        subscriber.next(value)
                    },(err)=>{
                        // Offline or other HTTP error
                        // mark for delayed synchronisation
                        let syncTr = value.transaction('_sync')
                        let syncSto = sessTr.objectStore('_sync');
                        let sync=new Sync(this.keyname,entityId)
                        syncSto.add(sync)
                        syncTr.oncomplete=()=>{
                            // OK: stored to db and marked for sync
                            subscriber.next(entity)
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



}