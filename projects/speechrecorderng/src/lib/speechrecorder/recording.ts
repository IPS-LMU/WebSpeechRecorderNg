import { UUID } from '../utils/utils'
import {PromptItem} from "./script/script";

export interface RecordingFileDescriptor {
  recording:PromptItem;
  version:number;
}

export class RecordingFileDescriptorImpl {
  recording!:PromptItem;
  version!:number;
  constructor() {}
}

export class RecordingFile {
  recordingFileId: string | number | null= null;
  uuid:string|null=null;
  date: string|null=null;
  _dateAsDateObj:Date|null=null;
  startedDate?:Date|null=null;
  audioBuffer:AudioBuffer|null=null;
  session:string|number|null=null;
  frames:number|null=null;
  editSampleRate:number|null=null;
  editStartFrame:number|null=null
  editEndFrame:number|null=null

  constructor(uuid:string,sessionId:string|number,audioBuffer:AudioBuffer|null) {
    this.session=sessionId;
    this.audioBuffer=audioBuffer;
    this.uuid=uuid;
  }

  filenameString():string{
    let fns:string='';
    if(this.session){
      fns+=this.session;
      fns+='_';
    }
    fns+=this.uuid;
    return fns;
  }
}

    export class SprRecordingFile extends RecordingFile implements  RecordingFileDescriptor{

      itemCode:string;

      recording!:PromptItem;
      version!:number;

      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer|null) {
          super(UUID.generate(),sessionId,audioBuffer);
          this.session=sessionId;
          this.itemCode=itemcode;
          this.version=version;
          this.audioBuffer=audioBuffer;
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

