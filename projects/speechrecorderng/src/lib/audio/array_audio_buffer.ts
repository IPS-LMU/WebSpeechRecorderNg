import {Float32ArrayInputStream} from "../io/stream";

export class ArrayAudioBuffer {


  private _chunkCount=0;
  private _frameLen:number=0;

  constructor(private _channelCount: number, private _sampleRate: number, private _data: Array<Array<Float32Array>>) {
    if(this._data.length>0) {
      let ch0Data = this.data[0];
      for (let ch0Chk of ch0Data) {
        this._chunkCount++;
        this._frameLen += ch0Chk.length;
      }
    }
  }

  get channelCount(): number {
    return this._channelCount;
  }



  frames(framePos:number,frameLen:number,bufs:Float32Array[]):number{

    let ccFramePos=0;
    let trgFramePos=framePos;
    let ch0Data = this.data[0];
    let cPos=0;
    let filled=0;
    let ci=0;

    while(filled<frameLen && ci<this._chunkCount){
      // Current chunk
      let cc0=ch0Data[ci];
      let ccLen=cc0.length;
      let ccFrameEndPos=ccFramePos+ccLen;

      if(trgFramePos>=ccFramePos && trgFramePos<ccFrameEndPos){
            let toCp=frameLen-filled;
            cPos=framePos-ccFramePos;
        if(cPos+toCp>ccLen){
          toCp=ccLen-cPos;
        }
            for(let ch=0;ch<bufs.length;ch++){
              let cc=this.data[ch][ci];

              for(let i=0;i<toCp;i++){
                bufs[ch][filled+i]=cc[cPos+i];
              }
            }
            filled+=toCp;
            cPos+=toCp;
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

  get data(): Array<Array<Float32Array>> {
    return this._data;
  }

}


export class ArrayAudioBufferInputStream implements Float32ArrayInputStream{

  private _framePos=0;
  private chunkFramePos=0;
  private chunkIdx=0;
  private eod=false;
  constructor(private arrayAudioBuffer:ArrayAudioBuffer) {
    console.debug("Array audio input stream array audio buffer frames: "+arrayAudioBuffer.frameLen);
  }

  close(): void {
  }

  read(buffers: Array<Float32Array>): number {
    let read=0;

    let toRead=buffers[0].length;

      while(read<toRead && !this.eod){
        //console.debug("Chunk "+this.chunkIdx+" of "+this.arrayAudioBuffer.chunkCount+" chunks.")
        if(this.chunkIdx>=this.arrayAudioBuffer.chunkCount) {
          this.eod = true;
          //console.debug("Array audio input stream end of data read frames: "+this.framePos);
        }else {
          let chunkBuf0 = this.arrayAudioBuffer.data[0][this.chunkIdx];
          let chunkBufsLen = chunkBuf0.length;
          let chunkBufAvail = chunkBufsLen - this.chunkFramePos;
          let r = chunkBufAvail;
          if (r > toRead - read) {
            r = toRead - read;
          }
          for (let ch = 0; ch < buffers.length; ch++) {
            let chChunkBuf=this.arrayAudioBuffer.data[ch][this.chunkIdx];
            for (let bi = 0; bi < r; bi++) {
              buffers[ch][read + bi] = chChunkBuf[this.chunkFramePos + bi];
            }
          }
          read += r;

          this.chunkFramePos += r;
          if (this.chunkFramePos >= chunkBufsLen) {
            this.chunkIdx++;
            this.chunkFramePos = 0;
          }
        }
      }
    this._framePos+=read;
      //console.debug("Read: "+read+", frame pos: "+this.framePos)
    if(this._framePos>this.arrayAudioBuffer.frameLen){
      console.error("Array audio input stream frame pos: "+this._framePos+" greater then frame length: "+this.arrayAudioBuffer.frameLen);
    }
    return read;
  }

  get framePos(): number {
    return this._framePos;
  }

}
