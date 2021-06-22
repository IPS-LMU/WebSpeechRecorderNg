
class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{

    BUFFER_QUANTUMS=64;
    QUANTUM_FRAME_LEN=128;
    BUFFER_FRAME_LEN=this.QUANTUM_FRAME_LEN*this.BUFFER_QUANTUMS;
    buffer=null;
    bufferPos=null;
    constructor() {
        super();

    }

 process(
      inputs,
      outputs,
      parameters
  ){
      let inputsCnt=inputs.length;
      for(let ii=0;ii<inputsCnt;ii++) {

        let channelCount = inputs[ii].length;
        if(!this.buffer || buffer.length!=channelCount){
           this.buffer=new Array(channelCount);
           this.bufferPos=new Array();
           for(let bch=0;bch<channelCount;bch++){
               this.buffer[bch]=new Float32Array(this.BUFFER_FRAME_LEN);
               this.bufferPos[bch]=0;
           }
        }
          let ada = new Array(channelCount);
        //console.debug("Input "+ii+", chs: "+channelCount);
        for (let ch= 0; ch < channelCount; ch++) {
            // Mute outputs
            //outputs[ii][ch].fill(0);
          let chSamples = inputs[ii][ch];
          let chSamplesLen=chSamples.length;
          if(this.BUFFER_FRAME_LEN - this.bufferPos[ch]<chSamplesLen){

          }
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
