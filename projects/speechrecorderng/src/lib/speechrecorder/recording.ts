import { UUID } from '../utils/utils'
import {ItemCodeProvider} from "./script/script";


export class RecordingFileDescriptor {

  //sessionId:string|number;
  recording:ItemCodeProvider;
  version:number;
  constructor() {}

}

    export class RecordingFile {

      audioBuffer:AudioBuffer;
      sessionId:string|number;
      itemCode:string;
      version:number;
      uuid:string;
      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer) {
          this.sessionId=sessionId;
          this.itemCode=itemcode;
          this.version=version;
          this.audioBuffer=audioBuffer;
          this.uuid=UUID.generate();
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

export class RecordingFileDTO {

    audioBlob:Blob;
    sessionId:string|number;
    itemCode:string;
    version:number;
    uuid:string;
    constructor(recordingFile:RecordingFile,audioBlob:Blob) {
        this.uuid=recordingFile.uuid;
        this.sessionId=recordingFile.sessionId;
        this.itemCode=recordingFile.itemCode;
        this.version=recordingFile.version;
        this.audioBlob=audioBlob;
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

