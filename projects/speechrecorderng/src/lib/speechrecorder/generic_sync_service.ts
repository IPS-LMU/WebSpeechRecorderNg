import {SprDb, Sync} from "../db/inddb";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Inject} from "@angular/core";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

import {Observable} from "rxjs";

export class GenericSprService<T> {

    protected apiEndPoint=''
    protected withCredentials: boolean = false;

    constructor(private keyname: string, protected sprDb: SprDb, protected http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) protected config?: SpeechRecorderConfig) {

        if (config && config.apiEndPoint) {
            this.apiEndPoint = config.apiEndPoint;
        }
        if (this.apiEndPoint !== '') {
            this.apiEndPoint = this.apiEndPoint + '/'
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


    getAndCacheEntity(entityId: string|number,restUrl:string,httpParams:HttpParams):Observable<T>{
        let obs=new Observable<T>(subscriber => {
            this.http.get<T>(restUrl, {params:httpParams,withCredentials: this.withCredentials}).subscribe((entity)=>{

                // add or update fetched entity to indexed db
                let obs = this.sprDb.prepare();
                obs.subscribe(db => {
                    let tr = db.transaction(this.keyname,'readwrite')
                    let sto = tr.objectStore(this.keyname);
                    sto.put(entity)
                    tr.oncomplete = () => {
                        subscriber.next(entity)
                        subscriber.complete()
                    }
                    tr.onerror = () => {
                        subscriber.next(entity)
                        subscriber.complete()
                    }
                },(err)=>{
                    subscriber.next(entity)
                    subscriber.complete()
                })
            },(error)=>{
                // HTTP fetch failed, try to find in ind db cache
                let obs = this.sprDb.prepare();
                obs.subscribe(db => {
                    let tr = db.transaction(this.keyname)
                    let sto = tr.objectStore(this.keyname);
                    console.log("Get entity ID: "+entityId+" from store: "+this.keyname)
                    let r=sto.get(entityId)
                    r.onsuccess=(ev)=>{
                        console.log("Got entity ID: "+entityId+" : "+r.result)
                        subscriber.next(r.result)
                    }
                    tr.oncomplete = () => {
                        console.log("Transaction complete: got entity ID: "+entityId+" : "+r.result)
                        subscriber.complete()
                    }
                    tr.onerror = () => {
                        subscriber.error(error)
                    }
                },(err)=>{
                    subscriber.error(error)
                })
            },()=>{

            })

        })
        return obs;
    }

    getAndCacheEntities(restUrl:string,httpParams:HttpParams,indexName?:string,constr?:Array<string>):Observable<Array<T>>{
        let obs=new Observable<Array<T>>(subscriber => {
            this.http.get<Array<T>>(restUrl, {params:httpParams,withCredentials: this.withCredentials}).subscribe((entities)=>{

                // add or update fetched entity to indexed db
                let obs = this.sprDb.prepare();
                obs.subscribe(db => {
                    let tr = db.transaction(this.keyname,'readwrite')
                    let sto = tr.objectStore(this.keyname);

                    // delete old entities
                    if(indexName) {
                        let idx = sto.index(indexName)
                        let r = idx.getAllKeys(IDBKeyRange.only(constr));
                        r.onsuccess = (ev) => {
                            r.result.forEach((k) => {
                                sto.delete(k)
                            })
                        }
                    }else{
                        let r = sto.getAllKeys();
                        r.onsuccess = (ev) => {
                            r.result.forEach((k) => {
                                sto.delete(k)
                                console.info("Delete async: "+k)
                            })
                        }
                    }
                    entities.forEach((entity)=>{
                        let r=sto.put(entity)
                        console.info("Put async: "+entity)

                    })

                    tr.oncomplete = () => {
                        subscriber.next(entities)
                        subscriber.complete()
                    }
                    tr.onerror = (ev) => {
                        // We have frech scripts from server
                        // Proceed though indexed db failed
                        console.info("Indexed DB error "+ev)

                        subscriber.next(entities)
                        subscriber.complete()
                    }
                },(err)=>{
                    subscriber.next(entities)
                    subscriber.complete()
                })
            },(error)=>{
                // HTTP fetch failed, try to find in ind db cache
                let obs = this.sprDb.prepare();
                obs.subscribe(db => {
                    let tr = db.transaction(this.keyname)
                    let sto = tr.objectStore(this.keyname);
                    let ra:IDBRequest;
                    if(indexName) {
                        let idx = sto.index(indexName);
                        ra = idx.getAll(IDBKeyRange.only(constr));
                    }else{
                        ra = sto.getAll();
                    }
                    ra.onsuccess= (ev) => {
                        subscriber.next(ra.result)
                    }

                    tr.oncomplete = () => {
                        subscriber.complete()
                    }
                    tr.onerror = () => {
                        subscriber.error(error)
                    }
                },(err)=>{
                    subscriber.error(error)
                })
            },()=>{

            })

        })
        return obs;
    }



}