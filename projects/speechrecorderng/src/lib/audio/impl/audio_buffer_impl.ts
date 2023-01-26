/**
Simple implementation of the AudioBuffer interface. It is recommended to use standard implementation of Web Audio API.
*/
export class AudioBufferImpl implements AudioBuffer{
  readonly duration: number=0;
  readonly length: number=0;
  readonly numberOfChannels: number=0;
  readonly sampleRate: number=0;

  private readonly _audioData:Array<Float32Array>;

  constructor(numberOfChannels:number,sampleRate:number,length:number) {
    this.sampleRate=sampleRate;
    this.numberOfChannels=numberOfChannels;
    this.length=length;
    this.duration=this.length/this.sampleRate;
    this._audioData=new Array<Float32Array>(this.numberOfChannels);
    for(let ch=0;ch<numberOfChannels;ch++){
      this._audioData[ch]=new Float32Array(length);
    }
  }


  copyFromChannel(destination: Float32Array, channelNumber: number, bufferOffset?: number): void {
    destination.set(this.getChannelData(channelNumber),bufferOffset);
  }

  copyToChannel(source: Float32Array, channelNumber: number, bufferOffset?: number): void {
    this._audioData[channelNumber].set(source,bufferOffset);
  }

  getChannelData(channel: number): Float32Array {
    return this._audioData[channel];
  }

}
