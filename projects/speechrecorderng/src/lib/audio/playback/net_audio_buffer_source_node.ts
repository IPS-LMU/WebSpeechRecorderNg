import {AsyncEditFloat32ArrayInputStream, AsyncFloat32ArrayInputStream} from "../../io/stream";
import {IndexedDbAudioBuffer, IndexedDbAudioInputStream} from "../inddb_audio_buffer";
import {ArrayAudioBufferSourceNode} from "./array_audio_buffer_source_node";
import {EMPTY, expand, map, Observable, Subscription} from "rxjs";
import {AudioSourceNode} from "./audio_source_node";
import {NetAudioBuffer, NetAudioInputStream} from "../net_audio_buffer";

export class NetAudioBufferSourceNode extends AudioSourceNode {

  private _bufferFillSeconds = AudioSourceNode.DEFAULT_BUFFER_FILL_SECONDS;
  private bufferFillFrames = 0;
  private _streamReadFrameLen=AudioSourceNode.DEFAULT_STREAM_READ_FRAME_LEN * 8;  // Much overhead fetching small buffers from indexed db, use larger buffer (8192).
  private _netAudioBuffer:NetAudioBuffer|null=null;
  private _audioInputStream:AsyncFloat32ArrayInputStream|null=null;
  private _aisBufs:Float32Array[]|null=null;
  private _active=false;
  private stalled=false;
  private _endOfStream=false;
  private readDataSubscription:Subscription|null=null;
  private filledFrames = 0;

  private stalledStartTime:number|null=null;
  private stalledTime:number=0;

  private stopEndTime:number|null=null;

  constructor(context: AudioContext) {

    super(context, 'audio-source-worklet');
    this.channelCountMode = 'explicit';
    this.port.onmessage = (msgEv: MessageEvent) => {
      if (msgEv.data) {
        let evType = msgEv.data.eventType;
        if (evType) {
          if ('bufferNotification' === evType) {
            this.filledFrames = msgEv.data.filledFrames;
            //console.debug("IndexedDbAudioBufferSourceNode: Buffer notification: filled frames: " + this.filledFrames);
            if(!this._endOfStream) {
              this.fillBufferObs().subscribe();
            }
          } else if ('ended' === evType) {
            //console.debug("Inddb audio source ended playback.");
            let drainTime = 0;
            if (this._netAudioBuffer?.sampleRate) {
              drainTime = ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN / this._netAudioBuffer.sampleRate;
            }
            //let dstAny:any=this.context.destination;
            //console.debug('Destination node tail-time: '+dstAny['tail-time']);
            window.setTimeout(() => {
              this.stopEndTime=this.context.currentTime;
              this._active=false;
              this.onended?.call(this);
            }, drainTime * 1000);

          }else if ('stalled' === evType) {
            console.debug('Playback stalled...');
            this.stalled=true;
            this.stalledStartTime=this.context.currentTime;
          }else if ('resumed' === evType) {
            console.debug('Playback resumed after stall.');
            this.stalled=false;
            if(this.stalledStartTime!=null) {
              this.stalledTime += this.context.currentTime - this.stalledStartTime;
              this.stalledStartTime = null;
            }
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
          if (this._audioInputStream && this._aisBufs && (this.readDataSubscription==null || this.readDataSubscription?.closed)) {
            this.readDataSubscription=this._audioInputStream.readObs(this._aisBufs).pipe(
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
                    //console.debug("IndexedDbAudioBufferSourceNode::fillBufferObs: Sent "+read+" frames to audio source worklet. Filled: "+filled+", to fill: "+this.bufferFillFrames);
                    if (this._audioInputStream && filled < this.bufferFillFrames) {
                      //console.debug("IndexedDbAudioBufferSourceNode::fillBufferObs: Next inddb audio input stream readObs");
                      return this._audioInputStream.readObs(this._aisBufs);
                    } else {
                      if(this.stalled){
                        this.port.postMessage({
                          cmd: 'continue'
                        });

                      }
                      return EMPTY;
                    }
                  } else {
                    //console.debug("IndexedDbAudioBufferSourceNode::fillBufferObs: Return EMPTY (read: "+read+")");
                    this._endOfStream=true;
                    this.port.postMessage({
                      cmd: 'endOfStream'
                    });
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


  get netAudioBuffer(): NetAudioBuffer | null {
    return this._netAudioBuffer
  }

  set netAudioBuffer(value: NetAudioBuffer | null) {
    this._netAudioBuffer = value;
    if (this._netAudioBuffer?.channelCount) {
      this.channelCount = this._netAudioBuffer?.channelCount;
      this.bufferFillFrames = this._netAudioBuffer.sampleRate * this._bufferFillSeconds;
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
      throw Error("when parameter currently not supported by IndexedDbAudioBufferSourceNode class")
    }
    this._playStartTime=null;
    this.stopEndTime=null;
    this.stalledTime=0;
    this.stalledStartTime=null;

    if (this._netAudioBuffer) {
      let arrAis=new NetAudioInputStream(this._netAudioBuffer);
      if(offset===undefined && duration===undefined){
        this._audioInputStream = arrAis;
      }else{
        let offsetFrames=0;
        let durationFrames=undefined;
        if(offset!==undefined) {
          offsetFrames=Math.floor(offset * this._netAudioBuffer.sampleRate);
        }
        if(duration!==undefined){
          durationFrames=Math.floor(duration * this._netAudioBuffer.sampleRate);
        }
        //console.error("Playback selection not supported yet!");
        this._audioInputStream=new AsyncEditFloat32ArrayInputStream(arrAis,offsetFrames,durationFrames);
      }

      let chs=this._netAudioBuffer.channelCount;
      this._aisBufs=new Array<Float32Array>(chs);
      for(let ch=0;ch<chs;ch++){
        this._aisBufs[ch]=new Float32Array(this._streamReadFrameLen);
      }

      this.fillBufferObs().subscribe({
        complete: ()=>{
          //console.debug("IndexedDbAudioBufferSourceNode::start: Async play buffer fill completed. Sending start command to audio worklet.");
          if(this._active) {
            this.port.postMessage({cmd: 'start'});
            if(offset) {
              this._playStartTime = this.context.currentTime - offset;
            }else{
              this._playStartTime = this.context.currentTime;
            }
          }
        }
      })
      this._active=true;

    }
  }

  stop() {
    this._active=false;
    this.port.postMessage({cmd: 'stop'});
    this.onended?.call(this);
  }

  get playPositionTime():number|null {
    let ppt:number|null=null;
    if(this._playStartTime!==null) {
      if(this._active) {
        if (this.stalledStartTime == null) {
          ppt = this.context.currentTime - this._playStartTime - this.stalledTime;
        } else {
          ppt = this.stalledStartTime - this._playStartTime - this.stalledTime;
        }
      }else{
        if(this.stopEndTime!=null){
          // if(this._netAudioBuffer?.frameLen !=null && this._netAudioBuffer.sampleRate) {
          //   ppt = this._netAudioBuffer?.frameLen / this._netAudioBuffer?.sampleRate;
          // }else{
            ppt = this.stopEndTime - this._playStartTime - this.stalledTime;
          //}
        }
      }
    }
    return ppt;
  }

}

