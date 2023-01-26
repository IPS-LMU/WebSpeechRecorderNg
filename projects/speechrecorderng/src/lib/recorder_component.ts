import {FitToPageComponent} from "./ui/fit_to_page_comp";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {SprDb} from "./db/inddb";
import {Observable} from "rxjs";
import {PersistentAudioStorageTarget} from "./audio/inddb_audio_buffer";
import {Injector} from "@angular/core";


export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent extends FitToPageComponent implements ReadyStateProvider{

    dataSaved: boolean = true;

    protected _persistentAudioStorageTarget:PersistentAudioStorageTarget|null=null;
    constructor(protected uploader:SpeechRecorderUploader) {}

    printStorageInfos(){
      // Safari seems not to support the estimate function.
      if(navigator.storage && navigator.storage.estimate instanceof Function) {
        navigator.storage.estimate().then((se) => {
          console.info("Estimated storage usage: " + se.usage + ", quota: " + se.quota);
        }).catch((err) => "Could not get get storage infos: " + err.message);
      }else{
        console.info("User agent does not support storage manager estimate function.");
      }
    }

    prepare(persistentAudioStorage=false):Observable<void>{

        if(persistentAudioStorage){
            this.printStorageInfos();
        }
      return new Observable(subscriber => {
        if (persistentAudioStorage) {
          SprDb.prepare().subscribe({
            next: (db) => {
              this._persistentAudioStorageTarget = new PersistentAudioStorageTarget(db, SprDb.RECORDING_FILE_CACHE_OBJECT_STORE_NAME);
              //let delCnt=0;
              this._persistentAudioStorageTarget.deleteAll().subscribe({
                next:()=>{
                  //delCnt++;
                  subscriber.next();
                },
                complete:()=>{
                  //console.info('Storage info after deletion of all ('+delCnt+') entries:');
                  console.info('Persistent audio storage object store cleared.');
                  this.printStorageInfos();
                  subscriber.complete();
                },
                error:(err)=>{
                  subscriber.error(err);
                }

              });

              window.addEventListener('beforeunload',(e)=>{
                  if(this._persistentAudioStorageTarget) {
                      // Delete on page leave. Di not register callbacks to prevent page leave blocking
                      this._persistentAudioStorageTarget.deleteAll().subscribe();
                  }
              });

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
    constructor(injector:Injector,protected uploader:SpeechRecorderUploader) {
        super(injector);
    }

    abstract ready():boolean;
    abstract get screenLocked():boolean;
}

