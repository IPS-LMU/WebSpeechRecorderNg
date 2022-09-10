import {Float32ArrayInputStream} from "../io/stream";
import {ArrayAudioBufferInputStream} from "./array_audio_buffer_input_stream";
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


  private fillBufs(os:IDBObjectStore,framePos:number,frameLen:number,resBufs:Float32Array[],filled:number,srcFramePos:number,ci:number,ccFramePos:number,cb:(filled:number)=>void,cbEnd:(filled:number)=>void,cbErr:(err:Error)=>void){
    this.chunk(os,ci,(bufs)=>{
        if(bufs){
          let bufsChs=bufs.length;
          if(bufsChs>0) {
            let buf0 = bufs[0];
            let bufsLen = buf0.length;
            let ccAvail = bufsLen - ccFramePos;
            // Positioning
            if (framePos >= srcFramePos + ccAvail) {
              // target frame position is ahead, seek to next source buffer
              ci++;
              ccFramePos=0;
              srcFramePos+=ccAvail;

            } else {
              // Assuming target frame pos is inside current source buffer
              let toCopy = bufsLen;

              if (toCopy > ccAvail) {
                toCopy = ccAvail;
              }
              if (toCopy > frameLen) {
                toCopy = frameLen;
              }
              for (let ch = 0; ch < bufsChs; ch++) {
                for (let si = 0; si < toCopy; si++) {
                  resBufs[ch][framePos + si] = bufs[ch][si];
                }
              }
              filled += toCopy;
              frameLen -= toCopy;
              framePos += toCopy;
              ccFramePos += toCopy;
              srcFramePos+=toCopy;
              if (ccFramePos >= bufsLen) {
                ci++;
                ccFramePos = 0;
              }
            }
          }
          if(frameLen===0){
            cbEnd(filled);
          }else {
            this.fillBufs(os, framePos, frameLen, resBufs,filled, srcFramePos,ci,ccFramePos, cb, cbEnd, cbErr);
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

      let ccFramePos=0;
      let trgFramePos=framePos;

      let ch0Data = null;

      let cPos=0
      let filled=0;
      let ci=0;

      let firstChkIdx=framePos/this._chunkFrameLen;

      // while(filled<frameLen && ci<this._chunkCount){
      //   // Current chunk
      //   //let cc0=ch0Data[ci];
      //
      //   let idxExistsReq=os.count([this.uuid,0,ci]);
      //   idxExistsReq.onsuccess=()=>{
      //     if(idxExistsReq.result==1){
      //       this.chunk(os,ci,(bufs)=>{
      //
      //       },(err)=>{
      //
      //       });
      //
      //       let lIdx=[this.uuid,0,ci];
      //       let hIdx=[this.uuid,this._channelCount,ci];
      //       let chsKr=IDBKeyRange.bound(lIdx,hIdx);
      //       let rq=os.getAll(chsKr);
      //
      //       rq.onsuccess=()=>{
      //         let cc=rq.result;
      //         let cc0;
      //         if(cc.length>0){
      //           cc0=cc[0];
      //         }
      //         let ccLen=cc0.length;
      //         let ccFrameEndPos=ccFramePos+ccLen;
      //
      //         if(trgFramePos>=ccFramePos && trgFramePos<ccFrameEndPos){
      //           let toCp=frameLen-filled;
      //           cPos=trgFramePos-ccFramePos;
      //           if(cPos+toCp>ccLen){
      //             toCp=ccLen-cPos;
      //           }
      //           for(let ch=0;ch<bufs.length;ch++){
      //
      //             //let cc=cc[ch][ci];
      //
      //             for(let i=0;i<toCp;i++){
      //               bufs[ch][filled+i]=cc[cPos+i];
      //             }
      //           }
      //           filled+=toCp;
      //           trgFramePos+=toCp;
      //           cPos+=toCp;
      //           ccFramePos+=toCp;
      //           if(cPos>=ccLen){
      //             ccFramePos=ccFrameEndPos;
      //             cPos=0;
      //             ci++;
      //           }
      //
      //         }else{
      //           // next chunk
      //           ccFramePos=ccFrameEndPos;
      //           cPos=0;
      //           ci++;
      //         }
      //       }
      //       //subscriber.next(filled);
      //
      //     }else if(idxExistsReq.result==0){
      //         // end
      //     }
      //   };
      //}

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
