
class AudioSourceProcessor extends AudioWorkletProcessor{

    //MIN_BUFFER_DURATION=30; // 30 seconds
    RING_BUFFER_FRAMES=500000; // TODO

    BUFFER_QUANTUMS=64;
    QUANTUM_FRAME_LEN=128;
    BUFFER_FRAME_LEN=this.QUANTUM_FRAME_LEN*this.BUFFER_QUANTUMS;
    //buffer=null;

    ringBufferPos=0;
    ringBufferFilled=0;
    //ringBufferFree=this.RING_BUFFER_FRAMES;
    ringBuffers=null;

    constructor() {
        super();
        this.port.onmessage=(msgEv)=>{
          // received audio playback data from application
          console.debug("Audio source worklet msg: Received.");
          if(msgEv.data['audioData']) {
              let chs = msgEv.data.chs;
              if(!this.ringBuffers){
                this.ringBuffers=new Array(chs);
                for (let ch = 0; ch < chs; ch++) {
                  this.ringBuffers[ch]=new Float32Array(this.RING_BUFFER_FRAMES);
                  this.ringBufferPos=0;
                  this.ringBufferFilled=0;
                  this.ringBufferFree=this.RING_BUFFER_FRAMES;
                }
              }
              for (let ch = 0; ch < chs; ch++) {
                let msgChBuf=msgEv.data['audioData'][ch];
                let msgChBufLen=msgChBuf.length;
                let rbFree=this.RING_BUFFER_FRAMES-this.ringBufferFilled;
                if(msgChBufLen>this.ringBufferFree){
                  console.error('Not enough space in ring buffer');
                  // TODO
                }else{
                  console.debug("Audio source worklet msg: Fill "+msgChBufLen+" frames...");
                  let copied=0;
                  let free1=this.RING_BUFFER_FRAMES-this.ringBufferPos+this.ringBufferFilled;
                  let toCopy1=msgChBufLen;
                  if(toCopy1>free1){
                    toCopy1=free1;
                  }
                  for(let ci=0;ci<toCopy1;ci++){
                    this.ringBuffers[ch][this.ringBufferPos+ci]=msgChBuf[copied+ci];
                  }
                  copied+=free1;

                  if(copied<msgChBufLen){
                    let free2=this.ringBufferPos;
                    let toCopy2=msgChBufLen-copied;
                    for(let ci=0;ci<toCopy2;ci++){
                      this.ringBuffers[ch][0+ci]=msgChBuf[copied+ci];
                    }
                  }
                }
                this.ringBufferFilled+=msgChBufLen;
                console.debug("Audio source worklet msg: Ring buffer filled "+this.ringBufferFilled);
              }

            }else{
            console.debug("Audio source worklet msg: No data !.");
          }
        }
    }

 process(
      inputs,
      outputs,
      parameters
  ){
      //console.debug("Audio source worklet: process "+outputs.length+ " output buffers.");
      // copy ring buffer data to outputs

      for(let oi=0;oi<outputs.length;oi++){
        let output=outputs[oi];
        let chs=output.length;
        //console.debug("Audio source worklet: Output channels: "+chs);
        if(chs>0) {
          if(!this.ringBuffers){
            this.ringBuffers=new Array(chs);
            for (let ch = 0; ch < chs; ch++) {
              this.ringBuffers[ch]=new Float32Array(this.RING_BUFFER_FRAMES);
              this.ringBufferPos=0;
              this.ringBufferFilled=0;
              this.ringBufferFree=this.RING_BUFFER_FRAMES;
            }
            console.debug("Audio source worklet: Created ring buffers ");
          }
          let outCh = output[0];
          let outChLen = outCh.length;
          let copy1 = outChLen;
          let avail1 = this.ringBufferFilled;
          if (this.ringBufferPos + this.ringBufferFilled > this.RING_BUFFER_FRAMES) {
            avail1 = this.RING_BUFFER_FRAMES - this.ringBufferPos;
          }
          if (copy1 > avail1) {
            copy1 = avail1;
          }
          let copied = 0;
          for (let ci = 0; ci < copy1; ci++) {
            for (let ch = 0; ch < output.length; ch++) {
              let outCh = output[ch];
              outCh[ci] = this.ringBuffers[ch][this.ringBufferPos + ci];
            }
          }
          copied += copy1;
          let copy2 = outChLen - copied;
          for (let ci = 0; ci < copy2; ci++) {
            for (let ch = 0; ch < output.length; ch++) {
              let outCh = output[ch];
              outCh[copied + ci] = this.ringBuffers[ch][ci];
            }
          }
          copied += copy2;  // Not used, should be equal to outChLen

          this.ringBufferPos += outChLen;
          // Note: Alternative?:  this.ringBufferPos %= this.RING_BUFFER_FRAMES
          if (this.ringBufferPos > this.RING_BUFFER_FRAMES) {
            this.ringBufferPos -= this.RING_BUFFER_FRAMES;
          }
          this.ringBufferFilled -= outChLen;
        }
      }
     return true;
  }
}

registerProcessor('audio-source-worklet',AudioSourceProcessor);
