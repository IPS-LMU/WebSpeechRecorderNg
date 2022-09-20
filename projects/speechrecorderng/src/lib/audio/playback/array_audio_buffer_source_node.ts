import {ArrayAudioBuffer} from "../array_audio_buffer";
import {ArrayAudioBufferInputStream} from "../array_audio_buffer_input_stream";
import {EditFloat32ArrayInputStream, Float32ArrayInputStream} from "../../io/stream";

export class ArrayAudioBufferSourceNode extends AudioWorkletNode {

  static readonly QUANTUM_FRAME_LEN = 128;
  static readonly DEFAULT_BUFFER_FILL_SECONDS = 10;
  private _bufferFillSeconds = ArrayAudioBufferSourceNode.DEFAULT_BUFFER_FILL_SECONDS;
  private bufferFillFrames = 0;
  private _arrayAudioBuffer: ArrayAudioBuffer | null = null;
  private _audioInputStream:Float32ArrayInputStream|null=null;
  private _aisBufs:Float32Array[]|null=null;

  private filledFrames = 0;
  onended: (() => void) | null = null;

  constructor(context: AudioContext) {

    super(context, 'audio-source-worklet');
    this.channelCountMode = 'explicit';
    this.port.onmessage = (msgEv: MessageEvent) => {
      if (msgEv.data) {
        let evType = msgEv.data.eventType;
        if (evType) {
          if ('bufferNotification' === evType) {
            this.filledFrames = msgEv.data.filledFrames;
            //console.debug("Buffer notification: filled frames: " + this.filledFrames);
            this.fillBuffer();
          } else if ('ended' === evType) {
            let drainTime = 0;
            if (this._arrayAudioBuffer?.sampleRate) {
              drainTime = ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN / this._arrayAudioBuffer.sampleRate;
            }
            //let dstAny:any=this.context.destination;
            //console.debug('Destination node tail-time: '+dstAny['tail-time']);
            window.setTimeout(() => {
              this.onended?.call(this);
            }, drainTime * 1000);

          }
        }
      }
    }
  }

  private fillBuffer(frameOffset?:number) {
    if (this._arrayAudioBuffer && this._audioInputStream && this._aisBufs) {
      let filled = this.filledFrames;
      let bufLen = 0;

      while(filled< this.bufferFillFrames) {
        let read = this._audioInputStream.read(this._aisBufs);
        //console.log("ArrayAudioBufferSourceNode: read: "+read)
        if (read) {
          let trBuffers = new Array<any>(this.channelCount);
          for (let ch = 0; ch < this.channelCount; ch++) {
            let adCh = this._aisBufs[ch];
            let adChCopy = new Float32Array(adCh.length);
            bufLen = adChCopy.length;
            adChCopy.set(adCh);
            trBuffers[ch] = adChCopy.buffer;
          }
          this.port.postMessage({
            cmd: 'data',
            chs: this.channelCount,
            audioData: trBuffers
          }, trBuffers);
          filled+=read;
        }else{
          break;
        }
      }

    }
  }

  get arrayAudioBuffer(): ArrayAudioBuffer | null {
    return this._arrayAudioBuffer;
  }

  set arrayAudioBuffer(value: ArrayAudioBuffer | null) {
    this._arrayAudioBuffer = value;
    if (this._arrayAudioBuffer?.channelCount) {
      this.channelCount = this._arrayAudioBuffer?.channelCount;
      this.bufferFillFrames = this._arrayAudioBuffer.sampleRate * this._bufferFillSeconds;
    }
  }

  get bufferFillSeconds(): number {
    return this._bufferFillSeconds;
  }

  set bufferFillSeconds(value: number) {
    this._bufferFillSeconds = value;
  }

  start(when?: number | undefined,offset?: number | undefined,duration?: number | undefined): void {
    if (when) {
      throw Error("when, offest,duration parameters currently not supported by ArrayAudioBufferSourceNode class")
    }

    if (this._arrayAudioBuffer) {
      let arrAis=new ArrayAudioBufferInputStream(this._arrayAudioBuffer);
      if(offset===undefined && duration===undefined){
        this._audioInputStream = arrAis;
      }else{
        let offsetFrames=0;
        let durationFrames=undefined;
        if(offset!==undefined) {
          offsetFrames=Math.floor(offset * this._arrayAudioBuffer.sampleRate);
        }
        if(duration!==undefined){
          durationFrames=Math.floor(duration * this._arrayAudioBuffer.sampleRate);
        }
        this._audioInputStream=new EditFloat32ArrayInputStream(arrAis,offsetFrames,durationFrames);
      }

    let chs=this._arrayAudioBuffer.channelCount;
    this._aisBufs=new Array<Float32Array>(chs);
    for(let ch=0;ch<chs;ch++){
      this._aisBufs[ch]=new Float32Array(1024);
    }

    this.fillBuffer();
    this.port.postMessage({cmd: 'start'});
  }
  }

  stop() {
    this.port.postMessage({cmd: 'stop'});
    this.onended?.call(this);
  }

}
