import {SprDb, Sync} from "../db/inddb";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Inject} from "@angular/core";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";

import {Observable, Subscriber} from "rxjs";

export class GenericSprService<T> {

    protected apiEndPoint=''
    protected withCredentials: boolean = false;
    
    protected static online:boolean=true;
    protected static standalone:boolean=false;

    constructor(public keyname: string, protected sprDb: SprDb, protected http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) protected config?: SpeechRecorderConfig) {

        if(config && config.apiType && config.apiType===ApiType.STANDALONE){

          GenericSprService.standalone=true;
          GenericSprService.online=false;
        }

        console.log("Standalone: "+GenericSprService.standalone)

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

    private markForSync(subscriber:Subscriber<T>,tr:IDBTransaction,entity:T,entityId:string|number){
        // Offline or other HTTP error
        // mark for delayed synchronisation

        let syncSto = tr.objectStore('_sync');
        let sync=new Sync(this.keyname,entityId)
        syncSto.add(sync)
        tr.oncomplete=()=>{
            // OK: stored to db and marked for sync
            subscriber.next(entity)
            subscriber.complete()
        }
        tr.onerror=()=>{
            subscriber.error()
        }
    }
    addEntityObserver(entity:T,entityId:string|number,restUrl:string): Observable<T> {

        let obs=new Observable<T>(subscriber => {
            let keyNm=this.keyname;
            let obs = this.sprDb.prepare();
            obs.subscribe(value => {
                let entTr = value.transaction([keyNm,'_sync'],"readwrite")
                let entSto = entTr.objectStore(keyNm);
                entSto.add(entity)
                entTr.oncomplete = () => {
                    if(GenericSprService.online) {
                        this.postEntityObserver(entity, restUrl).subscribe((value) => {
                            // stored to db and to server
                            subscriber.next(value)
                        }, (err) => {
                            this.markForSync(subscriber, entTr, entity, entityId);
                        }, () => {
                            // OK stored to db and to server complete
                            subscriber.complete()
                        })
                    }else if(!GenericSprService.standalone){
                        // do not try, but mark for sync
                        this.markForSync(subscriber, entTr, entity, entityId);
                    }
                }
            },(err)=>{
                subscriber.error(err)
            })
        });
        return obs;
    }


    getAndCacheEntity(entityId: string|number,restUrl:string,httpParams:HttpParams):Observable<T>{
        let obs=new Observable<T>(subscriber => {
            let entity:T;
            let entitiesReceived=0;
            this.http.get<T>(restUrl, {params:httpParams,withCredentials: this.withCredentials}).subscribe((nextEntity)=>{
                entitiesReceived++;

                entity=nextEntity;

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
                if(entitiesReceived>1){
                    subscriber.error("Ambiguous result. Expected exactly one entity!")
                }else {
                    // add or update fetched entity to indexed db
                    let obs = this.sprDb.prepare();
                    obs.subscribe(db => {
                        let tr = db.transaction(this.keyname, 'readwrite')
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
                    }, (err) => {
                        subscriber.next(entity)
                        subscriber.complete()
                    })
                }
            })

        })
        return obs;
    }


  entityExists(entityId: string|number,restUrl:string,httpParams:HttpParams):Observable<boolean>{
    let obs=new Observable<boolean>(subscriber => {
      let entity:T;
      let entitiesReceived=0;
      this.http.get<T>(restUrl, {params:httpParams,withCredentials: this.withCredentials}).subscribe((nextEntity)=>{
        entitiesReceived++;

        entity=nextEntity;

      },(error)=>{
        // HTTP fetch failed, try to find in ind db cache
        let obs = this.sprDb.prepare();
        obs.subscribe(db => {
          let tr = db.transaction(this.keyname)
          let sto = tr.objectStore(this.keyname);
          console.log("Get entity ID: "+entityId+" from store: "+this.keyname+ ": "+entity)
          let r=sto.get(entityId)
          r.onsuccess=(ev)=>{
            let exists:boolean=(r.result);
            subscriber.next(exists)
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
        if(entitiesReceived>1){
          subscriber.error("Ambiguous result. Expected exactly one entity!")
        }else {
          let exists: boolean = (entity != null);
          subscriber.next(exists)
          subscriber.complete()
        }
      })

    })
    return obs;
  }




  private cachedEntities(indexName?:string,constr?:Array<string>):Observable<Array<T>>{
      let obs=new Observable<Array<T>>(subscriber => {
        let entities: Array<T>;
        let entitiesReceived = 0;

        let dbObs = this.sprDb.prepare();
        dbObs.subscribe(db => {
          let tr = db.transaction(this.keyname)
          let sto = tr.objectStore(this.keyname);
          let ra: IDBRequest;
          if (indexName) {
            let idx = sto.index(indexName);
            ra = idx.getAll(IDBKeyRange.only(constr));
          } else {
            ra = sto.getAll();
          }
          ra.onsuccess = (ev) => {
            subscriber.next(ra.result)
          }

          tr.oncomplete = () => {
            subscriber.complete()
          }
          tr.onerror = () => {
            subscriber.error(new Error("Indexed DB transaction on object store "+this.keyname+" failed."))
          }
        }, (err) => {
          subscriber.error(new Error("Getting Indexed DB for object store "+this.keyname+" failed."))
        })
      });
      return obs;
    }

    getAndCacheEntities(restUrl:string,httpParams:HttpParams,indexName?:string,constr?:Array<string>):Observable<Array<T>>{
      let obs:Observable<Array<T>>;
      if(GenericSprService.standalone){
        obs=this.cachedEntities(indexName,constr);
      }else {

        obs = new Observable<Array<T>>(subscriber => {
          let entities: Array<T>;
          let entitiesReceived = 0;

          this.http.get<Array<T>>(restUrl, {
            params: httpParams,
            withCredentials: this.withCredentials
          }).subscribe((nextEntities) => {
            entitiesReceived++;
            entities = nextEntities;

          }, (error) => {
            // HTTP fetch failed, try to find in ind db cache
            obs=this.cachedEntities(indexName,constr);
            obs.subscribe((nextEntities)=>{
                subscriber.next(nextEntities);
            },error1 => {
              subscriber.error(error1)
            },()=>{
              subscriber.complete()
            })
          }, () => {
            // add or update fetched entity to indexed db
            let obs = this.sprDb.prepare();
            obs.subscribe(db => {
              let tr = db.transaction(this.keyname, 'readwrite')
              let sto = tr.objectStore(this.keyname);

              // delete old entities
              let r;
              if (indexName) {
                let idx = sto.index(indexName)
                r = idx.getAllKeys(IDBKeyRange.only(constr));
              } else {
                r = sto.getAllKeys();
              }
              r.onsuccess = (ev) => {
                r.result.forEach((k) => {
                  sto.delete(k)
                })

                entities.forEach((entity) => {
                  let r = sto.put(entity)
                  console.info("Put async: " + entity)

                })
              }

              tr.oncomplete = () => {
                // OK  fresh data from HTTP stored to db
                subscriber.next(entities)
                subscriber.complete()
              }
              tr.onerror = (ev) => {
                // We have fresh entities from server, bt indexed db storage failed
                console.info("Indexed DB error " + ev)
                // Proceed anyway
                subscriber.next(entities)
                subscriber.complete()
              }
            }, (err) => {
              subscriber.next(entities)
              subscriber.complete()
            })
          })

        })

      }
      return obs;
    }



}
