import {ArrayAudioBuffer} from "../array_audio_buffer";

// Code from audio_source_worklet.js as string constant to be loaded as module
// Changes in audio_source_worklet.js must be copied and pasted to this string constant

const aswpStr="\n" +
  "class AudioSourceProcessor extends AudioWorkletProcessor{\n" +
  "\n" +
  "    //MIN_BUFFER_DURATION=30; // 30 seconds\n" +
  "    RING_BUFFER_FRAMES=500000; // TODO\n" +
  "\n" +
  "    BUFFER_QUANTUMS=64;\n" +
  "    QUANTUM_FRAME_LEN=128;\n" +
  "    BUFFER_FRAME_LEN=this.QUANTUM_FRAME_LEN*this.BUFFER_QUANTUMS;\n" +
  "    //buffer=null;\n" +
  "\n" +
  "    ringBufferPos=0;\n" +
  "    ringBufferFilled=0;\n" +
  "    //ringBufferFree=this.RING_BUFFER_FRAMES;\n" +
  "    ringBuffers=null;\n" +
  "    running=false;\n" +
  "    ended=false;\n" +
  "\n" +
  "\n" +
  "    constructor() {\n" +
  "        super({numberOfInputs:0,numberOfOutputs:1});\n" +
  "        this.port.onmessage=(msgEv)=>{\n" +
  "          // received audio playback data from application\n" +
  "          //console.debug(\"Audio source worklet msg: Received.\");\n" +
  "\n" +
  "          if(msgEv.data.cmd){\n" +
  "            if('data'===msgEv.data.cmd) {\n" +
  "              if (msgEv.data['audioData']) {\n" +
  "                let chs = msgEv.data.chs;\n" +
  "\n" +
  "                //console.debug(\"Audio source worklet msg: Rec. channels: \" + chs);\n" +
  "                //console.debug(\"Audio source worklet msg: Rec. data length (channels) \" + msgEv.data.audioData.length);\n" +
  "                if (chs > 0) {\n" +
  "                  if (!this.ringBuffers) {\n" +
  "                    this.ringBuffers = new Array(chs);\n" +
  "                    for (let ch = 0; ch < chs; ch++) {\n" +
  "                      this.ringBuffers[ch] = new Float32Array(this.RING_BUFFER_FRAMES);\n" +
  "                      this.ringBufferPos = 0;\n" +
  "                      this.ringBufferFilled = 0;\n" +
  "                      //this.ringBufferFree = this.RING_BUFFER_FRAMES;\n" +
  "                    }\n" +
  "                    console.debug(\"Audio source worklet: Created ring buffers in message method.\");\n" +
  "                  }\n" +
  "\n" +
  "                  let audioData = new Array(chs);\n" +
  "                  for (let ch = 0; ch < chs; ch++) {\n" +
  "                    audioData[ch] = new Float32Array(msgEv.data.audioData[ch]);\n" +
  "                  }\n" +
  "                  let msgChBufLen = audioData[0].length;\n" +
  "                  for (let ch = 0; ch < chs; ch++) {\n" +
  "                    let msgChBuf = audioData[ch];\n" +
  "                    //let msgChBufLen = msgChBuf.length;\n" +
  "                    let rbFree = this.RING_BUFFER_FRAMES - this.ringBufferFilled;\n" +
  "                    if (msgChBufLen > rbFree) {\n" +
  "                      console.error('Not enough space in ring buffer');\n" +
  "                      // TODO\n" +
  "                    } else {\n" +
  "                      //console.debug(\"Audio source worklet msg: Fill \" + msgChBufLen + \" frames...\");\n" +
  "                      let copied = 0;\n" +
  "                      let rbWritePos = this.ringBufferPos + this.ringBufferFilled;\n" +
  "                      if (rbWritePos >= this.RING_BUFFER_FRAMES) {\n" +
  "                        rbWritePos -= this.RING_BUFFER_FRAMES;\n" +
  "                      }\n" +
  "                      let free1 = this.RING_BUFFER_FRAMES - rbWritePos + this.ringBufferFilled;\n" +
  "                      let toCopy1 = msgChBufLen;\n" +
  "                      if (toCopy1 > free1) {\n" +
  "                        toCopy1 = free1;\n" +
  "                      }\n" +
  "                      for (let ci = 0; ci < toCopy1; ci++) {\n" +
  "                        this.ringBuffers[ch][rbWritePos + ci] = msgChBuf[copied + ci];\n" +
  "                      }\n" +
  "                      copied += toCopy1;\n" +
  "\n" +
  "                      if (copied < msgChBufLen) {\n" +
  "                        let free2 = this.ringBufferPos;\n" +
  "                        let toCopy2 = msgChBufLen - copied;\n" +
  "                        for (let ci = 0; ci < toCopy2; ci++) {\n" +
  "                          this.ringBuffers[ch][0 + ci] = msgChBuf[copied + ci];\n" +
  "                        }\n" +
  "                      }\n" +
  "                    }\n" +
  "                  }\n" +
  "                  this.ringBufferFilled += msgChBufLen;\n" +
  "                  //console.debug(\"Audio source worklet msg: Ring buffer filled \" + this.ringBufferFilled);\n" +
  "\n" +
  "                } else {\n" +
  "                  console.debug(\"Audio source worklet msg: No data !.\");\n" +
  "                }\n" +
  "              }\n" +
  "            }else if('start'===msgEv.data.cmd){\n" +
  "              this.running=true;\n" +
  "            }else if('stop'===msgEv.data.cmd){\n" +
  "              this.running=false;\n" +
  "            }\n" +
  "          }\n" +
  "        }\n" +
  "    }\n" +
  "\n" +
  " process(\n" +
  "      inputs,\n" +
  "      outputs,\n" +
  "      parameters\n" +
  "  ){\n" +
  "      //console.debug(\"Audio source worklet: process \"+outputs.length+ \" output buffers.\");\n" +
  "      // copy ring buffer data to outputs\n" +
  "        if(!this.running){\n" +
  "          return !this.ended;\n" +
  "        }\n" +
  "\n" +
  "        let output=outputs[0];\n" +
  "        let chs=output.length;\n" +
  "        //console.debug(\"Audio source worklet: Output channels: \"+chs);\n" +
  "        if(chs>0) {\n" +
  "          if(!this.ringBuffers){\n" +
  "            this.ringBuffers=new Array(chs);\n" +
  "            for (let ch = 0; ch < chs; ch++) {\n" +
  "              this.ringBuffers[ch]=new Float32Array(this.RING_BUFFER_FRAMES);\n" +
  "              this.ringBufferPos=0;\n" +
  "              this.ringBufferFilled=0;\n" +
  "              this.ringBufferFree=this.RING_BUFFER_FRAMES;\n" +
  "            }\n" +
  "            console.debug(\"Audio source worklet: Created ring buffers in process method.\");\n" +
  "          }\n" +
  "          let outCh = output[0];\n" +
  "          let outChLen = outCh.length;\n" +
  "\n" +
  "          let copy1 = outChLen;\n" +
  "          let avail1 = this.ringBufferFilled;\n" +
  "          if (this.ringBufferPos + this.ringBufferFilled > this.RING_BUFFER_FRAMES) {\n" +
  "            avail1 = this.RING_BUFFER_FRAMES - this.ringBufferPos;\n" +
  "          }\n" +
  "          if(avail1<=0){\n" +
  "            return !this.ended;\n" +
  "          }\n" +
  "          if (copy1 > avail1) {\n" +
  "            copy1 = avail1;\n" +
  "          }\n" +
  "          let copied = 0;\n" +
  "          for (let ch = 0; ch < output.length; ch++) {\n" +
  "            let outCh = output[ch];\n" +
  "            for (let ci = 0; ci < copy1; ci++) {\n" +
  "              let posInRb=this.ringBufferPos+ci;\n" +
  "              let v=this.ringBuffers[ch][posInRb];\n" +
  "              //console.debug(\"Copy (1) audio amplitude: \"+v+ \" from pos \"+posInRb+\" to \"+ci+\" to channel \"+ch+\" \");\n" +
  "              outCh[ci] = v;\n" +
  "            }\n" +
  "          }\n" +
  "          copied += copy1;\n" +
  "          let copy2 = outChLen - copied;\n" +
  "          for (let ch = 0; ch < output.length; ch++) {\n" +
  "            let outCh = output[ch];\n" +
  "            for (let ci = 0; ci < copy2; ci++) {\n" +
  "              let posInOutCh=copied+ci;\n" +
  "              let v=this.ringBuffers[ch][ci];\n" +
  "              outCh[posInOutCh] = v;\n" +
  "              //console.debug(\"Copy (2) audio amplitude: \"+v+ \" from pos \"+ci+\" to \"+posInOutCh+\" to channel \"+ch+\" \");\n" +
  "            }\n" +
  "          }\n" +
  "          copied += copy2;  // Not used, should be equal to outChLen\n" +
  "\n" +
  "          this.ringBufferPos += outChLen;\n" +
  "          // Note: Alternative?:  this.ringBufferPos %= this.RING_BUFFER_FRAMES\n" +
  "          if (this.ringBufferPos > this.RING_BUFFER_FRAMES) {\n" +
  "            this.ringBufferPos -= this.RING_BUFFER_FRAMES;\n" +
  "          }\n" +
  "          this.ringBufferFilled -= outChLen;\n" +
  "          //console.debug(\"Remaining frames for playback: \"+this.ringBufferFilled+ \", ring buffer pos: \"+this.ringBufferPos);\n" +
  "          if(this.ringBufferFilled<=0){\n" +
  "            this.ended=true;\n" +
  "            this.port.postMessage({eventType:'ended'});\n" +
  "            console.debug(\"Stream ended\");\n" +
  "          }\n" +
  "        }\n" +
  "     return !this.ended;\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "registerProcessor('audio-source-worklet',AudioSourceProcessor);\n";


