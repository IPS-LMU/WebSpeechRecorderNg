export interface Float32ArrayInputStream{
  read(buffers: Array<Float32Array>): number;
  skipFrames(n:number):void;
  close():void;
}

export class EditFloat32ArrayInputStream implements Float32ArrayInputStream{
  private framePos=0;
  private readFrames=0;
  constructor(private _srcInputStream:Float32ArrayInputStream,private offset:number=0,private length?:number|undefined) {
    if (this.offset<0){
        throw Error('Parameter offset must be undefined or greater or equal zero.');
    }
    if (this.length!==undefined && this.length<0){
      throw Error('Parameter length must be undefined or greater or equal zero.');
    }
  }

  private skipToOffset(){
    if(this.framePos==0 && this.offset>0){
      this._srcInputStream.skipFrames(this.offset);
      this.framePos+=this.offset;
    }
  }

  read(buffers: Array<Float32Array>): number{
    this.skipToOffset();
    let read=0;
    if(this.length===undefined){
      read = this._srcInputStream.read(buffers);
    }else {
      if (buffers.length > 0) {
        let bufsCh0 = buffers[0];
        let bufsLen = bufsCh0.length;
        let avail = this.length - this.readFrames;
        if (avail > 0) {
          if (avail > bufsLen) {
            read = this._srcInputStream.read(buffers);
          } else {
            // temporary buffers required
            let tmpBufs = new Array<Float32Array>(buffers.length);
            for (let ch = 0; ch < buffers.length; ch++) {
              tmpBufs[ch] = new Float32Array(avail);
            }
            read = this._srcInputStream.read(tmpBufs);
            for (let ch = 0; ch < buffers.length; ch++) {
              buffers[ch].set(tmpBufs[ch]);
            }
          }
        }
      }
    }
    this.readFrames+=read;
    this.framePos+=read;
    return read;
  }

  skipFrames(n:number):void{
    this.skipToOffset();
    if(this.length===undefined){
      this._srcInputStream.skipFrames(n);
    }else {
      let avail = this.length - this.readFrames;
      if (avail > 0) {
        if (avail >= n) {
          this._srcInputStream.skipFrames(n);
          this.readFrames += n;
          this.framePos += n;
        } else {
          throw Error('Tried to skip out of bounds.')
        }
      }
    }
  }

  close():void{
    this._srcInputStream.close();
  }
}

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

  get chunkSize(): number {
    return this._chunkSize;
  }

  set channels(channels: number) {
    this._channels = channels;
    this.createBuffers();
  }

  get channels(): number {
    return this._channels;
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
