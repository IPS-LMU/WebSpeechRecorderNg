import {AsyncFloat32ArrayInputStream} from "../../io/stream";
import {IndexedDbAudioBuffer, IndexedDbAudioInputStream} from "../inddb_audio_buffer";
import {ArrayAudioBufferSourceNode} from "./array_audio_buffer_source_node";
import {EMPTY, expand, map, Observable} from "rxjs";
import {AudioSourceNode} from "./audio_source_node";

export class IndexedDbAudioBufferSourceNode extends AudioSourceNode {

  static readonly DEFAULT_BUFFER_FILL_SECONDS = 10;
  private _bufferFillSeconds = ArrayAudioBufferSourceNode.DEFAULT_BUFFER_FILL_SECONDS;
  private bufferFillFrames = 0;
  private _inddbAudioBuffer:IndexedDbAudioBuffer|null=null;
  private _audioInputStream:AsyncFloat32ArrayInputStream|null=null;
  private _aisBufs:Float32Array[]|null=null;

  private filledFrames = 0;

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
            this.fillBufferObs();
          } else if ('ended' === evType) {
            console.debug("Inddb audio source ended playback.");
            let drainTime = 0;
            if (this._inddbAudioBuffer?.sampleRate) {
              drainTime = ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN / this._inddbAudioBuffer.sampleRate;
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

  private fillBufferObs(frameOffset?:number):Observable<number|null> {

      let obs = new Observable<number | null>(subscriber => {
        if(frameOffset){
          subscriber.error(new Error("Starting playback from position not equal zero not supported yet."));
        }else {
          let filled = this.filledFrames;
          let bufLen = 0;
          if (this._audioInputStream && this._aisBufs) {
            this._audioInputStream.readObs(this._aisBufs).pipe(
              expand((read) => {
                  if (read && this._aisBufs) {
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
                    filled += read;
                    if (this._audioInputStream && filled < this.bufferFillFrames) {
                      return this._audioInputStream.readObs(this._aisBufs);
                    } else {
                      return EMPTY;
                    }
                  } else {
                    return EMPTY;
                  }
                }
              )
            ).subscribe(subscriber);
          }
        }
      });
      return obs;
  }


  get inddbAudioBuffer(): IndexedDbAudioBuffer | null {
    return this._inddbAudioBuffer
  }

  set inddbAudioBuffer(value: IndexedDbAudioBuffer | null) {
    this._inddbAudioBuffer = value;
    if (this._inddbAudioBuffer?.channelCount) {
      this.channelCount = this._inddbAudioBuffer?.channelCount;
      this.bufferFillFrames = this._inddbAudioBuffer.sampleRate * this._bufferFillSeconds;
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

    if (this._inddbAudioBuffer) {
      let arrAis=new IndexedDbAudioInputStream(this._inddbAudioBuffer);
      if(offset===undefined && duration===undefined){
        this._audioInputStream = arrAis;
      }else{
        let offsetFrames=0;
        let durationFrames=undefined;
        if(offset!==undefined) {
          offsetFrames=Math.floor(offset * this._inddbAudioBuffer.sampleRate);
        }
        if(duration!==undefined){
          durationFrames=Math.floor(duration * this._inddbAudioBuffer.sampleRate);
        }
        console.error("Playback selection not supported yet!");
        //this._audioInputStream=new EditFloat32ArrayInputStream(arrAis,offsetFrames,durationFrames);
      }

      let chs=this._inddbAudioBuffer.channelCount;
      this._aisBufs=new Array<Float32Array>(chs);
      for(let ch=0;ch<chs;ch++){
        this._aisBufs[ch]=new Float32Array(1024);
      }

      this.fillBufferObs().subscribe({
        complete: ()=>{
          this.port.postMessage({cmd: 'start'});
        }
      })

    }
  }

  stop() {
    this.port.postMessage({cmd: 'stop'});
    this.onended?.call(this);
  }

}

