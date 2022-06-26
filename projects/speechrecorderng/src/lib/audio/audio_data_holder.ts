import {ArrayAudioBuffer} from "./array_audio_buffer";

export class AudioDataHolder{

  private _channelCount:number=0;
  private _sampleRate:number=0;
  private _frameLen:number=0;

  constructor(private _buffer: AudioBuffer|null,private _arrayBuffer:ArrayAudioBuffer|null=null) {
    if(this._buffer && this._arrayBuffer){
      throw Error('Only one of either audio buffer or array audio buffer must be set!');
    }
    if (this._buffer || this._arrayBuffer) {
      if (this._buffer) {
        this._channelCount = this._buffer.numberOfChannels;
        this._sampleRate = this._buffer.sampleRate;
        this._frameLen=this._buffer.length;
      } else if (this._arrayBuffer) {
        this._channelCount = this._arrayBuffer.channelCount;
        this._sampleRate = this._arrayBuffer.sampleRate;
        this._frameLen=this._arrayBuffer.frameLen;
      }

    }else{
      throw Error('One of either audio buffer or array audio buffer must be set!');
    }
  }

  get sampleRate(): number {
    return this._sampleRate;
  }
  get channelCount(): number {
    return this._channelCount;
  }

  get frameLen(): number {
    return this._frameLen;
  }

  sampleCounts():number{
    return this._channelCount*this._frameLen;
  }

  get buffer(): AudioBuffer | null {
    return this._buffer;
  }

  get arrayBuffer(): ArrayAudioBuffer | null {
    return this._arrayBuffer;
  }

}
