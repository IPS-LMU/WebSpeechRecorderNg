import {Float32ArrayChunkerOutStream, Float32ArrayOutStream} from "../../io/stream";

export interface AudioFloat32OutStream extends Float32ArrayOutStream{
    setFormat(channels: number,sampleRate:number):void;
}

export interface SequenceAudioFloat32OutStream extends AudioFloat32OutStream{
    nextStream():void;
}



export class SequenceAudioFloat32ChunkerOutStream extends Float32ArrayChunkerOutStream implements SequenceAudioFloat32OutStream{

  private sampleRate:number;
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
