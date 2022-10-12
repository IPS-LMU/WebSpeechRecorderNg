import {Observable} from "rxjs";
import {AsyncFloat32ArrayInputStream} from "../io/stream";
import {RandomAccessAudioStream} from "./audio_data_holder";
import {RecordingService} from "../speechrecorder/recordings/recordings.service";
import {HttpErrorResponse} from "@angular/common/http";


export class NetAudioBuffer {
  get recFileService(): RecordingService {
    return this._recFileService;
  }
  get audioContext(): AudioContext {
    return this._audioContext;
  }
  get baseUrl(): string {
    return this._baseUrl;
  }
  get chunkFrameLen(): number {
    return this._chunkFrameLen;
  }

  get uuid(): string|null {
    return this._uuid;
  }

  private _chunkCount=0;
  private _sealed=false;

  constructor(protected _audioContext:AudioContext, private _recFileService:RecordingService, private _baseUrl:string, private _channelCount: number, private _sampleRate: number, private _chunkFrameLen:number, private _frameLen:number, private _uuid:string|null=null) {

  }

  get channelCount(): number {
    return this._channelCount;
  }

  sealed(): boolean {
    return this._sealed;
  }

  seal():void{
    this._sealed=true;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  get frameLen(): number {
    return this._frameLen;
  }

  get chunkCount(): number {
    return this._chunkCount;
  }

  releaseAudioData():Observable<void>{
    return new Observable<void>((subscriber)=>{
        // nothing to remove
        subscriber.next();
        subscriber.complete();
    });
  }

  toString():string{
    return "Indexed db audio buffer. Channels: "+this.channelCount+", sample rate: "+this.sampleRate+", chunk frame length: "+this._chunkFrameLen+", number of chunks: "+this.chunkCount+", frame length: "+this.frameLen+", sealed: "+this.sealed();
  }

    static fromChunkAudioBuffer(aCtx:AudioContext,recordingsService:RecordingService,baseUrl:string,ab: AudioBuffer,frameLen:number):NetAudioBuffer {
    // TODO calculate frameLen from RecordingFile object. (Audio buffer might have different sample rate !!)
      return new NetAudioBuffer(aCtx,recordingsService,baseUrl,ab.numberOfChannels,ab.sampleRate,ab.length,frameLen,null);
    }
}


export class NetRandomAccessAudioStream implements RandomAccessAudioStream{

  private _currCi=0;
  private _ccCache:Float32Array[]|null=null;

  constructor(private _netAb:NetAudioBuffer) {}

  private chunk(baseUrl:string,ci:number,cb:(bufs:Array<Float32Array>|null)=>void,errCb:(err:Error)=>void){

    let startFrame=ci*this._netAb.chunkFrameLen;

    this._netAb.recFileService.chunkAudioRequest(this._netAb.audioContext,baseUrl,startFrame,this._netAb.chunkFrameLen).subscribe(
      {

        next: (ab)=>{
          if(ab){
            let ccChs=ab.numberOfChannels;
            let ccLen=ab.length;
            let arrBuf=new Array<Float32Array>();

            for(let ch=0;ch<ccChs;ch++){
              arrBuf.push(ab.getChannelData(ch).slice());
            }
            cb(arrBuf);
          }else{
            cb(null);
          }
        },
        error:(errEv)=>{
          if(errEv instanceof HttpErrorResponse){
           if(errEv.status===404){
             cb(null);
           } else{
             errCb(new Error(errEv.toString()));
           }
          }else {
            errCb(new Error(errEv.toString()));
          }
        }
      }
    );
  }

  private _fillBufs(ccBufs:Float32Array[],trgState:{framePos:number,frameLen:number,trgBufs:Float32Array[],filled:number},srcState:{srcFramePos:number,ci:number,ccPos:number}){
    let ccBufsChs=ccBufs.length;
    if(ccBufsChs>0) {
      let ccBuf0 = ccBufs[0];
      let ccBufsLen = ccBuf0.length;

      //console.debug('IndexedDbAudioBuffer::fillBufs framePos: '+framePos+', srcFramePos: '+srcFramePos+', ccBufsLen: '+ccBufsLen);
      if (trgState.framePos >= srcState.srcFramePos + ccBufsLen) {
        // target frame position is ahead, seek to next source buffer
        //console.debug('IndexedDbAudioBuffer::fillBufs seek to next inddb buffer');
        this._ccCache=null;
        srcState.ci++;
        srcState.ccPos=0;
        srcState.srcFramePos+=ccBufsLen;
      } else {
        // Assuming target frame pos is inside current source buffer
        srcState.ccPos=trgState.framePos-srcState.srcFramePos;
        let ccAvail = ccBufsLen - srcState.ccPos;
        let toCopy = ccBufsLen;

        if (toCopy > ccAvail) {
          toCopy = ccAvail;
        }
        if (toCopy > trgState.frameLen) {
          toCopy = trgState.frameLen;
        }
        for (let ch = 0; ch < ccBufsChs; ch++) {
          for (let si = 0; si < toCopy; si++) {
            trgState.trgBufs[ch][trgState.filled+si] = ccBufs[ch][srcState.ccPos+si];
          }
        }
        trgState.filled += toCopy;
        trgState.frameLen -= toCopy;
        trgState.framePos += toCopy;
        srcState.ccPos += toCopy;
        if (srcState.ccPos >= ccBufsLen) {
          // Invalidate cache
          this._ccCache=null;
          srcState.ci++;
          this._currCi=srcState.ci;
          srcState.ccPos = 0;
          srcState.srcFramePos+=ccBufsLen;
        }
      }
    }

  }

