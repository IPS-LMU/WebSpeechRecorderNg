
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
    running=false;
    ended=false;


    constructor() {
        super({numberOfInputs:0,numberOfOutputs:1});
        this.port.onmessage=(msgEv)=>{
          // received audio playback data from application
          //console.debug("Audio source worklet msg: Received.");

          if(msgEv.data.cmd){
            if('data'===msgEv.data.cmd) {
              if (msgEv.data['audioData']) {
                let chs = msgEv.data.chs;

                //console.debug("Audio source worklet msg: Rec. channels: " + chs);
                //console.debug("Audio source worklet msg: Rec. data length (channels) " + msgEv.data.audioData.length);
                if (chs > 0) {
                  if (!this.ringBuffers) {
                    this.ringBuffers = new Array(chs);
                    for (let ch = 0; ch < chs; ch++) {
                      this.ringBuffers[ch] = new Float32Array(this.RING_BUFFER_FRAMES);
                      this.ringBufferPos = 0;
                      this.ringBufferFilled = 0;
                      //this.ringBufferFree = this.RING_BUFFER_FRAMES;
                    }
                    console.debug("Audio source worklet: Created ring buffers in message method.");
                  }

                  let audioData = new Array(chs);
                  for (let ch = 0; ch < chs; ch++) {
                    audioData[ch] = new Float32Array(msgEv.data.audioData[ch]);
                  }
                  let msgChBufLen = audioData[0].length;
                  for (let ch = 0; ch < chs; ch++) {
                    let msgChBuf = audioData[ch];
                    //let msgChBufLen = msgChBuf.length;
                    let rbFree = this.RING_BUFFER_FRAMES - this.ringBufferFilled;
                    if (msgChBufLen > rbFree) {
                      console.error('Not enough space in ring buffer');
                      // TODO
                    } else {
                      //console.debug("Audio source worklet msg: Fill " + msgChBufLen + " frames...");
                      let copied = 0;
                      let rbWritePos = this.ringBufferPos + this.ringBufferFilled;
                      if (rbWritePos >= this.RING_BUFFER_FRAMES) {
                        rbWritePos -= this.RING_BUFFER_FRAMES;
                      }
                      let free1 = this.RING_BUFFER_FRAMES - rbWritePos + this.ringBufferFilled;
                      let toCopy1 = msgChBufLen;
                      if (toCopy1 > free1) {
                        toCopy1 = free1;
                      }
                      for (let ci = 0; ci < toCopy1; ci++) {
                        this.ringBuffers[ch][rbWritePos + ci] = msgChBuf[copied + ci];
                      }
                      copied += toCopy1;

                      if (copied < msgChBufLen) {
                        let free2 = this.ringBufferPos;
                        let toCopy2 = msgChBufLen - copied;
                        for (let ci = 0; ci < toCopy2; ci++) {
                          this.ringBuffers[ch][0 + ci] = msgChBuf[copied + ci];
                        }
                      }
                    }
                  }
                  this.ringBufferFilled += msgChBufLen;
                  //console.debug("Audio source worklet msg: Ring buffer filled " + this.ringBufferFilled);

                } else {
                  console.debug("Audio source worklet msg: No data !.");
                }
              }
            }else if('start'===msgEv.data.cmd){
              this.running=true;
            }else if('stop'===msgEv.data.cmd){
              this.running=false;
            }
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
        if(!this.running){
          return !this.ended;
        }

        let output=outputs[0];
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
            console.debug("Audio source worklet: Created ring buffers in process method.");
          }
          let outCh = output[0];
          let outChLen = outCh.length;

          let copy1 = outChLen;
          let avail1 = this.ringBufferFilled;
          if (this.ringBufferPos + this.ringBufferFilled > this.RING_BUFFER_FRAMES) {
            avail1 = this.RING_BUFFER_FRAMES - this.ringBufferPos;
          }
          if(avail1<=0){
            return !this.ended;
          }
          if (copy1 > avail1) {
            copy1 = avail1;
          }
          let copied = 0;
          for (let ch = 0; ch < output.length; ch++) {
            let outCh = output[ch];
            for (let ci = 0; ci < copy1; ci++) {
              let posInRb=this.ringBufferPos+ci;
              let v=this.ringBuffers[ch][posInRb];
              //console.debug("Copy (1) audio amplitude: "+v+ " from pos "+posInRb+" to "+ci+" to channel "+ch+" ");
              outCh[ci] = v;
            }
          }
          copied += copy1;
          let copy2 = outChLen - copied;
          for (let ch = 0; ch < output.length; ch++) {
            let outCh = output[ch];
            for (let ci = 0; ci < copy2; ci++) {
              let posInOutCh=copied+ci;
              let v=this.ringBuffers[ch][ci];
              outCh[posInOutCh] = v;
              //console.debug("Copy (2) audio amplitude: "+v+ " from pos "+ci+" to "+posInOutCh+" to channel "+ch+" ");
            }
          }
          copied += copy2;  // Not used, should be equal to outChLen

          this.ringBufferPos += outChLen;
          // Note: Alternative?:  this.ringBufferPos %= this.RING_BUFFER_FRAMES
          if (this.ringBufferPos > this.RING_BUFFER_FRAMES) {
            this.ringBufferPos -= this.RING_BUFFER_FRAMES;
          }
          this.ringBufferFilled -= outChLen;
          //console.debug("Remaining frames for playback: "+this.ringBufferFilled+ ", ring buffer pos: "+this.ringBufferPos);
          if(this.ringBufferFilled<=0){
            this.ended=true;
            this.port.postMessage({eventType:'ended'});
            console.debug("Stream ended");
          }
        }
     return !this.ended;
  }
}

registerProcessor('audio-source-worklet',AudioSourceProcessor);
