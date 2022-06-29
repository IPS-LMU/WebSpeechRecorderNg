import {ArrayAudioBuffer, ArrayAudioBufferInputsStream} from "./array_audio_buffer";
import {Float32ArrayInputStream} from "../io/stream";

export class AudioDataHolder{
  get timeLen(): number {
    return this._timeLen;
  }

  private _channelCount:number=0;
  private _sampleRate:number=0;
  private _frameLen:number=0;
  private _timeLen:number=0;
  private static readonly ONE_OF_MUST_BE_SET_ERR_MSG='One of either audio buffer or array audio buffer must be set!';

  constructor(private _buffer: AudioBuffer|null,private _arrayBuffer:ArrayAudioBuffer|null=null) {
    if(this._buffer && this._arrayBuffer){
      throw Error('Only one of either audio buffer or array audio buffer must be set!');
    }
    if (this._buffer || this._arrayBuffer) {
      if (this._buffer) {
        this._channelCount = this._buffer.numberOfChannels;
        this._sampleRate = this._buffer.sampleRate;
        this._frameLen=this._buffer.length;
        this._timeLen=this._frameLen/this._sampleRate;
      } else if (this._arrayBuffer) {
        this._channelCount = this._arrayBuffer.channelCount;
        this._sampleRate = this._arrayBuffer.sampleRate;
        this._frameLen=this._arrayBuffer.frameLen;
        this._timeLen=this._frameLen/this._sampleRate;
      }

    }else{
      throw Error(AudioDataHolder.ONE_OF_MUST_BE_SET_ERR_MSG);
    }
  }

  get sampleRate(): number {
    return this._sampleRate;
  }
  get channelCount(): number {
    return this._channelCount;
  }

  get frameLen(): number {
    return this._frameLen;
  }

  sampleCounts():number{
    return this._channelCount*this._frameLen;
  }

  audioInputStream():Float32ArrayInputStream{
    if(this._buffer){
      return new AudioBufferInputsStream(this._buffer);
    }
    if(this._arrayBuffer){
      return new ArrayAudioBufferInputsStream(this._arrayBuffer);
    }
    throw Error(AudioDataHolder.ONE_OF_MUST_BE_SET_ERR_MSG);
  }

  get buffer(): AudioBuffer | null {
    return this._buffer;
  }

  get arrayBuffer(): ArrayAudioBuffer | null {
    return this._arrayBuffer;
  }

  // getChannelData(channel:number,startFrame:number,length:number):Float32Array|null{
  //   let reqBuf=null;
  //   if(this._buffer){
  //     let chData=this._buffer.getChannelData(channel);
  //     reqBuf= chData.slice(startFrame,startFrame+length);
  //   } else if(this._arrayBuffer){
  //     reqBuf=new Float32Array(length);
  //     let chunkCnt=this._arrayBuffer.chunkCount;
  //     let ci=0;
  //     let framePos=0;
  //     while(ci<chunkCnt){
  //       let chunkBuf=this._arrayBuffer.data[channel][ci];
  //       let chunkBuflen=chunkBuf.length;
  //       let offset=startFrame-framePos;
  //       if(offset>=0){
  //         let chunkBufEndPos=framePos+chunkBuflen;
  //         let reqEndPos=startFrame+length;
  //         if(framePos>reqEndPos){
  //           break;
  //         }else{
  //           // TODO
  //           let toCopy=length;
  //         }
  //       }
  //     }
  //   }
  //   return  reqBuf;
  // }

}


export class AudioBufferInputsStream implements Float32ArrayInputStream{
  private framePos=0;

  constructor(private audioBuffer:AudioBuffer) {

  }

  close(): void {
  }

  read(buffers: Array<Float32Array>): number {
    let read=0;
    let toRead=buffers[0].length;
    if(this.framePos+toRead>this.audioBuffer.length){
      toRead=this.audioBuffer.length-this.framePos;
    }
    for(let ch=0;ch<buffers.length;ch++) {
      for (let i = 0; i < toRead; i++) {
        buffers[ch][i]=this.audioBuffer.getChannelData(ch)[this.framePos+i];
      }
    }
    read=toRead;
    this.framePos+=toRead;
    return read;
  }

}
