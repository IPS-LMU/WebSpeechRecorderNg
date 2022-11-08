import { UUID } from '../utils/utils'
import {PromptItem} from "./script/script";
import {AudioDataHolder} from "../audio/audio_data_holder";

// TODO I think the interface/class structure needs some refactoring
// The question in general is how to fetch an object of a class (with member methods)
// https://stackoverflow.com/questions/50452431/angular-6-httpclient-return-instance-of-class
// Angular HTTPClient seems to simply
// https://stackoverflow.com/questions/47499324/angular-5-models-httpclient-type-casting

export interface RecordingFileDescriptor {
  recording:PromptItem;
  version:number;
}

export class RecordingFileDescriptorImpl {
  recording!:PromptItem;
  version!:number;
  frames?:number;
  samplerate?:number;
  constructor() {}
}

export class RecordingFile {
  recordingFileId: string | number | null= null;
  uuid:string|null=null;
  serverPersisted=false;
  date: string|null=null;
  _dateAsDateObj:Date|null=null;
  startedDate: string|null=null;
  _startedAsDateObj?:Date|null=null;
  audioDataHolder:AudioDataHolder|null=null;
  session:string|number|null=null;
  frames:number|null=null;
  sampleRate:number|null=null;
  timeLength:number|null=null;
  editSampleRate:number|null=null;
  editStartFrame:number|null=null
  editEndFrame:number|null=null

  constructor(uuid:string,sessionId:string|number,audioDataHolder:AudioDataHolder|null) {
    this.session=sessionId;
    this.audioDataHolder=audioDataHolder
    if(audioDataHolder){
      this.frames=audioDataHolder.frameLen;
      this.timeLength=audioDataHolder.duration;
    }
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

  equals(otherRecordingFile:RecordingFile|null):boolean{
    if(otherRecordingFile!==null) {
      if (otherRecordingFile === this) {
        return true;
      }
      if (otherRecordingFile.uuid === this.uuid) {
        return true;
      }
    }
    return false;
  }

  toString():string{
    return 'Recording file: UUID: '+this.uuid+', session: '+this.session;
  }

}

    export class SprRecordingFile extends RecordingFile implements  RecordingFileDescriptor{

      itemCode:string;

      recording!:PromptItem;
      version!:number;

      constructor(sessionId:string|number,itemcode:string,version:number,audioDataHolder:AudioDataHolder|null) {
          super(UUID.generate(),sessionId,audioDataHolder);
          this.session=sessionId;
          this.itemCode=itemcode;
          this.version=version;
      }

      recordingFileDone():boolean{
        return (this.serverPersisted===true) || (this.audioDataHolder!=null);
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

      toString():string{
        return 'Recording file: UUID: '+this.uuid+', session: '+this.session+', itemcode: '+this.itemCode+', version: '+this.version+', UUID: '+this.uuid;
      }

    }

    export class RecordingFileUtils{

      static equals(recordinFile:RecordingFile|null,otherRecordingFile:RecordingFile|null):boolean{
        if(recordinFile && otherRecordingFile){
          if (otherRecordingFile === recordinFile) {
            return true;
          }
          if (otherRecordingFile.uuid === recordinFile.uuid) {
            return true;
          }
        }
        return false;
      }

      static setAudioData(rf:RecordingFile,audioDataHolder:AudioDataHolder|null){
          rf.audioDataHolder=audioDataHolder;
          if(audioDataHolder) {
            if(rf.frames==null) {
              rf.frames = audioDataHolder.frameLen;
            }
            rf.timeLength=audioDataHolder.duration;
          }
      }

      static sampleCount(rf:RecordingFile):number{
        if(rf.audioDataHolder){
          return rf.audioDataHolder.sampleCounts();
        }else{
          return 0;
        }
      }
      static expireAudioData(rf:RecordingFile):number{
        let expiredSamples=0;
        if(rf && rf.audioDataHolder){
          expiredSamples=rf.audioDataHolder.sampleCounts();
          rf.audioDataHolder.releaseAudioData()
          rf.audioDataHolder=null;
        }
        return expiredSamples;
      }

    }
