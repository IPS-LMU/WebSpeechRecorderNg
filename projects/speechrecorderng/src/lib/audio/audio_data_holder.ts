import {ArrayAudioBuffer} from "./array_audio_buffer";
import {AsyncFloat32ArrayInputStream, Float32ArrayInputStream} from "../io/stream";
import {ArrayAudioBufferInputStream} from "./array_audio_buffer_input_stream";
import {Observable} from "rxjs";
import {IndexedDbAudioBuffer, IndexedDbAudioInputStream, IndexedDbRandomAccessStream} from "./inddb_audio_buffer";
import {ArrayAudioBufferRandomAccessStream} from "./array_audio_buffer_random_access_stream";
import {AudioStorageType} from "../speechrecorder/project/project";

// TODO Ler all types implement an interface.
// Question: Use JS protoype to extend HTML5 Audio API AudioBuffer or use a class wrapper?
// export interface AudioBufferI{
//   readonly type:AudioStorageType;
//   readonly readAsync:boolean;
//   readonly numberOfChannels:number;
//   readonly sampleRate:number;
//
// }

// export abstract class AudioStorage{
//   abstract type:AudioStorageType;
//   abstract persistent:boolean;
// }

export interface RandomAccessAudioStream{
  framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>;
  close():void;
}

export class AudioDataHolder{
  get duration(): number {
    return this._duration;
  }

  private _numberOfChannels:number=0;
  private _sampleRate:number=0;
  private _frameLen:number=0;
  private _duration:number=0;
  private static readonly ONE_OF_MUST_BE_SET_ERR_MSG='One of either audio buffer or array audio buffer must be set!';

  constructor(private _buffer: AudioBuffer|null,private _arrayBuffer:ArrayAudioBuffer|null=null,private _inddbAudioBuffer:IndexedDbAudioBuffer|null=null) {
    if(this._buffer && this._arrayBuffer){
      throw Error('Only one of either audio buffer or array audio buffer must be set!');
    }
    if (this._buffer || this._arrayBuffer || this._inddbAudioBuffer) {
      if (this._buffer) {
        this._numberOfChannels = this._buffer.numberOfChannels;
        this._sampleRate = this._buffer.sampleRate;
        this._frameLen=this._buffer.length;
        this._duration=this._frameLen/this._sampleRate;
      } else if (this._arrayBuffer) {
        this._numberOfChannels = this._arrayBuffer.channelCount;
        this._sampleRate = this._arrayBuffer.sampleRate;
        this._frameLen=this._arrayBuffer.frameLen;
        this._duration=this._frameLen/this._sampleRate;
      } else if (this._inddbAudioBuffer) {
        this._numberOfChannels=this._inddbAudioBuffer.channelCount;
        this._sampleRate=this._inddbAudioBuffer.sampleRate;
        this._frameLen=this._inddbAudioBuffer.frameLen;
        this._duration=this._frameLen/this._sampleRate;
      }

    }else{
      throw Error(AudioDataHolder.ONE_OF_MUST_BE_SET_ERR_MSG);
    }
  }

  get sampleRate(): number {
    return this._sampleRate;
  }
  get numberOfChannels(): number {
    return this._numberOfChannels;
  }

  get frameLen(): number {
    return this._frameLen;
  }

  sampleCounts():number{
    return this._numberOfChannels*this._frameLen;
  }

  // framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>{
  //   return new Observable<number>(subscriber => {
  //     if (this._buffer || this._arrayBuffer) {
  //       // synchronous
  //       let frsRead=this.frames(framePos,frameLen,bufs);
  //       subscriber.next(frsRead);
  //       subscriber.complete();
  //     }else if(this._inddbAudioBuffer){
  //       // async
  //       //this._inddbAudioBuffer.framesObs(framePos,frameLen,bufs).subscribe(subscriber);
  //       throw Error('Indexed audio buffer not supported.Please use randomAccessAudioStream()');
  //     }
  //   });
  //
  // }

  randomAccessAudioStream():RandomAccessAudioStream{
      if(this._buffer){
        return new RandomAccessAudioBufferStream(this._buffer);
      }else if(this._arrayBuffer){
        return new ArrayAudioBufferRandomAccessStream(this._arrayBuffer);
      }else if(this._inddbAudioBuffer){
        return new IndexedDbRandomAccessStream(this._inddbAudioBuffer);
      }else {
        throw Error('No audio buffer implementation set');
      }
  }


  private frames(framePos:number,frameLen:number,bufs:Float32Array[]):number{
    let read=0;
    if(this._buffer){
      let toRead=frameLen;
      if(this._buffer.length<framePos+frameLen){
        toRead=this._buffer.length-framePos;
      }
      for(let ch=0;ch<bufs.length;ch++){
        let chData=this._buffer.getChannelData(ch);
        for(let i=0;i<toRead;i++){
          bufs[ch][i]=chData[framePos+i];
        }
      }
      read=toRead;
    }else if(this._arrayBuffer){
      read=this._arrayBuffer.frames(framePos,frameLen,bufs);
    }
    return read;
  }

  audioInputStream():Float32ArrayInputStream|null{
    if(this._buffer){
      return new AudioBufferInputStream(this._buffer);
    }
    if(this._arrayBuffer){
      return new ArrayAudioBufferInputStream(this._arrayBuffer);
    }
    return null;
  }

  asyncAudioInputStream(): AsyncFloat32ArrayInputStream|null{
    if(this._inddbAudioBuffer){
      return new IndexedDbAudioInputStream(this._inddbAudioBuffer);
    }
    return null;
  }

  get buffer(): AudioBuffer | null {
    return this._buffer;
  }

  get arrayBuffer(): ArrayAudioBuffer | null {
    return this._arrayBuffer;
  }

  get inddbBuffer():IndexedDbAudioBuffer|null{
    return this._inddbAudioBuffer;
  }

  releaseAudioData():Observable<void>{
    return new Observable<void>(subscriber => {
      if (this._inddbAudioBuffer) {
        this._inddbAudioBuffer.releaseAudioData().subscribe({
          next:()=>{
            subscriber.next();
          },
          complete:()=>{
            this._inddbAudioBuffer=null;
            subscriber.complete();
          },error:(err)=>{
            subscriber.error(err);
          }
        });
      }else{
        // Others have no persistent respectively async deletable storage, they should be finally removed by the GC
        this._buffer=null;
        this._arrayBuffer=null;
        subscriber.next();
        subscriber.complete();
      }
    });
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

export class RandomAccessAudioBufferStream implements RandomAccessAudioStream{

  constructor(private _buffer:AudioBuffer) {
  }

  close(): void {
  }

  framesObs(framePos: number, frameLen: number, bufs: Float32Array[]): Observable<number> {

    return new Observable<number>(subscriber => {
      let read=0;
        let toRead=frameLen;
        if(this._buffer.length<framePos+frameLen){
          toRead=this._buffer.length-framePos;
        }
        for(let ch=0;ch<bufs.length;ch++){
          let chData=this._buffer.getChannelData(ch);
          for(let i=0;i<toRead;i++){
            bufs[ch][i]=chData[framePos+i];
          }
        }
        read=toRead;

        subscriber.next(read);
        subscriber.complete();
    });
  }
}

export class AudioBufferInputStream implements Float32ArrayInputStream{
  private framePos=0;

  constructor(private audioBuffer:AudioBuffer) {
  }

  close(): void {
  }

  skipFrames(n: number) {
    this.framePos+=n;
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
