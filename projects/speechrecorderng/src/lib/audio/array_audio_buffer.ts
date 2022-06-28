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


export class ArrayAudioBufferInputsStream implements Float32ArrayInputStream{
  private framePos=0;
  private chunkFramePos=0;
  private chunkIdx=0;
  private eod=false;
  constructor(private arrayAudioBuffer:ArrayAudioBuffer) {
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
              buffers[ch][read + bi] = chChunkBuf[this.chunkIdx + bi];
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
    return read;
  }

}
