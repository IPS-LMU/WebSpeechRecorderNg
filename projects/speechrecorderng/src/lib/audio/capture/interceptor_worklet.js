
class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{
 process(
      inputs,
      outputs,
      parameters
  ){
      let inputsCnt=inputs.length;
      for(let ii=0;ii<inputsCnt;ii++) {
        let channelCount = inputs[ii].length;
        //console.debug("Input "+ii+", chs: "+channelCount);
        for (let ch= 0; ch < channelCount; ch++) {
            // Mute outputs
            //outputs[ii][ch].fill(0);
          let chSamples = inputs[ii][ch];
          let chSamplesLen=chSamples.length;
          if(chSamplesLen>0) {
              let trData = chSamples.slice(0);
              this.port.postMessage({data: trData.buffer, inputCnt: ii,ch:ch,chs: channelCount,len:chSamplesLen,byteLen:trData.length}, trData.buffer);
          }
        }
      }
    return true;
  }
}

registerProcessor('capture-interceptor',AudioCaptureInterceptorProcessor);
