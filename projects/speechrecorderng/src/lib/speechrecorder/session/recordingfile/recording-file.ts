import {PromptItem} from "../../script/script";


export class RecordingFile {
  get recordingFileId(): string | number {
    return this._recordingFileId;
  }

  frames:number=null
  editStartFrame:number=null
  editEndFrame:number=null

  recording:PromptItem;

  session:number|string;

  get audioBuffer(): AudioBuffer {
    return this._audioBuffer;
  }

  set audioBuffer(value: AudioBuffer) {
    this._audioBuffer = value;
  }
  private _recordingFileId:string | number;
  private _audioBuffer:AudioBuffer;

  constructor(recordingFileId: string| number, audioBuffer:AudioBuffer){
    this._recordingFileId=recordingFileId;
    this._audioBuffer=audioBuffer;
  }


}
