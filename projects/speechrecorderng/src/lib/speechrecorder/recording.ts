import { UUID } from '../utils/utils'
import {PromptItem} from "./script/script";


export class RecordingFileDescriptor {

  //session:string|number;
  recording:PromptItem;
  version:number;
  constructor() {}

}

    export class RecordingFile extends RecordingFileDescriptor{
      recordingFileId: string | number = null;
      uuid:string=null;
      date: string=null;
      _dateAsDateObj:Date=null;
      audioBuffer:AudioBuffer=null;
      session:string|number=null;
      itemCode:string;

      frames:number=null
      editStartFrame:number=null
      editEndFrame:number=null


      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer) {
          super()
          this.session=sessionId;
          this.itemCode=itemcode;
          this.version=version;
          this.audioBuffer=audioBuffer;
          this.uuid=UUID.generate();
      }


      filenameString():string{
        let fns:string='';
        if(this.session){
            fns+=this.session;
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

