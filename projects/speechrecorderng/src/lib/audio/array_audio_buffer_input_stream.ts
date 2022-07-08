import {Float32ArrayInputStream} from "../io/stream";
import {ArrayAudioBuffer} from "./array_audio_buffer";
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

  skipFrames(n:number){
    let toSkip=n;
    if(this.chunkIdx>=this.arrayAudioBuffer.chunkCount) {
      this.eod = true;
      if (toSkip > 0) {
        throw Error('Skip out of bounds: Cannot skip ' + toSkip + ' frames.')
      }
    }else {
      let chunkBuf0 = this.arrayAudioBuffer.data[0][this.chunkIdx];
      let chunkBufsLen = chunkBuf0.length;
      let currBufSkippable = chunkBufsLen - this.chunkFramePos;
      if (n >= currBufSkippable) {
        this._framePos += currBufSkippable;
        toSkip -= currBufSkippable;
        this.chunkIdx++
        this.chunkFramePos = 0;
        if (this.chunkIdx < this.arrayAudioBuffer.chunkCount) {
          this.skipFrames(toSkip);
        } else {
          if (toSkip > 0) {
            throw Error('Skip out of bounds: Cannot skip ' + toSkip + ' frames.')
          }
        }
      } else {
        toSkip -= n;
        this.chunkFramePos += n;
      }
    }
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
