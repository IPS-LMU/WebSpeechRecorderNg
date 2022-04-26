export interface Float32ArrayOutStream {

  write(buffers: Array<Float32Array>): number;

  flush(): void;

  close(): void;
}

export class Float32ArrayChunkerOutStream implements Float32ArrayOutStream {

  private bufs = new Array<Float32Array>();
  private filled: number;

  private _channels: number=0;
  private _chunkSize: number=0;

  private receivedFrames: number;
  private sentFrames: number;

  constructor(private outStream: Float32ArrayOutStream) {
    this.filled = 0;
    this.receivedFrames = 0;
    this.sentFrames = 0;
  }

  private createBuffers() {
    this.bufs = new Array<Float32Array>(this._channels);
    for (let ch = 0; ch < this._channels; ch++) {
      this.bufs[ch] = new Float32Array(this._chunkSize);
    }
  }

  set chunkSize(chunkSize: number) {
    this._chunkSize = chunkSize;
    this.createBuffers();
  }

  set channels(channels: number) {
    this._channels = channels;
    this.createBuffers();
  }

  available(): number {
    return this._chunkSize-this.filled;
  }

  write(buffers: Array<Float32Array>): number {

    let copied = 0;
    if(buffers.length>0) {
      let buffersLen = buffers[0].length;
      this.receivedFrames += buffersLen;
      let avail = buffersLen;
      // Fill out buffers until all values copied

      while (avail > 0) {
        let toFill = this._chunkSize - this.filled;
        if (toFill > avail) {
          toFill = avail;
        }
        let sliceEnd = copied + toFill;

        // Firefox on Android sends only the first channel
        for (let ch = 0; ch < buffersLen; ch++) {
          if(buffers[ch]) {
            let cpPrt = buffers[ch].slice(copied, sliceEnd);
            let buf = this.bufs[ch];
            buf.set(cpPrt, this.filled);
          }
        }
        copied += toFill;
        avail -= toFill;
        this.filled += toFill;
        if (this.filled == this._chunkSize) {
          this.outStream.write(this.bufs);
          this.sentFrames += this.filled;
          this.filled = 0;

        }
      }
    }
    return copied;
  }

  flush(): void {
    if (this.filled > 0) {
      let restBufs = new Array<Float32Array>(this._channels);
      for (let ch = 0; ch < this._channels; ch++) {
        restBufs[ch] = this.bufs[ch].slice(0, this.filled);
      }
      this.outStream.write(restBufs);
      this.outStream.flush();
      this.sentFrames += this.filled;
      this.filled = 0;
    }
  }


  close(): void {
    this.outStream.close();
  }


}
