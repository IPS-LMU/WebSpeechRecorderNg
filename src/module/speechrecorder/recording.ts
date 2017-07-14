import { UUID } from '../utils/utils'


    export class RecordingFile {

      _audioBuffer:AudioBuffer;
      sessionId:string;
      itemCode:string;
      uuid:string;
      constructor(sessionId:string,itemcode:string,audioBuffer:AudioBuffer) {
          this.sessionId=sessionId;
          this.itemCode=itemcode;
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

