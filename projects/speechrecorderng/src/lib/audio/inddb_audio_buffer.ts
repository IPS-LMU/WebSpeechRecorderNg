import {Observable} from "rxjs";

export class IndexedDbAudioBuffer {


  private _chunkCount=0;
  //private _frameLen:number=0;

  constructor(private inddb:IDBDatabase,private indDbObjStoreNm:string ,private _channelCount: number, private _sampleRate: number,private _chunkFrameLen:number,private _frameLen:number, private uuid:string) {

  }

  get channelCount(): number {
    return this._channelCount;
  }


  private chunk(os:IDBObjectStore,ci:number,cb:(bufs:Array<Float32Array>|null)=>void,errCb:(err:Error)=>void){

        // Build bounds for channels
        let lIdx=[this.uuid,ci,0];
        let hIdx=[this.uuid,ci,this._channelCount];
        let chsKr=IDBKeyRange.bound(lIdx,hIdx);

        let rq=os.getAll(chsKr);

        rq.onsuccess=()=>{
          let cc=rq.result;
          let cc0;
          let ccChs=cc.length;
          if(ccChs==0){
            cb(null);
            return;
          }
          if(ccChs!==this.channelCount){
            errCb(new Error('Number of channels of inddb data ('+ccChs+') does not match number of channels ('+this.channelCount+')'));
            return;
;         }
          if(cc.length>0){
            cc0=cc[0];
          }
          let arrBuf=new Array<Float32Array>();
          let ccLen=cc0.length;
          for(let ch=0;ch<ccChs;ch++){
            let chArr=new Float32Array(ccLen);
            for(let si=0;si<ccLen;si++){
              chArr[si]=cc[ch][si];
            }
            arrBuf.push(chArr);
          }
          cb(arrBuf);
        }
       rq.onerror=(errEv)=>{
          errCb(new Error(errEv.toString()));
        }

  }


  private fillBufs(os:IDBObjectStore,framePos:number,frameLen:number,trgBufs:Float32Array[],filled:number,srcFramePos:number,ci:number,ccPos:number,cb:(filled:number)=>void,cbEnd:(filled:number)=>void,cbErr:(err:Error)=>void){
    this.chunk(os,ci,(ccBufs)=>{
        if(ccBufs){
          let ccBufsChs=ccBufs.length;
          if(ccBufsChs>0) {
            let ccBuf0 = ccBufs[0];
            let ccBufsLen = ccBuf0.length;
            let ccAvail = ccBufsLen - ccPos;
            // Positioning
            if (framePos >= srcFramePos + ccBufsLen) {
              // target frame position is ahead, seek to next source buffer
              ci++;
              ccPos=0;
              srcFramePos+=ccBufsLen;

            } else {
              // Assuming target frame pos is inside current source buffer
              let toCopy = ccBufsLen;

              if (toCopy > ccAvail) {
                toCopy = ccAvail;
              }
              if (toCopy > frameLen) {
                toCopy = frameLen;
              }
              for (let ch = 0; ch < ccBufsChs; ch++) {
                for (let si = 0; si < toCopy; si++) {
                  trgBufs[ch][filled+si] = ccBufs[ch][ccPos+si];
                }
              }
              filled += toCopy;
              frameLen -= toCopy;
              framePos += toCopy;
              ccPos += toCopy;
              if (ccPos >= ccBufsLen) {
                ci++;
                ccPos = 0;
                srcFramePos+=ccBufsLen;
              }
            }
          }
          if(frameLen===0){
            cbEnd(filled);
          }else {
            this.fillBufs(os, framePos, frameLen, trgBufs,filled, srcFramePos,ci,ccPos, cb, cbEnd, cbErr);
          }
        }else{
          cbEnd(filled);
        }
    },(err)=>{
        cbErr(err);
    });

  }


  framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>{

    let obs=new Observable<number>((subscriber)=>{
      let tr=this.inddb.transaction(this.indDbObjStoreNm);
      let os=tr.objectStore(this.indDbObjStoreNm);
      this.fillBufs(os,framePos,frameLen,bufs,0,0,0,0,(val)=>{},(filled:number)=>{
        subscriber.next(filled);
        subscriber.complete();
      },err => {
        subscriber.error(err);
      })

    })

    return obs;
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

}
