import {Float32ArrayChunkerOutStream, Float32ArrayOutStream, Float32ArrayOutStreamAw} from "../../io/stream";

export interface AudioFloat32OutStream extends Float32ArrayOutStream{
    setFormat(channels: number,sampleRate:number):void;
}

export interface AudioFloat32OutStreamAw extends Float32ArrayOutStreamAw{
  setFormat(channels: number,sampleRate:number):void;
}

export interface SequenceAudioFloat32OutStream extends AudioFloat32OutStream{
    nextStream():void;
}

export interface SequenceAudioFloat32OutStreamAw extends AudioFloat32OutStreamAw{
  nextStream():void;
}

export class SequenceAudioFloat32ChunkerOutStream extends Float32ArrayChunkerOutStream implements SequenceAudioFloat32OutStream{

  private sampleRate:number|null=null;
  private sequenceAudioFloat32OutStream:SequenceAudioFloat32OutStream;
  constructor(outStream:SequenceAudioFloat32OutStream, private chunkDurationSeconds:number){
    super(outStream);
    this.sequenceAudioFloat32OutStream=outStream;
  }

  setFormat(channels: number,sampleRate:number):void{
    this.channels=channels;
    this.sampleRate=sampleRate;
    this.chunkSize=Math.round(sampleRate*this.chunkDurationSeconds);
    this.sequenceAudioFloat32OutStream.setFormat(channels,sampleRate);
  }
  nextStream():void{
    this.sequenceAudioFloat32OutStream.nextStream();
  }
}


export class SequenceAudioFloat32OutStreamMultiplier implements SequenceAudioFloat32OutStream{

  private _sequenceAudioFloat32OutStreams!:Array<SequenceAudioFloat32OutStreamAw>;

  constructor() {
    this._sequenceAudioFloat32OutStreams=new Array<SequenceAudioFloat32OutStreamAw>();
  }

  get sequenceAudioFloat32OutStreams(): Array<SequenceAudioFloat32OutStreamAw> {
    return this._sequenceAudioFloat32OutStreams;
  }

  setFormat(channels: number,sampleRate:number):void{
    // this.channels=channels;
    // this.sampleRate=sampleRate;
    // this.chunkSize=Math.round(sampleRate*this.chunkDurationSeconds);
    // this.sequenceAudioFloat32OutStream.setFormat(channels,sampleRate);
    for(let os of this._sequenceAudioFloat32OutStreams){
        os.setFormat(channels,sampleRate);
    }
    //this._sequenceAudioFloat32OutStreams.forEach((os)=>{os.setFormat(channels,sampleRate)});
  }
  nextStream():void{
    for(let os of this._sequenceAudioFloat32OutStreams){
      os.nextStream();
    }
  }

  close(): void {
    for(let os of this._sequenceAudioFloat32OutStreams){
      os.close();
    }
  }

  flush(): void {
    for(let os of this._sequenceAudioFloat32OutStreams){
      os.flush();
    }
  }

  write(buffers: Array<Float32Array>): number {
    let toWrite:number=0;
    let len=buffers.length;
    if(len>0) {
      toWrite = buffers[0].length;
      let minAvail = Number.MAX_SAFE_INTEGER;
      for (let os of this._sequenceAudioFloat32OutStreams) {
        let avail = os.available();
        if (avail < minAvail) {
          minAvail = avail;
        }
      }
      let bufsToWrite;
      if (minAvail < toWrite) {
        toWrite = minAvail;
        let wBufs = new Array<Float32Array>(len);
        for (let bi = 0; bi < len; bi++) {
          let b=buffers[bi];
          if(b) {
            let wBuf = buffers[bi].slice(0, toWrite);
            wBufs[bi]=wBuf;
          }
        }
        bufsToWrite=wBufs;
      } else {
        bufsToWrite=buffers;
      }
      for (let os of this._sequenceAudioFloat32OutStreams) {
        let w = os.write(bufsToWrite);
        if (w != toWrite) {
          throw Error("Available reported min " + toWrite + " numbers, but could only write " + w + " numbers.")
        }
      }

    }
    return toWrite;
  }
}
