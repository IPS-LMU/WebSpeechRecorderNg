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

    //public static RECORDING_FILE_CACHE_OBJECT_STORE_NAME='_recording_file_cache';
     public static RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME='rec_file_chunks';
    public static dbVersion=1;

    private _store:IDBDatabase|null=null
    constructor(){
    }

    static sprDbFactory():SprDb{
       let sprDb=new SprDb();

        return sprDb;
    }



    static prepare():Observable<IDBDatabase> {
        let obs = new Observable<IDBDatabase>((subscriber) => {

                console.info("Prepare indexed database...")
                if (indexedDB) {
                    let or: IDBOpenDBRequest;
                    or = indexedDB.open(SprDb.dbName, SprDb.dbVersion);
                    or.onupgradeneeded = (ev) => {
                        let db = or.result
                        let tr=or.transaction

                        // if (!db.objectStoreNames.contains(SprDb.RECORDING_FILE_CACHE_OBJECT_STORE_NAME)) {
                        //    db.createObjectStore(SprDb.RECORDING_FILE_CACHE_OBJECT_STORE_NAME);
                        // }

                        // Future work towards a complete PWA which stores all clien data in indexed db and synchronizes to the server: See experimental Git branch "progressive_web_app"

                        // if (!db.objectStoreNames.contains('_sync')) {
                        //     db.createObjectStore('_sync', {keyPath: 'id', autoIncrement:true});
                        // }
                        // if (!db.objectStoreNames.contains('project')) {
                        //     db.createObjectStore('project', {keyPath: 'name'});
                        // }
                        // if (!db.objectStoreNames.contains('session')) {
                        //     let sessStore=db.createObjectStore('session', {keyPath: 'sessionId'});
                        //     sessStore.createIndex('projectIdx', ['project'], {unique:false});
                        // }else if(ev.oldVersion<5){
                        //
                        //     let sessStore=tr.objectStore('session')
                        //    sessStore.createIndex('projectIdx', ['project'], {unique:false});
                        // }
                        //
                        // if (!db.objectStoreNames.contains('script')) {
                        //     let scrStore=db.createObjectStore('script', {keyPath: 'scriptId'});
                        //     scrStore.createIndex('projectIdx', ['project'], {unique:false});
                        // }
                        //
                        // if (!db.objectStoreNames.contains('recfile')) {
                        //     let rfStore=db.createObjectStore('recfile', {keyPath: 'uuid'});
                        //     rfStore.createIndex('sessIdIdx', ['sessionId'], {unique:false});
                        //     rfStore.createIndex('sessIdItemcodeIdx', ['sessionId','itemCode'], {unique:false});
                        // }
                      if (!db.objectStoreNames.contains(SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME)) {
                            let rfStore=db.createObjectStore(SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME);
                        }
                        if (ev.oldVersion) {
                            console.info("Upgraded indexed database " + SprDb.dbName + " schema from version " + ev.oldVersion + " to " + ev.newVersion)
                        } else {
                            console.info("Created indexed database " + SprDb.dbName + " schema version " + ev.newVersion)
                        }
                    }
                    or.onsuccess = (ev) => {
                        console.info("Opened indexed database")

                      let db=or.result;
                      //   // iPad WEbKit workaround
                      // does not help!
                      //   db.onclose=(ev)=>{
                      //     console.debug("DB closed...");
                      //
                      //   }
                      // console.debug("Close db.");
                      //   db.close();
                      // let opaRq=indexedDB.open(SprDb.dbName, SprDb.dbVersion);
                      // opaRq.onupgradeneeded=(ev)=>{}
                      //
                      // opaRq.onsuccess=(ev)=>{
                      //   console.debug("and opened again");
                      //   subscriber.next(opaRq.result);
                      //   subscriber.complete();
                      // }
                      // opaRq.onerror = (err) => {
                      //   console.error("Could not open indexed database: " + SprDb.dbName + ": " + err)
                      //   subscriber.error(err)
                      // }

                      subscriber.next(db);
                      subscriber.complete();
                    }

                    or.onerror = (err) => {
                        console.error("Could not open indexed database: " + SprDb.dbName + ": " + err)
                        subscriber.error(err)
                    }
                } else {
                    console.info("Browser does not support indexed databases")
                    subscriber.error();
                }
        });
        return obs;
    }
}
