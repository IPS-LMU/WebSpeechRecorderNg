// Code from audio_source_worklet.js as string constant to be loaded as module
// Changes in audio_source_worklet.js must be copied and pasted to this string constant

const aswpStr = "\n" +
  "// Important note: Changes in audio_source_worklet.js must be copied and pasted to the string constant aswpStr in audio_source_worklet_module_loader.ts\n" +
  "\n" +
  "\n" +
  "class AudioSourceProcessor extends AudioWorkletProcessor{\n" +
  "\n" +
  "    filledFrames=0;\n" +
  "    audioBuffers=new Array();\n" +
  "    currentAudioBuffer=null;\n" +
  "    currentAudioBufferFramePos=0;\n" +
  "    currentAudioBufferAvail=0;\n" +
  "    running=false;\n" +
  "    stalled=false;\n" +
  "    stopped=false;\n" +
  "    endOfStream=false;\n" +
  "    ended=false;\n" +
  "\n" +
  "    constructor() {\n" +
  "        super({numberOfInputs:0,numberOfOutputs:1});\n" +
  "        this.port.onmessage=(msgEv)=>{\n" +
  "          // received audio playback data from application\n" +
  "          //console.debug(\"Audio source worklet msg: Received.\");\n" +
  "\n" +
  "          if(msgEv.data.cmd){\n" +
  "            if('data'===msgEv.data.cmd) {\n" +
  "              let chs = msgEv.data.chs;\n" +
  "\n" +
  "              let audioData = new Array(chs);\n" +
  "              for (let ch = 0; ch < chs; ch++) {\n" +
  "                audioData[ch] = new Float32Array(msgEv.data.audioData[ch]);\n" +
  "              }\n" +
  "              let msgChBufLen=audioData[0].length;\n" +
  "              this.audioBuffers.push(audioData);\n" +
  "              this.filledFrames += msgChBufLen;\n" +
  "              //console.debug(\"Audio source worklet msg: Filled \" + this.filledFrames+ \" in \"+this.audioBuffers.length+\" buffers.\");\n" +
  "\n" +
  "            }else if('start'===msgEv.data.cmd){\n" +
  "              this.running=true;\n" +
  "            }else if('stop'===msgEv.data.cmd){\n" +
  "              //console.debug(\"Stop...\");\n" +
  "              this.running=false;\n" +
  "              this.stopped=true;\n" +
  "              // clear buffers\n" +
  "              this.filledFrames=0;\n" +
  "              while(this.audioBuffers.length > 0) {\n" +
  "                this.audioBuffers.pop();\n" +
  "              }\n" +
  "              this.currentAudioBuffer=new Float32Array(0);\n" +
  "            }else if('endOfStream'===msgEv.data.cmd){\n" +
  "              this.endOfStream=true;\n" +
  "            }else if('continue'===msgEv.data.cmd){\n" +
  "              console.debug(\"Continue after stalled...\");\n" +
  "              this.stalled=false;\n" +
  "              this.port.postMessage({eventType: 'resumed'});\n" +
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
  "        if(!this.running || this.stalled){\n" +
  "          return !this.ended && !this.stopped;\n" +
  "        }\n" +
  "\n" +
  "        let output=outputs[0];\n" +
  "        let chs=output.length;\n" +
  "        //console.debug(\"Audio source worklet: Output channels: \"+chs);\n" +
  "        if(chs>0) {\n" +
  "\n" +
  "          let outCh0 = output[0];\n" +
  "          let outChLen = outCh0.length;\n" +
  "\n" +
  "          if(!this.currentAudioBuffer){\n" +
  "            // get first buffer\n" +
  "            let nxtBuff=this.audioBuffers.shift();\n" +
  "            if(nxtBuff) {\n" +
  "              this.currentAudioBuffer = nxtBuff;\n" +
  "              this.currentAudioBufferFramePos=0;\n" +
  "              this.currentAudioBufferAvail=this.currentAudioBuffer[0].length;\n" +
  "            }else{\n" +
  "              return true;\n" +
  "            }\n" +
  "          }\n" +
  "\n" +
  "          let copied=0;\n" +
  "          do{\n" +
  "            if(this.currentAudioBufferAvail==0){\n" +
  "              let nxtBuff=this.audioBuffers.shift();\n" +
  "              if(nxtBuff){\n" +
  "                this.currentAudioBuffer=nxtBuff;\n" +
  "                this.currentAudioBufferFramePos=0;\n" +
  "                this.currentAudioBufferAvail=this.currentAudioBuffer[0].length;\n" +
  "                //console.debug(\"Next buffer with \"+this.currentAudioBufferAvail+ \" frames\");\n" +
  "                this.port.postMessage({eventType:'bufferNotification',filledFrames:this.filledFrames});\n" +
  "              }else{\n" +
  "                if(this.endOfStream) {\n" +
  "                  this.ended = true;\n" +
  "                  this.port.postMessage({eventType: 'ended'});\n" +
  "                  //console.debug(\"Stream ended\");\n" +
  "                }else{\n" +
  "                  if(!this.stalled) {\n" +
  "                    this.stalled = true;\n" +
  "                    this.port.postMessage({eventType: 'stalled'});\n" +
  "                  }\n" +
  "                }\n" +
  "                break;\n" +
  "              }\n" +
  "            }\n" +
  "            //console.debug(\"outChLen: \"+outChLen+\", copied: \"+copied+\", current avail: \"+this.currentAudioBufferAvail);\n" +
  "            let toCopy=outChLen-copied;\n" +
  "            if(toCopy>this.currentAudioBufferAvail){\n" +
  "              toCopy=this.currentAudioBufferAvail;\n" +
  "            }\n" +
  "            //console.debug(\"Copy \"+toCopy+\" frames...\");\n" +
  "            for(let ch=0;ch<chs;ch++) {\n" +
  "              let outCh=output[ch];\n" +
  "              for (let i = 0; i < toCopy; i++) {\n" +
  "                outCh[copied+i]=this.currentAudioBuffer[ch][this.currentAudioBufferFramePos+i];\n" +
  "              }\n" +
  "            }\n" +
  "            copied+=toCopy;\n" +
  "            this.currentAudioBufferFramePos+=toCopy;\n" +
  "            this.currentAudioBufferAvail-=toCopy;\n" +
  "\n" +
  "          }while(copied<outChLen);\n" +
  "          this.filledFrames-=copied;\n" +
  "          //console.debug(\"Copied \"+copied+\" frames.\");\n" +
  "        }\n" +
  "     return !this.ended;\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "registerProcessor('audio-source-worklet',AudioSourceProcessor);\n";

export class AudioSourceWorkletModuleLoader{

  private static moduleLoaded=false;

  static loadModule(context: AudioContext): Promise<void> {
    return new Promise((resolve, reject) => {
      if (AudioSourceWorkletModuleLoader.moduleLoaded) {
        resolve.call(self);
      } else {
        const audioWorkletModuleBlob = new Blob([aswpStr], {type: 'text/javascript'});
        const audioWorkletModuleBlobUrl = window.URL.createObjectURL(audioWorkletModuleBlob);
        context.audioWorklet.addModule(audioWorkletModuleBlobUrl).then(() => {
          AudioSourceWorkletModuleLoader.moduleLoaded = true;
          resolve.call(self);
        }).catch((reason) => {
          console.error(reason);
          reject.call(reason);
        });

      }
    });
  }
}
