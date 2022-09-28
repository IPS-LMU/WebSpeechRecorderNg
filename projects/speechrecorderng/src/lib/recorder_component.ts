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

