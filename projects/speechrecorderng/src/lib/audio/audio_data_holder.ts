import {ArrayAudioBuffer} from "./array_audio_buffer";
import {AsyncFloat32ArrayInputStream, Float32ArrayInputStream} from "../io/stream";
import {ArrayAudioBufferInputStream} from "./array_audio_buffer_input_stream";
import {Observable} from "rxjs";
import {IndexedDbAudioBuffer, IndexedDbAudioInputStream, IndexedDbRandomAccessStream} from "./inddb_audio_buffer";
import {ArrayAudioBufferRandomAccessStream} from "./array_audio_buffer_random_access_stream";
import {AudioStorageType} from "../speechrecorder/project/project";
import {NetAudioBuffer, NetAudioInputStream, NetRandomAccessAudioStream} from "./net_audio_buffer";
import {RecordingService} from "../speechrecorder/recordings/recordings.service";

export interface AudioSource {
  get duration():number;
  get sampleRate(): number;
  get numberOfChannels(): number;
  get frameLen(): number;
  sampleCounts(): number;
  audioInputStream(): Float32ArrayInputStream | null;
  asyncAudioInputStream(): AsyncFloat32ArrayInputStream | null;
  randomAccessAudioStream():RandomAccessAudioStream;
  releaseAudioData(): Observable<void>;
  set onReady(onReady:(()=>void)|null);
}

export class AudioBufferSource implements AudioSource{
  private _duration:number;
  constructor(private _audioBuffer:AudioBuffer) {
    this._duration=this._audioBuffer.length/this._audioBuffer.sampleRate;
  }

  get audioBuffer(): AudioBuffer {
    return this._audioBuffer;
  }

  get duration(): number {
      return this._duration;
    }
    get sampleRate(): number {
        return this._audioBuffer.sampleRate;
    }
    get numberOfChannels(): number {
        return this._audioBuffer.numberOfChannels;
    }
    get frameLen(): number {
        return this._audioBuffer.length;
    }
    sampleCounts(): number {
      return this._audioBuffer.numberOfChannels*this._audioBuffer.length;
    }
    audioInputStream(): Float32ArrayInputStream | null {
        return new AudioBufferInputStream(this._audioBuffer);
    }
    asyncAudioInputStream(): AsyncFloat32ArrayInputStream | null {
        return null;
    }
    releaseAudioData(): Observable<void> {
       return new Observable(subscriber => {
          subscriber.next();
          subscriber.complete();
       });
    }
    set onReady(onReady: (() => void) | null) {
        throw new Error("Method not implemented.");
    }

  randomAccessAudioStream(): RandomAccessAudioStream {
    return new RandomAccessAudioBufferStream(this._audioBuffer);
  }
}

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
  get audioSource(): AudioSource | null {
    return this._audioSource;
  }
  get duration(): number {
    return this._duration;
  }

  private _numberOfChannels:number=0;
  private _sampleRate:number=0;
  private _frameLen:number=0;
  private _duration:number=0;

  constructor(private _audioSource:AudioSource|null,private recordingsService:RecordingService|null=null) {
    if(this._audioSource) {
      this._numberOfChannels = this._audioSource.numberOfChannels;
      this._sampleRate = this._audioSource.sampleRate;
      this._frameLen = this._audioSource.frameLen;
      this._duration = this._frameLen / this._sampleRate;
    }
  }

  set onReady(onReady:(()=>void)|null){
    if(this._audioSource instanceof  NetAudioBuffer){
      this._audioSource.onReady=onReady;
    }else{
      if(onReady){
        onReady();
      }
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

  randomAccessAudioStream():RandomAccessAudioStream{

      if(this._audioSource){
        return this._audioSource.randomAccessAudioStream();
      }else {
        throw Error('No audio source set');
      }
  }


  // private frames(framePos:number,frameLen:number,bufs:Float32Array[]):number{
  //   let read=0;
  //   if(this._buffer){
  //     let toRead=frameLen;
  //     if(this._buffer.length<framePos+frameLen){
  //       toRead=this._buffer.length-framePos;
  //     }
  //     for(let ch=0;ch<bufs.length;ch++){
  //       let chData=this._buffer.getChannelData(ch);
  //       for(let i=0;i<toRead;i++){
  //         bufs[ch][i]=chData[framePos+i];
  //       }
  //     }
  //     read=toRead;
  //   }else if(this._arrayBuffer){
  //     read=this._arrayBuffer.frames(framePos,frameLen,bufs);
  //   }
  //   return read;
  // }

  audioInputStream():Float32ArrayInputStream|null{
    // if(this._buffer){
    //   return new AudioBufferInputStream(this._buffer);
    // }
    // if(this._arrayBuffer){
    //   return new ArrayAudioBufferInputStream(this._arrayBuffer);
    // }
    // return null;
    if(this._audioSource) {
      return this._audioSource.audioInputStream();
    }else{
      return null;
    }
  }

  asyncAudioInputStream(): AsyncFloat32ArrayInputStream|null{
    // if(this._inddbAudioBuffer){
    //   return new IndexedDbAudioInputStream(this._inddbAudioBuffer);
    // }else if(this._netAudioBuffer){
    //   return new NetAudioInputStream(this._netAudioBuffer);
    // }
    // return null;

    if(this._audioSource) {
      return this._audioSource.asyncAudioInputStream();
    }else{
      return null;
    }
  }

  // get buffer(): AudioBuffer | null {
  //   return this._buffer;
  // }
  //
  // get arrayBuffer(): ArrayAudioBuffer | null {
  //   return this._arrayBuffer;
  // }
  //
  // get inddbBuffer():IndexedDbAudioBuffer|null{
  //   return this._inddbAudioBuffer;
  // }
  //
  // get netBuffer():NetAudioBuffer|null{
  //   return this._netAudioBuffer;
  // }

  releaseAudioData():Observable<void>{
    return new Observable<void>(subscriber => {
      //if (this._audioSource instanceof  IndexedDbAudioBuffer) {
      if(this._audioSource) {
        this._audioSource.releaseAudioData().subscribe({
          next: () => {
            subscriber.next();
          },
          complete: () => {
            this._audioSource = null;
            subscriber.complete();
          }, error: (err) => {
            subscriber.error(err);
          }
        });
      }else{
        subscriber.next();
        subscriber.complete();
      }
      // }else{
      //   // Others have no persistent respectively async deletable storage, they should be finally removed by the GC
      //   //this._buffer=null;
      //   //this._arrayBuffer=null;
      //   this._audioSource=null;
      //   subscriber.next();
      //   subscriber.complete();
      // }
    });
  }

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
