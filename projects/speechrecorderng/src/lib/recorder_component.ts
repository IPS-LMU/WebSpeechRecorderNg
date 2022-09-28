import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {UploaderStatus, UploaderStatusChangeEvent} from "./net/uploader";
import {SprDb} from "./db/inddb";
import {Observable} from "rxjs";
import {PersistentAudioStorageTarget} from "./audio/inddb_audio_buffer";


export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent implements ReadyStateProvider{

    dataSaved: boolean = true;

    protected _persistentAudioStorageTarget:PersistentAudioStorageTarget|null=null;
    constructor(protected uploader:SpeechRecorderUploader) {
        if(navigator.storage) {
            navigator.storage.estimate().then((se) => {
                console.info("Estimated storage usage: " + se.usage + ", quota: " + se.quota);
            }).catch((err) => "Could not get get storage infos: " + err.message);
        }else{
            console.info("User agent has not storage manager.");
        }
    }

    prepare(persistentAudioStorage=false):Observable<void>{

      return new Observable(subscriber => {
        if (persistentAudioStorage) {
          SprDb.prepare().subscribe({
            next: (db) => {
              this._persistentAudioStorageTarget = new PersistentAudioStorageTarget(db, SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME);
              this._persistentAudioStorageTarget.deleteAll().subscribe(subscriber);
            },
            error:(err)=>{
              subscriber.error(err);
            }
          });
        }else{
          subscriber.next();
          subscriber.complete();
        }
      }
    );
    }

    abstract ready():boolean;
    abstract get screenLocked():boolean;
}

