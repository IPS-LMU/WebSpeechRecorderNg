import {PromptitemUtil} from "../../script/script";
import {RecordingFile, SprRecordingFile} from "../../recording";


// export class RecordingFile {
//
//   get recordingFileId(): string | number {
//     return this._recordingFileId;
//   }
//
//   frames:number=null
//   editStartFrame:number=null
//   editEndFrame:number=null
//
//   recording:PromptItem;
//
//   session:number|string;
//
//   get audioBuffer(): AudioBuffer {
//     return this._audioBuffer;
//   }
//
//   set audioBuffer(value: AudioBuffer) {
//     this._audioBuffer = value;
//   }
//   private _recordingFileId:string | number;
//   private _audioBuffer:AudioBuffer;
//
//   constructor(recordingFileId: string| number, audioBuffer:AudioBuffer){
//     this._recordingFileId=recordingFileId;
//     this._audioBuffer=audioBuffer;
//   }
//
//
// }

export class RecordingFileUtil {
  public static recordingAsPlainText(recordingFile:SprRecordingFile) {
    if (recordingFile) {
      let r = recordingFile.recording;
      if (r) {
        return PromptitemUtil.toPlainTextString(r);
      }
    }
    return "n/a";
  }

  public static framePosForSampleRate(framePosSampleRate:number|null,framePos:number|null,sampleRate:number):number|null{
    let fpFSr=null;

    // TODO transitional until editSampleRates are set in the database
    if(framePosSampleRate==null){
      framePosSampleRate=sampleRate;
    }
    if(framePosSampleRate!=null && framePos!=null) {
      if (framePosSampleRate === sampleRate) {
        fpFSr=framePos;
      } else {
        fpFSr=Math.round((framePos * sampleRate) / framePosSampleRate);
      }
    }
    return fpFSr;
  }

  public static editStartFrameForSampleRate(recordingFile:RecordingFile, sampleRate:number):number | null{
    let esffSr=RecordingFileUtil.framePosForSampleRate(recordingFile.editSampleRate,recordingFile.editStartFrame,sampleRate);
    return esffSr;
  }

  public static editEndFrameForSampleRate(recordingFile:RecordingFile, sampleRate:number):number | null{
    let eeffSr=RecordingFileUtil.framePosForSampleRate(recordingFile.editSampleRate,recordingFile.editEndFrame,sampleRate);
    return eeffSr;
  }
}