  private fillBufs(baseUrl:string,trgState:{framePos:number,frameLen:number,trgBufs:Float32Array[],filled:number},srcState:{srcFramePos:number,ci:number,ccPos:number,ccFilled:number},cb:(filled:number)=>void,cbEnd:(filled:number)=>void,cbErr:(err:Error)=>void){
    //console.debug('IndexedDbAudioBuffer::fillBufs: framePos:'+framePos+', frameLen: '+frameLen+', filled: '+filled+', srcFramePos: '+srcFramePos+',ci: '+ci+', ccPos: '+ccPos);
    if(this._ccCache){
      this._fillBufs(this._ccCache,trgState,srcState);
      //console.debug('IndexedDbAudioBuffer::fillBufs frameLen: '+frameLen);
      if(trgState.frameLen===0){
        //console.debug('IndexedDbAudioBuffer::fillBufs (framelen==0) call: cbend '+filled);
        cbEnd(trgState.filled);
      }else {
        this.fillBufs(baseUrl, trgState, srcState, cb, cbEnd, cbErr);
      }
    }else {
      this.chunk(baseUrl, srcState.ci, (ccBufs) => {
        if (ccBufs) {
          this._currCi = srcState.ci;
          this._ccCache = ccBufs;

          this._fillBufs(ccBufs, trgState, srcState);
          //console.debug('IndexedDbAudioBuffer::fillBufs frameLen: '+frameLen);
          if (trgState.frameLen === 0) {
            //console.debug('IndexedDbAudioBuffer::fillBufs (framelen==0) call: cbend '+filled);
            cbEnd(trgState.filled);
          } else {
            this.fillBufs(baseUrl,trgState, srcState, cb, cbEnd, cbErr);
          }
        } else {
          //console.debug('IndexedDbAudioBuffer::fillBufs (chunk not found) call: cbend '+filled);
          cbEnd(trgState.filled);
        }
      }, (err) => {
        cbErr(err);
      });
    }
  }


  framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>{

    let obs=new Observable<number>((subscriber)=>{

      // Positioning
      let newCi=Math.floor(framePos/this._netAb.chunkFrameLen);
      if(newCi!==this._currCi){
        this._currCi=newCi;
        this._ccCache=null;
      }
      let srcFramePos=newCi*this._netAb.chunkFrameLen;
      let trgState={framePos:framePos,frameLen:frameLen,trgBufs:bufs,filled:0};
      let srcState={srcFramePos:srcFramePos,ci:newCi,ccPos:0,ccFilled:0};
      this.fillBufs(this._netAb.baseUrl,trgState,srcState,(val)=>{},(filled:number)=>{
        subscriber.next(filled);
        subscriber.complete();
      },err => {
        subscriber.error(err);
      })

    })

    return obs;
  }

  close(): void {
    this._currCi=0;
    this._ccCache=null;
  }
}

export class NetAudioInputStream implements AsyncFloat32ArrayInputStream{

  private framePos:number=0;
  private netAbStr:NetRandomAccessAudioStream;
  constructor(private netAb:NetAudioBuffer) {
      this.netAbStr=new NetRandomAccessAudioStream(netAb);
  }

  close(): void {
    this.netAbStr.close();
  }

  readObs(buffers: Array<Float32Array>): Observable<number> {
    let obs=new Observable<number>(subscr=> {
      if (buffers && buffers.length > 0) {
        let fl = buffers[0].length;
        this.netAbStr.framesObs(this.framePos, fl, buffers).subscribe({
          next: (read) => {
            this.framePos += read;
            subscr.next(read);
          },
          complete: () => {
            subscr.complete();
          },
          error: (err) => {
            subscr.error(err);
          }
        })
      }else{
        subscr.next(0);
        subscr.complete();
      }
    });
      return obs;
  }

  skipFrames(n: number):void {
    this.framePos+=n;
  }


}