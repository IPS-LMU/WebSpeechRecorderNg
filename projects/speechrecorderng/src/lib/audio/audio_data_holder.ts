import {AsyncFloat32ArrayInputStream, Float32ArrayInputStream} from "../io/stream";
import {Observable} from "rxjs";

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
  addOnReadyListener(onReady:(()=>void)|null):void;
  removeOnReadyListener(onReady:(()=>void)|null):void;
  ready():void;
}

export abstract class BasicAudioSource implements AudioSource{
  protected _ready:boolean=false;
  protected onReadyListeners:Array<(() => void)>=new Array<() => void>();

  addOnReadyListener(onReady: (() => void)): void {
    // let alreadyAdded=false;
    // for(let or of this.onReadyListeners){
    //   if(or===onReady){
    //     alreadyAdded=true;
    //     break;
    //   }
    // }
    // if(!alreadyAdded) {
    //   this.onReadyListeners.push(onReady);
    // }

    if(! (this.onReadyListeners.find((or)=>or===onReady))){
      this.onReadyListeners.push(onReady);
    }

    if(this._ready){
      onReady();
    }
  }

  removeOnReadyListener(onReady: (() => void)):void {
    this.onReadyListeners=this.onReadyListeners.filter((or)=>or!==onReady);
  }

  ready():void{
    this._ready=true;
    for(let onReady of this.onReadyListeners){
      onReady.call(this);
    }
  }

  abstract asyncAudioInputStream(): AsyncFloat32ArrayInputStream | null;

  abstract audioInputStream(): Float32ArrayInputStream | null;

  abstract  get duration(): number;

  abstract get frameLen(): number;

  abstract get numberOfChannels(): number;

  abstract randomAccessAudioStream(): RandomAccessAudioStream ;

  abstract releaseAudioData(): Observable<void> ;

  abstract sampleCounts(): number;

  abstract get sampleRate(): number;
}

export class AudioBufferSource extends BasicAudioSource{
  private readonly _duration:number;
  constructor(private _audioBuffer:AudioBuffer) {
    super();
    this._duration=this._audioBuffer.length/this._audioBuffer.sampleRate;
    this.ready();
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

  randomAccessAudioStream(): RandomAccessAudioStream {
    return new RandomAccessAudioBufferStream(this._audioBuffer);
  }
}

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

  private readonly _numberOfChannels:number=0;
  private readonly _sampleRate:number=0;
  private readonly _frameLen:number=0;
  private readonly _duration:number=0;

  constructor(private _audioSource:AudioSource|null) {
    if(this._audioSource) {
      this._numberOfChannels = this._audioSource.numberOfChannels;
      this._sampleRate = this._audioSource.sampleRate;
      this._frameLen = this._audioSource.frameLen;
      this._duration = this._frameLen / this._sampleRate;
    }
  }

  addOnReadyListener(onReady:(()=>void)|null):void{
    this._audioSource?.addOnReadyListener(onReady);
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
