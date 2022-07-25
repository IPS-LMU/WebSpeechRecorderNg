import {ArrayAudioBuffer} from "../array_audio_buffer";
import {ArrayAudioBufferInputStream} from "../array_audio_buffer_input_stream";
import {EditFloat32ArrayInputStream, Float32ArrayInputStream} from "../../io/stream";

// Code from audio_source_worklet.js as string constant to be loaded as module
// Changes in audio_source_worklet.js must be copied and pasted to this string constant

const aswpStr = "\n" +
  "// Important note: Changes in audio_source_worklet.js must be copied and pasted to the string constant aswpStr in array_audio_buffer_source_node.ts\n" +
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
  "              // clear buffers\n" +
  "              this.filledFrames=0;\n" +
  "              while(this.audioBuffers.length > 0) {\n" +
  "                this.audioBuffers.pop();\n" +
  "              }\n" +
  "              this.currentAudioBuffer=new Float32Array(0);\n" +
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
  "                this.ended=true;\n" +
  "                this.port.postMessage({eventType:'ended'});\n" +
  "                //console.debug(\"Stream ended\");\n" +
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


export class ArrayAudioBufferSourceNode extends AudioWorkletNode {

  static readonly QUANTUM_FRAME_LEN = 128;
  static readonly DEFAULT_BUFFER_FILL_SECONDS = 10;
  private _bufferFillSeconds = ArrayAudioBufferSourceNode.DEFAULT_BUFFER_FILL_SECONDS;
  private bufferFillFrames = 0;
  private _arrayAudioBuffer: ArrayAudioBuffer | null = null;
  private _audioInputStream:Float32ArrayInputStream|null=null;
  private _aisBufs:Float32Array[]|null=null;

  private filledFrames = 0;
  onended: (() => void) | null = null;

  constructor(context: AudioContext) {

    super(context, 'audio-source-worklet');
    this.channelCountMode = 'explicit';
    this.port.onmessage = (msgEv: MessageEvent) => {
      if (msgEv.data) {
        let evType = msgEv.data.eventType;
        if (evType) {
          if ('bufferNotification' === evType) {
            this.filledFrames = msgEv.data.filledFrames;
            //console.debug("Buffer notification: filled frames: " + this.filledFrames);
            this.fillBuffer();
          } else if ('ended' === evType) {
            let drainTime = 0;
            if (this._arrayAudioBuffer?.sampleRate) {
              drainTime = ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN / this._arrayAudioBuffer.sampleRate;
            }
            //let dstAny:any=this.context.destination;
            //console.debug('Destination node tail-time: '+dstAny['tail-time']);
            window.setTimeout(() => {
              this.onended?.call(this);
            }, drainTime * 1000);

          }
        }
      }
    }
  }

  private fillBuffer(frameOffset?:number) {
    if (this._arrayAudioBuffer && this._audioInputStream && this._aisBufs) {
      let filled = this.filledFrames;
      let bufLen = 0;

      while(filled< this.bufferFillFrames) {
        let read = this._audioInputStream.read(this._aisBufs);
        //console.log("ArrayAudioBufferSourceNode: read: "+read)
        if (read) {
          let trBuffers = new Array<any>(this.channelCount);
          for (let ch = 0; ch < this.channelCount; ch++) {
            let adCh = this._aisBufs[ch];
            let adChCopy = new Float32Array(adCh.length);
            bufLen = adChCopy.length;
            adChCopy.set(adCh);
            trBuffers[ch] = adChCopy.buffer;
          }
          this.port.postMessage({
            cmd: 'data',
            chs: this.channelCount,
            audioData: trBuffers
          }, trBuffers);
          filled+=read;
        }else{
          break;
        }
      }

    }
  }

  get arrayAudioBuffer(): ArrayAudioBuffer | null {
    return this._arrayAudioBuffer;
  }

  set arrayAudioBuffer(value: ArrayAudioBuffer | null) {
    this._arrayAudioBuffer = value;
    if (this._arrayAudioBuffer?.channelCount) {
      this.channelCount = this._arrayAudioBuffer?.channelCount;
      this.bufferFillFrames = this._arrayAudioBuffer.sampleRate * this._bufferFillSeconds;
    }
  }

  get bufferFillSeconds(): number {
    return this._bufferFillSeconds;
  }

  set bufferFillSeconds(value: number) {
    this._bufferFillSeconds = value;
  }

  start(when?: number | undefined,offset?: number | undefined,duration?: number | undefined): void {
    if (when) {
      throw Error("when, offest,duration parameters currently not supported by ArrayAudioBufferSourceNode class")
    }

    if (this._arrayAudioBuffer) {
      let arrAis=new ArrayAudioBufferInputStream(this._arrayAudioBuffer);
      if(offset===undefined && duration===undefined){
        this._audioInputStream = arrAis;
      }else{
        let offsetFrames=0;
        let durationFrames=undefined;
        if(offset!==undefined) {
          offsetFrames=Math.floor(offset * this._arrayAudioBuffer.sampleRate);
        }
        if(duration!==undefined){
          durationFrames=Math.floor(duration * this._arrayAudioBuffer.sampleRate);
        }
        this._audioInputStream=new EditFloat32ArrayInputStream(arrAis,offsetFrames,durationFrames);
      }

    let chs=this._arrayAudioBuffer.channelCount;
    this._aisBufs=new Array<Float32Array>(chs);
    for(let ch=0;ch<chs;ch++){
      this._aisBufs[ch]=new Float32Array(1024);
    }

    this.fillBuffer();
    this.port.postMessage({cmd: 'start'});
  }
  }

  stop() {
    this.port.postMessage({cmd: 'stop'});
    this.onended?.call(this);
  }

}

export class AudioSourceWorkletModuleLoader{
  private static moduleLoaded=false;
  static loadModule(context: AudioContext): Promise<void> {
    return new Promise((resolve, reject) => {
      if (AudioSourceWorkletModuleLoader.moduleLoaded) {
        resolve.call(self);
      } else {
        let audioWorkletModuleBlob = new Blob([aswpStr], {type: 'text/javascript'});
        let audioWorkletModuleBlobUrl = window.URL.createObjectURL(audioWorkletModuleBlob);
        context.resume();
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
