import {Observable} from "rxjs";
import {AsyncFloat32ArrayInputStream, Float32ArrayInputStream} from "../io/stream";
import {UUID} from "../utils/utils";
import {AudioSource, BasicAudioSource, RandomAccessAudioStream} from "./audio_data_holder";

export class PersistentAudioStorageTarget{
  get indexedDb(): IDBDatabase {
    return this._indexedDb;
  }

  get storeName(): string {
    return this._storeName;
  }
  constructor(private _indexedDb:IDBDatabase,private _storeName:string) {
  }

  transaction(mode?:IDBTransactionMode):IDBTransaction{
    return this._indexedDb.transaction(this.storeName, mode);
  }

  objectStore(mode?:IDBTransactionMode ){
    let tr=this.transaction(mode);
    return tr.objectStore(this._storeName);
  }

  deleteAll():Observable<void>{
    return new Observable<void>(subscriber => {
      let os = this.objectStore('readwrite');
      let clearReq=os.clear();
      clearReq.onsuccess=()=>{
        console.debug("Cleared audio storage object store.");
        os.transaction.commit();
      }
      clearReq.onerror=()=>{
        os.transaction.abort();
        console.error("Could not clear object store: "+clearReq.error);
      }
      os.transaction.oncomplete = () => {
        console.debug("Transaction complete: Clear audio storage object store.");
          subscriber.complete();
      }
      os.transaction.onerror = (err) => {
          subscriber.error(err);
      }
    });
  }

}

export class IndexedDbAudioBuffer extends BasicAudioSource implements AudioSource{
  get chunkFrameLen(): number {
    return this._chunkFrameLen;
  }
  get persistentAudioStorageTarget(): PersistentAudioStorageTarget {
    return this._persistentAudioStorageTarget;
  }
  get uuid(): string {
    return this._uuid;
  }


  private _chunkCount=0;
  private indDbChkIdx: number=0;
  private _sealed=false;
  private _storeError:Error|null=null;