export class ArrayAudioBufferSourceNode extends AudioWorkletNode{
    static readonly QUANTUM_FRAME_LEN=128;
    private static moduleLoaded=false;
    private _arrayAudioBuffer:ArrayAudioBuffer|null=null;

    onended: (()=> void)|null=null;

    private constructor(context:AudioContext) {

        super(context,'audio-source-worklet');
        this.channelCountMode='explicit';
        this.port.onmessage=(msgEv:MessageEvent)=>{
            if(msgEv.data){
                let evType=msgEv.data.eventType;
                if(evType){
                    if('ended'===evType){
                       let drainTime=0;
                       if(this._arrayAudioBuffer?.sampleRate){
                          drainTime= ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN/this._arrayAudioBuffer.sampleRate;
                       }
                       //let dstAny:any=this.context.destination;
                       //console.debug('Destination node tail-time: '+dstAny['tail-time']);
                       window.setTimeout(()=>{
                           this.onended?.call(this);
                       },drainTime*1000);

                    }
                }
            }
        }
    }

    static instance(context:AudioContext):Promise<ArrayAudioBufferSourceNode>{
      let audioWorkletModuleBlob= new Blob([aswpStr], {type: 'text/javascript'});
      let audioWorkletModuleBlobUrl=window.URL.createObjectURL(audioWorkletModuleBlob);
      return new Promise((resolve, reject)=>{
        if(ArrayAudioBufferSourceNode.moduleLoaded){
          let obj=new ArrayAudioBufferSourceNode(context);
          resolve.call(this, obj);
        }else {
          context.audioWorklet.addModule(audioWorkletModuleBlobUrl).then(() => {
            ArrayAudioBufferSourceNode.moduleLoaded = true;
            let obj=new ArrayAudioBufferSourceNode(context);
            resolve.call(this, obj);
          }).catch((reason) => {
            reject.call(reason);
          });
        }
      });
    }

    get arrayAudioBuffer(): ArrayAudioBuffer | null {
        return this._arrayAudioBuffer;
    }

    set arrayAudioBuffer(value: ArrayAudioBuffer | null) {
        this._arrayAudioBuffer = value;
        if (this._arrayAudioBuffer?.channelCount) {
            this.channelCount = this._arrayAudioBuffer?.channelCount;

            // TODO fills all buffers for testing now
            for (let chi = 0; chi < this._arrayAudioBuffer.chunkCount; chi++) {
                let trBuffers = new Array<any>(this.channelCount);
                for (let ch = 0; ch < this.channelCount; ch++) {
                    let adCh = this._arrayAudioBuffer.data[ch][chi];
                    let adChCopy = new Float32Array(adCh.length);
                    adChCopy.set(adCh);
                    trBuffers[ch] = adChCopy.buffer;
                }

                this.port.postMessage({
                    cmd:'data',
                    chs: this.channelCount,
                    audioData: trBuffers
                }, trBuffers);
            }
        }
    }

    start(){
        this.port.postMessage({cmd:'start'});
    }
    stop(){
        this.port.postMessage({cmd:'stop'});
    }

}
