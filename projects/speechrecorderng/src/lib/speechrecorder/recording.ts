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
      private _audioBuffer:AudioBuffer=null;
      persistedNavigator=false;
      persistedServer=false;
      persistedDownload=false;

      private _audioSizeInBytes:number=0;
      private static _allAudioSizeInBytes=0;
      session:string|number=null;
      itemCode:string;
      frames:number=null
        editSampleRate:number=null;
      editStartFrame:number=null
      editEndFrame:number=null

      constructor(sessionId:string|number,itemcode:string,version:number,audioBuffer:AudioBuffer) {
          super()
          this.session=sessionId;
          this.itemCode=itemcode;
          this.version=version;
          //this._audioBuffer=audioBuffer;
          this.uuid=UUID.generate();
          this.audioBuffer=audioBuffer;
      }

      private updateAudioSizeInBytes(){
        this._audioSizeInBytes=0;
          if(this._audioBuffer!=null){
            for(let ch=0;ch<this._audioBuffer.numberOfChannels;ch++){
              let chData=this._audioBuffer.getChannelData(ch);
              let chSize=chData.byteLength;
              this._audioSizeInBytes+=chSize;
            }
          }
      }

      isPersisted():boolean{
        return this.persistedServer || this.persistedDownload || this.persistedNavigator;
      }

      set audioBuffer(audioBuffer:AudioBuffer){
        RecordingFile._allAudioSizeInBytes-=this._audioSizeInBytes;
        this._audioBuffer=audioBuffer;
        this.updateAudioSizeInBytes();
        RecordingFile._allAudioSizeInBytes+=this._audioSizeInBytes;
        console.log("Audio bytes in use: "+RecordingFile._allAudioSizeInBytes);
      }

      get audioBuffer(){
        return this._audioBuffer;
      }

      get audioSizeInBytes(){
          return this._audioSizeInBytes;
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

