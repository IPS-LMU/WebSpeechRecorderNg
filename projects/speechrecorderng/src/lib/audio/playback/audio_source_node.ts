export abstract class AudioSourceNode extends AudioWorkletNode {
  static readonly DEFAULT_BUFFER_FILL_SECONDS = 10;
  static readonly DEFAULT_STREAM_READ_FRAME_LEN=1024;
  static readonly QUANTUM_FRAME_LEN = 128;
  protected _playStartTime:number|null=null;
  public abstract start(when?: number | undefined,offset?: number | undefined,duration?: number | undefined): void;
  public abstract stop():void;

  get playPositionTime():number|null {
    let ppt=null;
    if(this._playStartTime!==null) {
      ppt= this.context.currentTime - this._playStartTime;
    }
    return ppt;
  }
  onended: (() => void) | null = null;
}
