import {SequenceAudioFloat32OutStream} from "../io/stream";


// AudioWorkletProcessor not yet declared in TypeScript
// https://github.com/microsoft/TypeScript/issues/28308

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
  ): boolean;
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

declare function registerProcessor(
    name: string,
    processorCtor: (new (
        options?: AudioWorkletNodeOptions
    ) => AudioWorkletProcessor) & {
      parameterDescriptors?: AudioParamDescriptor[];
    }
): undefined;


class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{
  // set data(value: Float32Array[][] | null) {
  //   this._data = value;
  // }
  // set audioOutStream(value: SequenceAudioFloat32OutStream | null) {
  //   this._audioOutStream = value;
  // }
  // set capturing(value: boolean) {
  //   this._capturing = value;
  // }

  //private _capturing:boolean=false;
  //private _data:Float32Array[][]|null=null;
 // private _audioOutStream:SequenceAudioFloat32OutStream|null=null;
  //private _framesRecorded=0;
 process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
  ): boolean {
    //if (this.capturing && this._data) {
      let inputsCnt=inputs.length;
      for(let ii=0;ii<inputsCnt;ii++) {
        let channelCount = inputs[ii].length;
        let currentBuffers = new Array<Float32Array>(channelCount);
        for (let ch: number = 0; ch < channelCount; ch++) {
          let chSamples = inputs[ii][ch];
          let chSamplesCopy = chSamples.slice(0);
          currentBuffers[ch] = chSamplesCopy.slice(0);
          //this._data[ch].push(chSamplesCopy);
          //this._framesRecorded += chSamplesCopy.length;
        }
        //c++;
        // if (this.audioOutStream) {
        //   this.audioOutStream.write(currentBuffers);
        // }
        this.port.postMessage('cpature_data',currentBuffers);
      }
    //}
    return true;

  }
}

registerProcessor('capture-interceptor',AudioCaptureInterceptorProcessor);
