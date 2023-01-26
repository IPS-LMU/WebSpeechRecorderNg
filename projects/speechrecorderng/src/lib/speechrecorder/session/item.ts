import {SprRecordingFile} from "../recording";

export class Item {
    recs: Array<SprRecordingFile> | null;

    constructor(private _promptAsString: string, private _training: boolean,private _recording:boolean) {
        this.recs = null;
    }

    itemDone(){
      let done=false;
      if(this.recs){
        for(let rf of this.recs){
          if(rf.recordingFileDone()){
            done=true;
            break;
          }
        }
      }
      return done;
    }

    get promptAsString():string{
        return this._promptAsString;
    }

    get training():boolean{
        return this._training;
    }

    get recording():boolean{
        return this._recording;
    }

}
