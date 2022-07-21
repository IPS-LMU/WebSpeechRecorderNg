
class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{

    BUFFER_QUANTUMS=64;
    QUANTUM_FRAME_LEN=128;
    BUFFER_FRAME_LEN=this.QUANTUM_FRAME_LEN*this.BUFFER_QUANTUMS;
    buffer=null;
    bufferPos=0;
    bufferPosBytes=0;
    constructor() {
        super();

    }

 process(
      inputs,
      outputs,
      parameters
  ){

     let inputsCnt=inputs.length;
     let channelCount=0;
     let inputLen=0;
     let inputLenBytes=0;
     if(inputsCnt>0) {
         let input0 = inputs[0];
         channelCount = input0.length;
         if (channelCount > 0) {
             let input0ch0=input0[0];
             inputLen=input0ch0.length;
             inputLenBytes=input0ch0.buffer.length;
         }
     }
     if (!this.buffer || this.buffer.length < channelCount) {
         this.buffer = new Array(channelCount);
         this.bufferPos = 0;
         for (let bch = 0; bch < channelCount; bch++) {
             this.buffer[bch] = new Float32Array(this.BUFFER_FRAME_LEN);
             this.bufferPos = 0;
             this.bufferPosBytes=0;
         }
     }
     let bufAvail = this.BUFFER_FRAME_LEN - this.bufferPos;
     // check if buffer has to be transferred
     if (inputLen > bufAvail) {
         let ada=new Array(channelCount);
         for (let ch = 0; ch < channelCount; ch++) {
             ada[ch]=this.buffer[ch].buffer.slice(0);
         }
         this.port.postMessage({
             data: ada,
             chs: channelCount,
             len: this.bufferPos
         }, ada);
         // buffer transferred, reset
         this.bufferPos = 0;
         this.bufferPosBytes=0;
     }

     for(let ii=0;ii<inputsCnt;ii++) {
         for (let ch = 0; ch < channelCount; ch++) {
             // Mute outputs
             //outputs[ii][ch].fill(0);
             let chSamples = inputs[ii][ch];
             this.buffer[ch].set(chSamples,this.bufferPos);
         }
         this.bufferPos+=inputLen;
         this.bufferPosBytes+=inputLenBytes;
     }

     return true;
  }
}

registerProcessor('capture-interceptor',AudioCaptureInterceptorProcessor);
