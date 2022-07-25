import {Float32ArrayInputStream} from "../io/stream";
import {ArrayAudioBufferInputStream} from "./array_audio_buffer_input_stream";
import {Observable} from "rxjs";

export class IndexedDbAudioBuffer {


  private _chunkCount=0;
  private _frameLen:number=0;

  constructor(private inddb:IDBDatabase,private indDbObjStoreNm:string ,private _channelCount: number, private _sampleRate: number,private _chunkFrameLen:number, private uuid:string) {

  }

  get channelCount(): number {
    return this._channelCount;
  }

  framesObs(framePos:number,frameLen:number,bufs:Float32Array[]):Observable<number>{

    let obs=new Observable((subscriber)=>{
      let tr=this.inddb.transaction(this.indDbObjStoreNm);
      let os=tr.objectStore(this.indDbObjStoreNm);

      let ccFramePos=0;
      let trgFramePos=framePos;

      let ch0Data = null;

      let cPos=0
      let filled=0;
      let ci=0;

      let firstChkIdx=framePos/this._chunkFrameLen;

      while(filled<frameLen && ci<this._chunkCount){
        // Current chunk
        //let cc0=ch0Data[ci];

        let idxExistsReq=os.count([this.uuid,0,ci]);
        idxExistsReq.onsuccess=()=>{
          if(idxExistsReq.result==1){
            let lIdx=[this.uuid,0,ci];
            let hIdx=[this.uuid,this._channelCount,ci];
            let chsKr=IDBKeyRange.bound(lIdx,hIdx);
            let rq=os.getAll(chsKr);

            rq.onsuccess=()=>{
              let cc=rq.result;
              let cc0;
              if(cc.length>0){
                cc0=cc[0];
              }
              let ccLen=cc0.length;
              let ccFrameEndPos=ccFramePos+ccLen;

              if(trgFramePos>=ccFramePos && trgFramePos<ccFrameEndPos){
                let toCp=frameLen-filled;
                cPos=trgFramePos-ccFramePos;
                if(cPos+toCp>ccLen){
                  toCp=ccLen-cPos;
                }
                for(let ch=0;ch<bufs.length;ch++){

                  //let cc=cc[ch][ci];

                  for(let i=0;i<toCp;i++){
                    bufs[ch][filled+i]=cc[cPos+i];
                  }
                }
                filled+=toCp;
                trgFramePos+=toCp;
                cPos+=toCp;
                ccFramePos+=toCp;
                if(cPos>=ccLen){
                  ccFramePos=ccFrameEndPos;
                  cPos=0;
                  ci++;
                }

              }else{
                // next chunk
                ccFramePos=ccFrameEndPos;
                cPos=0;
                ci++;
              }
            }
          }else if(idxExistsReq.result==0){

          }
        };
      }
    })

    return filled;
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