  constructor(private _persistentAudioStorageTarget:PersistentAudioStorageTarget,private _channelCount: number, private _sampleRate: number,private _chunkFrameLen:number,private _frameLen:number, private _uuid:string) {
    super();
    this.ready();
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

  private deleteChunk(os:IDBObjectStore,ci:number,cb:(keys:IDBValidKey[])=>void,errCb:(err:Error)=>void){

    // Build bounds for channels
    let lIdx=[this._uuid,ci,0];
    let hIdx=[this._uuid,ci,this._channelCount];
    let chsKr=IDBKeyRange.bound(lIdx,hIdx);

    let exRq=os.getAllKeys(chsKr);

    exRq.onsuccess=()=>{
      let cc=exRq.result;
      if(cc && cc.length>0) {
        let rq = os.delete(chsKr);
        rq.onerror=(errEv)=>{
          errCb(new Error(errEv.toString()));
        }
        os.transaction.oncomplete=()=>{
          cb(cc);
        }
        os.transaction.commit();
      }
    }
    exRq.onerror=(errEv)=>{
      errCb(new Error(errEv.toString()));
    }

  }

  private deleteAllBufs(os:IDBObjectStore,ci:number,cbEnd:()=>void,cbErr:(err:Error)=>void){
    //console.debug('IndexedDbAudioBuffer::fillBufs: framePos:'+framePos+', frameLen: '+frameLen+', filled: '+filled+', srcFramePos: '+srcFramePos+',ci: '+ci+', ccPos: '+ccPos);
    this.deleteChunk(os,ci,(ccKeys)=>{
      if(ccKeys && ccKeys.length>0){
        //console.debug('IndexedDbAudioBuffer::fillBufs frameLen: '+frameLen);
        ci++;
        this.deleteAllBufs(os,ci,cbEnd, cbErr);
      }else{
        //console.debug('IndexedDbAudioBuffer::fillBufs (chunk not found) call: cbend '+filled);
        cbEnd();
      }
    },(err)=>{
      cbErr(err);
    });

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

  return new Observable<void>(subscriber => {

    if (this._persistentAudioStorageTarget && this._uuid) {
      let tr = this._persistentAudioStorageTarget.indexedDb.transaction(this._persistentAudioStorageTarget.storeName, 'readwrite');
      let recFileObjStore = tr.objectStore(this._persistentAudioStorageTarget.storeName);

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
            let chkDbId = [this._uuid, this.indDbChkIdx + chCkIdx, ch];
            let cr = recFileObjStore.add(chChk, chkDbId);
            //console.debug("Added: "+ch+" "+(this.indDbChkIdx+chCkIdx));
            cr.onsuccess = () => {
              //console.debug("Stored audio data to indexed db");
              // if(chCkIdx>= dataChkCnt-1 && ch>=this.channelCount-1){
              //   tr.commit();
              // }
            }
            cr.onerror = () => {
              if(!this._storeError) {
                // Only log the first error
                console.error("Error storing audio data of " + chChk.byteLength + " bytes to indexed db: " + cr.error);
              }
            }
          }
          pos += bufLen;
          this._frameLen+=bufLen;
        }
        this.indDbChkIdx += dataChkCnt;

        tr.onerror = (ev) => {
          if(!this._storeError) {
            // Only log the first error
            console.error("Failed to store audio data to indexed db, transaction error: "+tr.error);
            this._storeError = tr.error;
          }
          subscriber.error(tr.error);
        }
        tr.onabort=(ev)=>{
          // If Chrome reaches quota it aborts the transaction
          if(!this._storeError) {
            // Only log the first error
            console.error("Failed to store audio data to indexed db, transaction aborted: "+tr.error);
            this._storeError = tr.error;
          }
          subscriber.error(tr.error);
        }
        tr.oncomplete = (ev) => {
          subscriber.complete();
        }
        tr.commit();
      } catch (err) {
        subscriber.error(new Error('Transfer audio data error: ' + err));
      }
    }
  });
  }

  static fromChunkAudioBuffer(persistentAudioStorageTarget:PersistentAudioStorageTarget ,audioBuffer:AudioBuffer):Observable<IndexedDbAudioBuffer>{

    return new Observable<IndexedDbAudioBuffer>(subscriber => {
      let chs = audioBuffer.numberOfChannels;
      let sr = audioBuffer.sampleRate;
      let chkFrameLength = audioBuffer.length;

      let iab = new IndexedDbAudioBuffer(persistentAudioStorageTarget, chs, sr, chkFrameLength, 0, UUID.generate());
      iab.appendChunkAudioBuffer(audioBuffer).subscribe(
        {
          next: ()=>{
            subscriber.next(iab);
          },
          complete: () => {
            subscriber.complete();
          },
          error: (err)=>{
            subscriber.error(err);
          }
        }
      )
    });
  }

  appendChunkAudioBuffer(audioBuffer:AudioBuffer){
    if(this._sealed){
      throw new Error('Cannot append audio buffer to already sealed audio buffer.');
    }
    let chs=audioBuffer.numberOfChannels;
    if(this._channelCount!== chs){
      throw new Error('Cannot append audio buffer with '+chs+' channels to this array audio buffer with '+this._channelCount+' channels. Number of channels must match.');
    }
    let sr=audioBuffer.sampleRate;
    if(sr!==this._sampleRate){
      throw new Error('Cannot append audio buffer with samplerate '+sr+' to this array audio buffer with samplerate '+this._sampleRate+'. Samplerates must match.');
    }

    let abFl=audioBuffer.length;
    if(abFl>this._chunkFrameLen){
      throw new Error('Cannot append audio buffer with frame length '+abFl+' to this array audio buffer with chunk frame length '+this._chunkFrameLen+'. Chunk length must be equal or less if last chunk.');
    }
    return new Observable<void>(subscriber => {
      if (this._persistentAudioStorageTarget && this._uuid) {
        let tr = this._persistentAudioStorageTarget.transaction('readwrite');
        let recFileObjStore = tr.objectStore(this._persistentAudioStorageTarget.storeName);
        try {

            for (let ch = 0; ch < this.channelCount; ch++) {
              let chChk = audioBuffer.getChannelData(ch);
              let chkDbId = [this._uuid, this.indDbChkIdx++, ch];
              try {
                let cr = recFileObjStore.add(chChk, chkDbId);
                cr.onsuccess = (ev) => {}
                cr.onerror = (ev) => {
                  // iPad may throw QuotaExceededError here
                  // iPad asks for more storage and if denied, the error is thrown here
                  if(!this._storeError) {
                    // Only log the first error
                    console.error("Error storing audio data of " + chChk.byteLength + " bytes to indexed db: " + cr.error);
                  }
                  //subscriber.error(cr.error);
                }
              }catch(err1:any){
                if(!this._storeError) {
                  console.error("Error adding audio data to indexed db store: " + err1);
                  this._storeError=(err1 instanceof Error)?err1:new Error(err1);
                }
                subscriber.error(err1);
              }
            }
            this._frameLen+=abFl;

          tr.onerror = (ev) => {
            if(!this._storeError) {
              // Only log the first error
              console.error("Failed to store audio data to indexed db, transaction error: "+tr.error);
              this._storeError = tr.error;
            }
            subscriber.error(tr.error);
          }
          tr.onabort=(ev)=>{
            // If Chrome reaches quota it aborts the transaction
            if(!this._storeError) {
              // Only log the first error
              console.error("Failed to store audio data to indexed db, transaction aborted: "+tr.error);
              this._storeError = tr.error;
            }
            subscriber.error(tr.error);
          }
          tr.oncomplete = (ev) => {
            //console.debug("Transaction complete");
            if(abFl<this._chunkFrameLen){
              // last chunk
              this.seal();
            }
            subscriber.next();
            subscriber.complete();
          }
          tr.commit();
        } catch (err) {
          console.error('Catched error: '+err);
          subscriber.error(new Error('Transfer audio data error: ' + err));
        }
      }
    });
  }

  releaseAudioData():Observable<void>{
    return new Observable<void>((subscriber)=>{
      let os=this._persistentAudioStorageTarget.objectStore('readwrite');
      this.deleteAllBufs(os,0,()=>{
        subscriber.next();
        subscriber.complete();
      },(err)=>{
        subscriber.error(err);
      })
    });
  }

  toString():string{
    return "Indexed db audio buffer. Channels: "+this.channelCount+", sample rate: "+this.sampleRate+", chunk frame length: "+this._chunkFrameLen+", number of chunks: "+this.chunkCount+", frame length: "+this.frameLen+", sealed: "+this.sealed();
  }

  asyncAudioInputStream(): AsyncFloat32ArrayInputStream | null {
    return new IndexedDbAudioInputStream(this);
  }

  audioInputStream(): Float32ArrayInputStream | null {
    // Synchronous stream not supported
    return null;
  }

  get duration(): number {
    return this._chunkFrameLen/this._sampleRate;
  }

  get numberOfChannels(): number {
    return this._channelCount;
  }

  sampleCounts(): number {
    return this._channelCount*this._frameLen;
  }

  randomAccessAudioStream(): RandomAccessAudioStream {
    return new IndexedDbRandomAccessStream(this);
  }

}


