import {Float32ArrayChunkerOutStream, Float32ArrayOutStream} from "../../io/stream";

export interface AudioFloat32OutStream extends Float32ArrayOutStream{
    setFormat(channels: number,sampleRate:number):void;
}

export interface SequenceAudioFloat32OutStream extends AudioFloat32OutStream{
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
    //console.debug("SequenceAudioFloat32ChunkerOutStream:setFormat(channels: "+channels+",sampleRate: "+sampleRate+")")
    this.channels=channels;
    this.sampleRate=sampleRate;
    this.chunkSize=Math.round(sampleRate*this.chunkDurationSeconds);
    //console.debug("SequenceAudioFloat32ChunkerOutStream: chunkSize: "+this.chunkSize);
    this.sequenceAudioFloat32OutStream.setFormat(channels,sampleRate);
  }
  nextStream():void{
    this.sequenceAudioFloat32OutStream.nextStream();
  }
}

/**
 * Streams a SequenceAudioFloat32OutStream to multiple streams
 */
export class SequenceAudioFloat32OutStreamMultiplier implements SequenceAudioFloat32OutStream{

  private _sequenceAudioFloat32OutStreams!:Array<SequenceAudioFloat32OutStream>;

  constructor() {
    this._sequenceAudioFloat32OutStreams=new Array<SequenceAudioFloat32OutStream>();
  }

  get sequenceAudioFloat32OutStreams(): Array<SequenceAudioFloat32OutStream> {
    return this._sequenceAudioFloat32OutStreams;
  }

  setFormat(channels: number,sampleRate:number):void{
    for(let os of this._sequenceAudioFloat32OutStreams){
        os.setFormat(channels,sampleRate);
    }
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
    let toWrite:number=buffers.length;
      for (let os of this._sequenceAudioFloat32OutStreams) {
        os.write(buffers);
      }
    return toWrite;
  }
}
