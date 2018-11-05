import { UUID } from '../utils/utils'
import {PromptItem} from "./script/script";


export class RecordingFileDescriptor {

  //sessionId:string|number;
  recording:PromptItem;
  version:number;
  constructor() {}

}

    export class RecordingFile {

      _audioBuffer:AudioBuffer;
      sessionId:string|number;
      itemCode:string;
      version:number;
      uuid:string;
      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer) {
          this.sessionId=sessionId;
          this.itemCode=itemcode;
          this.version=version;
          this._audioBuffer=audioBuffer;
          this.uuid=UUID.generate();
      }

      get audioBuffer():AudioBuffer{
        return this._audioBuffer;
      }

      filenameString():string{
        let fns:string='';
        if(this.sessionId){
            fns+=this.sessionId;
            fns+='_';
        }
        if(this.itemCode){
          fns+=this.itemCode;
          fns+='_';
        }
        fns+=this.uuid;
        return fns;
      }
    }

