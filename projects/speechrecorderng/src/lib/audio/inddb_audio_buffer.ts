import {Observable} from "rxjs";
import {AsyncFloat32ArrayInputStream} from "../io/stream";
import {UUID} from "../utils/utils";


export class IndexedDbAudioBuffer {

  private _chunkCount=0;
  private indDbChkIdx: number=0;

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
    // Positioning
    ci=Math.floor(framePos/this._chunkFrameLen);
    ccPos=0;
    srcFramePos=ci*this._chunkFrameLen;

    this.chunk(os,ci,(ccBufs)=>{
        if(ccBufs){
          let ccBufsChs=ccBufs.length;
          if(ccBufsChs>0) {
            let ccBuf0 = ccBufs[0];
            let ccBufsLen = ccBuf0.length;


            if (framePos >= srcFramePos + ccBufsLen) {
              // target frame position is ahead, seek to next source buffer
              ci++;
              ccPos=0;
              srcFramePos+=ccBufsLen;

            } else {
              // Assuming target frame pos is inside current source buffer
              ccPos=framePos-srcFramePos;
              let ccAvail = ccBufsLen - ccPos;
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

  appendRawAudioData(data:Array<Array<Float32Array>>):Observable<void>{

  let obs=new Observable<void>(subscriber => {

    if (this.inddb && this.uuid) {
      let tr = this.inddb.transaction(this.indDbObjStoreNm, 'readwrite');
      let recFileObjStore = tr.objectStore(this.indDbObjStoreNm);

      try {
        let ch0Data = data[0];
        let dataChkCnt = ch0Data.length;
        let pos = 0;
        for (let chCkIdx = 0; chCkIdx < dataChkCnt; chCkIdx++) {
          let bufLen = 0;
          for (let ch = 0; ch < this.channelCount; ch++) {
            let chChk = data[ch][chCkIdx];
            bufLen = chChk.length;
            //let cacheId = uuid + '_' + ch + '_' + chCkIdx;
            let chkDbId = [this.uuid, this.indDbChkIdx + chCkIdx, ch];
            let cr = recFileObjStore.add(chChk, chkDbId);
            //console.debug("Added: "+ch+" "+(this.indDbChkIdx+chCkIdx));
            cr.onsuccess = () => {
              //console.debug("Stored audio data to indexed db");
            }
            cr.onerror = () => {
              console.error("Error storing audio data to indexed db");
            }
          }
          pos += bufLen;
          this._frameLen+=bufLen;
        }
        this.indDbChkIdx += dataChkCnt;

        tr.onerror = (err) => {
          //console.error('Failed to cache audio data to indexed db: ' + err)
          subscriber.error(new Error('Failed to cache audio data to indexed db: ' + err));
        }
        tr.oncomplete = () => {
          //console.debug('Transferred capture audio data to indexed db, deleting original data from memory...');

          // /// Audio data saved to index db delete from in memory data array
          // for (let ch = 0; ch < this.channelCount; ch++) {
          //   data[ch].splice(0);
          //   //console.debug("Spliced/removed ch: "+ch);
          // }

          // this.persisted = true;
          // if (this.listener && !this.capturing) {
          //   //console.debug("Stopped by indexed db hook");
          //   this.listener.stopped();
          // }
          subscriber.complete();
        }
        // Commit chunks
        //this.persisted = false;
        tr.commit();
      } catch (err) {
        subscriber.error(new Error('Transfer capture audio data error: ' + err));
      }
    }
  });
  return obs;
  }

  static fromAudioBuffer(indDb:IDBDatabase,indDbObjStoreNm:string ,audioBuffer:AudioBuffer,chunkFrameSize=8192):IndexedDbAudioBuffer{
    let aab:IndexedDbAudioBuffer;
    let chs=audioBuffer.numberOfChannels;
    let sr=audioBuffer.sampleRate;
    let frameLength=audioBuffer.length;
    //let chunksSize=Math.ceil(frameLength/chunkFrameSize);
    let framePos=0;
    let data=new Array<Array<Float32Array>>(chs);
    for(let ch=0;ch<chs;ch++) {
      data[ch]=new Array<Float32Array>();
    }
    let toCopy=frameLength-framePos;
    while(toCopy>0){

      let toCopyChunk=chunkFrameSize;
      if(toCopyChunk>toCopy){
        // last chunk, the rest
        toCopyChunk=toCopy;
      }
      for(let ch=0;ch<chs;ch++) {
        data[ch].push(audioBuffer.getChannelData(ch).slice(framePos, framePos + toCopyChunk));
      }
      framePos+=toCopyChunk;
      toCopy-=toCopyChunk;
    }
    //aab=new ArrayAudioBuffer(chs,audioBuffer.sampleRate,data);
    aab=new IndexedDbAudioBuffer(indDb,indDbObjStoreNm,chs,sr,chunkFrameSize,frameLength,UUID.generate());
    return aab;
  }

  appendAudioBuffer(audioBuffer:AudioBuffer){
    let chs=audioBuffer.numberOfChannels;
    if(this._channelCount!== chs){
      throw new Error('Cannot append audio buffer with '+chs+' channels to this array audio buffer with '+this._channelCount+' channels. Number of channels must match.');
    }
    let sr=audioBuffer.sampleRate;
    if(sr!==this._sampleRate){
      throw new Error('Cannot append audio buffer with samplerate '+sr+' to this array audio buffer with samplerate '+this._sampleRate+'. Samplerates must match.');
    }

    for(let ch=0;ch<chs;ch++) {
      let chAbSlice=audioBuffer.getChannelData(ch).slice();
      //console.debug("Append audio buffer ch: "+ch+": "+chAbSlice.length);
      //this._data[ch].push(chAbSlice);
    }
    //this.updateFrameLen();
  }


}

export class IndexedDbAudioInputStream implements AsyncFloat32ArrayInputStream{

  private framePos:number=0;

  constructor(private indbAb:IndexedDbAudioBuffer) {

  }

  close(): void {
    // Nothing to do for now (maybe close indexed db transaction here?)
  }

  readObs(buffers: Array<Float32Array>): Observable<number> {
    let obs=new Observable<number>(subscr=> {
      if (buffers && buffers.length > 0) {
        let fl = buffers[0].length;
        this.indbAb.framesObs(this.framePos, fl, buffers).subscribe({
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
