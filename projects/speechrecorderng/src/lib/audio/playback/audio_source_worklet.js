
// Important note: Changes in audio_source_worklet.js must be copied and pasted to the string constant aswpStr in audio_source_worklet_module_loader.ts


class AudioSourceProcessor extends AudioWorkletProcessor{

    filledFrames=0;
    audioBuffers=new Array();
    currentAudioBuffer=null;
    currentAudioBufferFramePos=0;
    currentAudioBufferAvail=0;
    running=false;
    stalled=false;
    stopped=false;
    endOfStream=false;
    ended=false;

    constructor() {
        super({numberOfInputs:0,numberOfOutputs:1});
        this.port.onmessage=(msgEv)=>{
          // received audio playback data from application
          //console.debug("Audio source worklet msg: Received.");

          if(msgEv.data.cmd){
            if('data'===msgEv.data.cmd) {
              let chs = msgEv.data.chs;

              let audioData = new Array(chs);
              for (let ch = 0; ch < chs; ch++) {
                audioData[ch] = new Float32Array(msgEv.data.audioData[ch]);
              }
              let msgChBufLen=audioData[0].length;
              this.audioBuffers.push(audioData);
              this.filledFrames += msgChBufLen;
              //console.debug("Audio source worklet msg: Filled " + this.filledFrames+ " in "+this.audioBuffers.length+" buffers.");

            }else if('start'===msgEv.data.cmd){
              this.running=true;
            }else if('stop'===msgEv.data.cmd){
              //console.debug("Stop...");
              this.running=false;
              this.stopped=true;
              // clear buffers
              this.filledFrames=0;
              while(this.audioBuffers.length > 0) {
                this.audioBuffers.pop();
              }
              this.currentAudioBuffer=new Float32Array(0);
            }else if('endOfStream'===msgEv.data.cmd){
              this.endOfStream=true;
            }else if('continue'===msgEv.data.cmd){
              console.debug("Continue after stalled...");
              this.stalled=false;
              this.port.postMessage({eventType: 'resumed'});
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
        if(!this.running || this.stalled){
            if(this.endOfStream) {
                this.ended = true;
                this.port.postMessage({eventType: 'ended'});
            }
          return !this.ended && !this.stopped;
        }

        let output=outputs[0];
        let chs=output.length;
        //console.debug("Audio source worklet: Output channels: "+chs);
        if(chs>0) {

          let outCh0 = output[0];
          let outChLen = outCh0.length;

          if(!this.currentAudioBuffer){
            // get first buffer
            let nxtBuff=this.audioBuffers.shift();
            if(nxtBuff) {
              this.currentAudioBuffer = nxtBuff;
              this.currentAudioBufferFramePos=0;
              this.currentAudioBufferAvail=this.currentAudioBuffer[0].length;
            }else{
              return true;
            }
          }

          let copied=0;
          do{
            if(this.currentAudioBufferAvail===0){
              let nxtBuff=this.audioBuffers.shift();
              if(nxtBuff){
                this.currentAudioBuffer=nxtBuff;
                this.currentAudioBufferFramePos=0;
                this.currentAudioBufferAvail=this.currentAudioBuffer[0].length;
                //console.debug("Next buffer with "+this.currentAudioBufferAvail+ " frames");
                this.port.postMessage({eventType:'bufferNotification',filledFrames:this.filledFrames});
              }else{
                if(this.endOfStream) {
                  this.ended = true;
                  this.port.postMessage({eventType: 'ended'});
                  //console.debug("Stream ended");
                }else{
                  if(!this.stalled) {
                    this.stalled = true;
                    this.port.postMessage({eventType: 'stalled'});
                  }
                }
                break;
              }
            }
            //console.debug("outChLen: "+outChLen+", copied: "+copied+", current avail: "+this.currentAudioBufferAvail);
            let toCopy=outChLen-copied;
            if(toCopy>this.currentAudioBufferAvail){
              toCopy=this.currentAudioBufferAvail;
            }
            //console.debug("Copy "+toCopy+" frames...");
            for(let ch=0;ch<chs;ch++) {
              let outCh=output[ch];
              for (let i = 0; i < toCopy; i++) {
                outCh[copied+i]=this.currentAudioBuffer[ch][this.currentAudioBufferFramePos+i];
              }
            }
            copied+=toCopy;
            this.currentAudioBufferFramePos+=toCopy;
            this.currentAudioBufferAvail-=toCopy;

          }while(copied<outChLen);
          this.filledFrames-=copied;
          //console.debug("Copied "+copied+" frames.");
        }
     return !this.ended;
  }
}

registerProcessor('audio-source-worklet',AudioSourceProcessor);
