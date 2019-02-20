import {Injectable} from "@angular/core";
import {SessionFinishedDialog} from "../speechrecorder/session/session_finished_dialog";
import {Session} from "../speechrecorder/session/session";
import {UUID} from "../utils/utils";
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
    public static dbVersion=5;

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
                        let tr=or.transaction

                        if (!db.objectStoreNames.contains('_sync')) {
                            db.createObjectStore('_sync', {keyPath: 'id', autoIncrement:true});
                        }
                        if (!db.objectStoreNames.contains('project')) {
                            db.createObjectStore('project', {keyPath: 'name'});
                        }
                        if (!db.objectStoreNames.contains('session')) {
                            let sessStore=db.createObjectStore('session', {keyPath: 'sessionId'});
                            sessStore.createIndex('projectIdx', ['project'], {unique:false});
                        }else if(ev.oldVersion<5){

                            let sessStore=tr.objectStore('session')
                           sessStore.createIndex('projectIdx', ['project'], {unique:false});
                        }

                        if (!db.objectStoreNames.contains('script')) {
                            let scrStore=db.createObjectStore('script', {keyPath: 'scriptId'});
                            scrStore.createIndex('projectIdx', ['project'], {unique:false});
                        }
                        // if (!db.objectStoreNames.contains('project_script')) {
                        //     let scrStore=db.createObjectStore('project_script',{keyPath:['project','scriptId']});
                        // }
                        if (!db.objectStoreNames.contains('recfile')) {
                            let rfStore=db.createObjectStore('recfile', {keyPath: 'uuid'});
                            rfStore.createIndex('sessIdIdx', ['sessionId'], {unique:false});
                            rfStore.createIndex('sessIdItemcodeIdx', ['sessionId','itemCode'], {unique:false});
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
