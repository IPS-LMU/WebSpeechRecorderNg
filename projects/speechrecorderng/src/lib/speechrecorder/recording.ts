import { UUID } from '../utils/utils'
import {PromptItem} from "./script/script";


export class RecordingFileDescriptor {
  recording!:PromptItem;
  version!:number;
  constructor() {}
}

    export class RecordingFile extends RecordingFileDescriptor{
      recordingFileId: string | number | null= null;
      uuid:string|null=null;
      date: string|null=null;
      _dateAsDateObj:Date|null=null;
      audioBuffer:AudioBuffer|null=null;
      audioBlob:Blob|null=null;
      session:string|number|null=null;
      itemCode:string;
      frames:number|null=null;
      editSampleRate:number|null=null;
      editStartFrame:number|null=null
      editEndFrame:number|null=null

      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer|null) {
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