export class IndexedDbRandomAccessStream implements RandomAccessAudioStream{

  private _currCi=0;
  private _ccCache:Float32Array[]|null=null;

  constructor(private _inddbAb:IndexedDbAudioBuffer) {
  }

  private chunk(os:IDBObjectStore,ci:number,cb:(bufs:Array<Float32Array>|null)=>void,errCb:(err:Error)=>void){

    // Build bounds for channels
    let lIdx=[this._inddbAb.uuid,ci,0];
    let hIdx=[this._inddbAb.uuid,ci,this._inddbAb.channelCount];
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
      if(ccChs!==this._inddbAb.channelCount){
        errCb(new Error('Number of channels of inddb data ('+ccChs+') does not match number of channels ('+this._inddbAb.channelCount+')'));
        return;
                 }
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

  private fillBufs(os:IDBObjectStore,trgState:{framePos:number,frameLen:number,trgBufs:Float32Array[],filled:number},srcState:{srcFramePos:number,ci:number,ccPos:number,ccFilled:number},cb:(filled:number)=>void,cbEnd:(filled:number)=>void,cbErr:(err:Error)=>void){
    //console.debug('IndexedDbAudioBuffer::fillBufs: framePos:'+trgState.framePos+', frameLen: '+trgState.frameLen+', filled: '+trgState.filled+', srcFramePos: '+srcState.srcFramePos+',ci: '+srcState.ci+', ccPos: '+srcState.ccPos);
    if(this._ccCache){
      this._fillBufs(this._ccCache,trgState,srcState);
      //console.debug('IndexedDbAudioBuffer::fillBufs frameLen: '+trgState.frameLen);
      if(trgState.frameLen===0){
        //console.debug('IndexedDbAudioBuffer::fillBufs (framelen==0) call: cbend '+trgState.filled);
        cbEnd(trgState.filled);
      }else {
        this.fillBufs(os, trgState, srcState, cb, cbEnd, cbErr);
      }
    }else {
      this.chunk(os, srcState.ci, (ccBufs) => {
        if (ccBufs) {
          this._currCi = srcState.ci;
          this._ccCache = ccBufs;

          this._fillBufs(ccBufs, trgState, srcState);
          //console.debug('IndexedDbAudioBuffer::fillBufs frameLen: '+trgState.frameLen);
          if (trgState.frameLen === 0) {
            //console.debug('IndexedDbAudioBuffer::fillBufs (framelen==0) call: cbend '+trgState.filled);
            cbEnd(trgState.filled);
          } else {
            this.fillBufs(os,trgState, srcState, cb, cbEnd, cbErr);
          }
        } else {
          //console.debug('IndexedDbAudioBuffer::fillBufs (chunk not found) call: cbend '+trgState.filled);
          cbEnd(trgState.filled);
        }
      }, (err) => {
        cbErr(err);
      });
    }
  }


  framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>{
    return new Observable<number>((subscriber)=>{
      let tr=this._inddbAb.persistentAudioStorageTarget.transaction();
      let os=tr.objectStore(this._inddbAb.persistentAudioStorageTarget.storeName);
      // Positioning
      let newCi=Math.floor(framePos/this._inddbAb.chunkFrameLen);
      if(newCi!==this._currCi){
        this._currCi=newCi;
        this._ccCache=null;
      }
      let srcFramePos=newCi*this._inddbAb.chunkFrameLen;
      let trgState={framePos:framePos,frameLen:frameLen,trgBufs:bufs,filled:0};
      let srcState={srcFramePos:srcFramePos,ci:newCi,ccPos:0,ccFilled:0};
      this.fillBufs(os,trgState,srcState,(val)=>{},(filled:number)=>{
        subscriber.next(filled);
        subscriber.complete();
      },err => {
        subscriber.error(err);
      })
    });
  }

  close(): void {
    this._currCi=0;
    this._ccCache=null;
  }
}

export class IndexedDbAudioInputStream implements AsyncFloat32ArrayInputStream{

  private framePos:number=0;
  private inddbAbStr:IndexedDbRandomAccessStream;
  constructor(private inddbAb:IndexedDbAudioBuffer) {
      this.inddbAbStr=new IndexedDbRandomAccessStream(inddbAb);
  }

  close(): void {
    this.inddbAbStr.close();
  }

  readObs(buffers: Array<Float32Array>): Observable<number> {
    return new Observable<number>(subscr=> {
      if (buffers && buffers.length > 0) {
        let fl = buffers[0].length;
        this.inddbAbStr.framesObs(this.framePos, fl, buffers).subscribe({
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
  }

  skipFrames(n: number):void {
    this.framePos+=n;
  }

}
