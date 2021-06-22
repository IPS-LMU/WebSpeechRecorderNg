
class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{
 process(
      inputs,
      outputs,
      parameters
  ){
      let inputsCnt=inputs.length;
      for(let ii=0;ii<inputsCnt;ii++) {

        let channelCount = inputs[ii].length;
          let ada = new Array(channelCount);
        //console.debug("Input "+ii+", chs: "+channelCount);
        for (let ch= 0; ch < channelCount; ch++) {
            // Mute outputs
            //outputs[ii][ch].fill(0);
          let chSamples = inputs[ii][ch];
          //let chSamplesLen=chSamples.length;
          //if(chSamplesLen>0) {
            ada[ch] = chSamples.buffer.slice(0);
          //}
        }
        this.port.postMessage({data: ada, inputCnt: ii,chs: channelCount}, ada);
      }
    return true;
  }
}

registerProcessor('capture-interceptor',AudioCaptureInterceptorProcessor);
