import {Injectable} from "@angular/core";
import {SessionFinishedDialog} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session_finished_dialog";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";
import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";
import {Observable} from "rxjs";


export class Sync{
    id?:number;
    _objectStoreName:string;
    _objectId:string|number;

    constructor(objectStoreName:string,objectId:string|number){
        this._objectStoreName=objectStoreName
        this._objectId=objectId
    }

    get objectStoreName():string{
       return  this._objectStoreName
    }

    get objectId():string|number{
        return this._objectId
    }
}

@Injectable()
export class SprDb {

    public static dbName='speechrecorder'
    public static dbVersion=2;

    private _store:IDBDatabase|null=null
    constructor(){
    }

    static sprDbFactory():SprDb{
       let sprDb=new SprDb();

        return sprDb;
    }



    prepare():Observable<IDBDatabase> {
        let obs = new Observable<IDBDatabase>((subscriber) => {

            // if (this._store) {
            //     subscriber.next(this._store)
            //     subscriber.complete()
            // } else {
                console.info("Prepare indexed database...")
                if (indexedDB) {
                    let or: IDBOpenDBRequest;
                    or = indexedDB.open(SprDb.dbName, SprDb.dbVersion);
                    or.onupgradeneeded = (ev) => {
                        let db = or.result

                        if (!db.objectStoreNames.contains('_sync')) {
                            db.createObjectStore('_sync', {keyPath: 'id', autoIncrement:true});
                        }
                        if (!db.objectStoreNames.contains('project')) {
                            db.createObjectStore('project', {keyPath: 'projectId'});
                        }
                        if (!db.objectStoreNames.contains('session')) {
                            db.createObjectStore('session', {keyPath: 'sessionId'});
                        }
                        if (!db.objectStoreNames.contains('script')) {
                            db.createObjectStore('script', {keyPath: 'scriptId'});
                        }
                        if (ev.oldVersion) {
                            console.info("Upgraded indexed database " + SprDb.dbName + " schema from version " + ev.oldVersion + " to " + ev.newVersion)
                        } else {
                            console.info("Created indexed database " + SprDb.dbName + " schema version " + ev.newVersion)
                        }
                    }
                    or.onsuccess = () => {
                        console.info("Opened indexed database")

                        //
                        // let testTr = or.result.transaction('session', 'readwrite');
                        // let testSession: Session;
                        // testSession = {sessionId: UUID.generate(), project: 'Demo1', script: '1245'}
                        // testTr.objectStore('session').add(testSession)
                        // testTr.oncomplete = () => {
                            this._store = or.result

                            subscriber.next(this._store)
                            subscriber.complete()
                       // }
                    }

                    or.onerror = (err) => {

                        console.error("Could not open indexed database: " + SprDb.dbName + ": " + err)
                        subscriber.error(err)
                    }
                } else {
                    console.info("Browser does not support indexed databases")
                    subscriber.error();
                }
            //}
        });
        return obs;
    }
}