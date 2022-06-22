import { Action } from '../../action/action'
import { AudioClip } from '../persistor'
import {ArrayAudioBuffer} from "../array_audio_buffer";

const aswpStr="class AudioSourceProcessor extends AudioWorkletProcessor{\n" +
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
  "\n" +
  "    constructor() {\n" +
  "        super();\n" +
  "        this.port.onmessage=(msgEv)=>{\n" +
  "          // received audio playback data from application\n" +
  "          console.debug(\"Audio source worklet msg: Received.\");\n" +
  "          if(msgEv.data['audioData']) {\n" +
  "              let chs = msgEv.data.chs;\n" +
  "              if(!this.ringBuffers){\n" +
  "                this.ringBuffers=new Array(chs);\n" +
  "                for (let ch = 0; ch < chs; ch++) {\n" +
  "                  this.ringBuffers[ch]=new Float32Array(this.RING_BUFFER_FRAMES);\n" +
  "                  this.ringBufferPos=0;\n" +
  "                  this.ringBufferFilled=0;\n" +
  "                  this.ringBufferFree=this.RING_BUFFER_FRAMES;\n" +
  "                }\n" +
  "              }\n" +
  "              for (let ch = 0; ch < chs; ch++) {\n" +
  "                let msgChBuf=msgEv.data['audioData'][ch];\n" +
  "                let msgChBufLen=msgChBuf.length;\n" +
  "                let rbFree=this.RING_BUFFER_FRAMES-this.ringBufferFilled;\n" +
  "                if(msgChBufLen>this.ringBufferFree){\n" +
  "                  console.error('Not enough space in ring buffer');\n" +
  "                  // TODO\n" +
  "                }else{\n" +
  "                  console.debug(\"Audio source worklet msg: Fill \"+msgChBufLen+\" frames...\");\n" +
  "                  let copied=0;\n" +
  "                  let free1=this.RING_BUFFER_FRAMES-this.ringBufferPos+this.ringBufferFilled;\n" +
  "                  let toCopy1=msgChBufLen;\n" +
  "                  if(toCopy1>free1){\n" +
  "                    toCopy1=free1;\n" +
  "                  }\n" +
  "                  for(let ci=0;ci<toCopy1;ci++){\n" +
  "                    this.ringBuffers[ch][this.ringBufferPos+ci]=msgChBuf[copied+ci];\n" +
  "                  }\n" +
  "                  copied+=free1;\n" +
  "\n" +
  "                  if(copied<msgChBufLen){\n" +
  "                    let free2=this.ringBufferPos;\n" +
  "                    let toCopy2=msgChBufLen-copied;\n" +
  "                    for(let ci=0;ci<toCopy2;ci++){\n" +
  "                      this.ringBuffers[ch][0+ci]=msgChBuf[copied+ci];\n" +
  "                    }\n" +
  "                  }\n" +
  "                }\n" +
  "                this.ringBufferFilled+=msgChBufLen;\n" +
  "                console.debug(\"Audio source worklet msg: Ring buffer filled \"+this.ringBufferFilled);\n" +
  "              }\n" +
  "\n" +
  "            }else{\n" +
  "            console.debug(\"Audio source worklet msg: No data !.\");\n" +
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
  "\n" +
  "      for(let oi=0;oi<outputs.length;oi++){\n" +
  "        let output=outputs[oi];\n" +
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
  "            console.debug(\"Audio source worklet: Created ring buffers \");\n" +
  "          }\n" +
  "          let outCh = output[0];\n" +
  "          let outChLen = outCh.length;\n" +
  "          let copy1 = outChLen;\n" +
  "          let avail1 = this.ringBufferFilled;\n" +
  "          if (this.ringBufferPos + this.ringBufferFilled > this.RING_BUFFER_FRAMES) {\n" +
  "            avail1 = this.RING_BUFFER_FRAMES - this.ringBufferPos;\n" +
  "          }\n" +
  "          if (copy1 > avail1) {\n" +
  "            copy1 = avail1;\n" +
  "          }\n" +
  "          let copied = 0;\n" +
  "          for (let ci = 0; ci < copy1; ci++) {\n" +
  "            for (let ch = 0; ch < output.length; ch++) {\n" +
  "              let outCh = output[ch];\n" +
  "              outCh[ci] = this.ringBuffers[ch][this.ringBufferPos + ci];\n" +
  "            }\n" +
  "          }\n" +
  "          copied += copy1;\n" +
  "          let copy2 = outChLen - copied;\n" +
  "          for (let ci = 0; ci < copy2; ci++) {\n" +
  "            for (let ch = 0; ch < output.length; ch++) {\n" +
  "              let outCh = output[ch];\n" +
  "              outCh[copied + ci] = this.ringBuffers[ch][ci];\n" +
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
  "        }\n" +
  "      }\n" +
  "     return true;\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "registerProcessor('audio-source-worklet',AudioSourceProcessor);\n";

    export enum  EventType {CLOSED,READY,STARTED,POS_UPDATE, STOPPED, ENDED}

    export class AudioPlayerEvent{

        private _type:EventType;
        private _timePosition:number | undefined;

        constructor(type:EventType, timePosition?:number) {
            this._type = type;
            this._timePosition = timePosition;
        }

        get type() {
            return this._type;
        }

        get timePosition() {
            return this._timePosition;
        }
    }
    export interface AudioPlayerListener {
        audioPlayerUpdate(e:AudioPlayerEvent):void;
    }

    export class AudioPlayer {
        get autoPlayOnSelectToggleAction(): Action<boolean> {
            return this._autoPlayOnSelectToggleAction;
        }
        public static DEFAULT_BUFSIZE:number = 8192;
        private running=false;
        private _startAction:Action<void>;
      private _startSelectionAction:Action<void>;
        private _autoPlayOnSelectToggleAction:Action<boolean>
        private _stopAction:Action<void>;
        bufSize:number;
        context:AudioContext;
        listener:AudioPlayerListener;
        _audioClip:AudioClip|null=null;
        _audioBuffer:AudioBuffer | null=null;
        _arrayAudioBuffer:ArrayAudioBuffer|null=null;
        sourceBufferNode:AudioBufferSourceNode|null=null;
        sourceAudioWorkletNode:AudioWorkletNode|null=null;
        buffPos:number;
        private zeroBufCnt:number;
        n:any;
        zb:Float32Array;
        private playStartTime:number|null=null;

        private timerVar:number|null=null;

        constructor(context:AudioContext, listener:AudioPlayerListener) {
           this.context=context;
            this.listener=listener;
            this.bufSize = AudioPlayer.DEFAULT_BUFSIZE;
            this.n=navigator;
            this.buffPos=0;
            this.zeroBufCnt=0;
            this.zb = new Float32Array(this.bufSize);
            this._startAction = new Action('Start');
            this._startAction.disabled = true;
            this._startAction.onAction = ()=>this.start();
            this._startSelectionAction=new Action('Start selected')
            this._startSelectionAction.disabled=true
            this._startSelectionAction.onAction = ()=>this.startSelected();
            this._autoPlayOnSelectToggleAction=new Action<boolean>("Autoplay on select",false);
            this._stopAction = new Action('Stop');
            this._stopAction.disabled = true;
            this._stopAction.onAction = ()=>this.stop();
        }

        get startAction() {
            return this._startAction;
        }

        get startSelectionAction(){
          return this._startSelectionAction
        }

        get stopAction() {
            return this._stopAction;
        }

        set audioClip(audioClip:AudioClip| null) {

            let length = 0;
            let chs = 0;
            if (audioClip && audioClip.audioDataHolder) {
                let audioDataHolder=audioClip.audioDataHolder;
                chs = audioDataHolder.channelCount
                if (chs > 0) {
                    length = audioDataHolder.frameLen;
                    if (chs > this.context.destination.maxChannelCount) {
                        // TODO exception
                    }
                }
                if(audioDataHolder.buffer){
                  this.audioBuffer = audioDataHolder.buffer;
                }
                if(audioDataHolder.arrayBuffer) {
                  this.arrayAudioBuffer = audioDataHolder.arrayBuffer;
                }

                audioClip.addSelectionObserver((ac)=> {
                    this._startSelectionAction.disabled = this.startSelectionDisabled()
                    if (!this.startSelectionAction.disabled && this._autoPlayOnSelectToggleAction.value) {
                      this.startSelected()
                    }
                  }
                )
            }else{
                this.audioBuffer=null;
                //this.arrayAudioBuffer=null;
            }
          this._audioClip=audioClip

        }

        set audioBuffer(audioBuffer:AudioBuffer | null) {
            this.stop();
            this._audioBuffer = audioBuffer;
            this._arrayAudioBuffer=null;
            if (audioBuffer && this.context) {
                this._startAction.disabled = false;
                this._startSelectionAction.disabled=this.startSelectionDisabled()
                if(this.listener){
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
                }
            }else{
                this._startAction.disabled = true;
                this._startSelectionAction.disabled=true
                if(this.listener){
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
                }
            }
        }
        get audioBuffer():AudioBuffer| null{
            return this._audioBuffer;
        }

      set arrayAudioBuffer(arrayAudioBuffer:ArrayAudioBuffer | null) {
        this.stop();
        this._audioBuffer=null;
        this._arrayAudioBuffer=arrayAudioBuffer;
        if (arrayAudioBuffer && this.context) {
          this._startAction.disabled = false;
          this._startSelectionAction.disabled=this.startSelectionDisabled()
          if(this.listener){
            this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
          }
        }else{
          this._startAction.disabled = true;
          this._startSelectionAction.disabled=true
          if(this.listener){
            this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
          }
        }
      }

      get arrayAudioBuffer():ArrayAudioBuffer| null{
        return this._arrayAudioBuffer;
      }
        start() {
            if(!this._startAction.disabled && !this.running) {
                this.context.resume();

                if(this._audioBuffer) {
                  this.sourceBufferNode = this.context.createBufferSource();
                  this.sourceBufferNode.buffer = this._audioBuffer;
                  this.sourceBufferNode.connect(this.context.destination);
                  this.sourceBufferNode.onended = () => this.onended();

                  this.playStartTime = this.context.currentTime;
                  this.running = true;
                  this.sourceBufferNode.start();
                  this.playStartTime = this.context.currentTime;
                  this._startAction.disabled = true;
                  this._startSelectionAction.disabled=true
                  this._stopAction.disabled = false;
                  //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
                  if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                  }
                }else if(this._arrayAudioBuffer){
                  let audioWorkletModuleBlob= new Blob([aswpStr], {type: 'text/javascript'});

                  let audioWorkletModuleBlobUrl=window.URL.createObjectURL(audioWorkletModuleBlob);

                  this.context.audioWorklet.addModule(audioWorkletModuleBlobUrl).then(()=> {
                    this.sourceAudioWorkletNode = new AudioWorkletNode(this.context, 'audio-source-worklet');
                    this.sourceAudioWorkletNode.onprocessorerror = (ev: Event) => {
                      let msg = 'Unknwon error';
                      if (ev instanceof ErrorEvent) {
                        msg = ev.message;
                      }
                      console.error("Audio source worklet error: " + msg);
                      if (this.listener) {
                        // TODO
                        // this.listener.error(msg);
                        // this.listener.audioPlayerUpdate(new AudioPlayerEvent());
                      }
                    }
                    let awnPt = this.sourceAudioWorkletNode.port;
                    if (awnPt) {
                      awnPt.onmessage = (ev: MessageEvent<any>) => {
                        let dt = ev.data;
                        //let chs = dt.chs;
                        //let adaLen = dt.data.length;
                      }
                    }
                    if(this._arrayAudioBuffer) {

                      let chs = this._arrayAudioBuffer.channelCount;
                      // TODO fills all buffers for testing now
                      for(let chi=0;chi<this._arrayAudioBuffer.chunkCount;chi++) {
                        let trBuffers = new Array<ArrayBufferLike>(chs);
                        for (let ch = 0; ch < chs; ch++) {
                          trBuffers[ch] = this._arrayAudioBuffer.data[ch][chi].buffer;
                        }

                        awnPt.postMessage({
                          chs: this._arrayAudioBuffer?.channelCount,
                          audioData: trBuffers
                        }, trBuffers);
                      }
                    }

                    this.sourceAudioWorkletNode.connect(this.context.destination); // this already starts playing
                    // TODO onended event ??
                    //awn.onended = () => this.onended();

                    this.playStartTime = this.context.currentTime;
                    this.running = true;
                    // TODO HowTo start the node ??

                    //awn.start();
                    this.playStartTime = this.context.currentTime;
                    this._startAction.disabled = true;
                    this._startSelectionAction.disabled=true
                    this._stopAction.disabled = false;

                    if (this.listener) {
                      this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                    }

                      }).catch((error: any)=>{
                    console.log('Could not add module '+error);
                  });
                }

            }
        }

        startSelectionDisabled(){
          return !(this._audioClip && this.context && !this.startAction.disabled && this._audioClip.selection )
        }

      startSelected() {
        if(!this._startAction.disabled && !this.running) {
          this.context.resume();
          this.sourceBufferNode = this.context.createBufferSource();

          this.sourceBufferNode.buffer = this._audioBuffer;
          this.sourceBufferNode.connect(this.context.destination);
          this.sourceBufferNode.onended = () => this.onended();

          this.playStartTime = this.context.currentTime;
          this.running=true;
          // unfortunately Web Audio API uses time values not frames
          let ac=this._audioClip
          let offset=0
          if(ac && ac.selection){
            let s=ac.selection;
            let sr=ac.audioDataHolder.sampleRate;
            offset = s.leftFrame / sr;
            let stopPosInsecs = s.rightFrame / sr;
            let dur = stopPosInsecs - offset
            // TODO check valid values
            this.sourceBufferNode.start(0, offset, dur)

          }else {
            this.sourceBufferNode.start();
          }
          this.playStartTime = this.context.currentTime-offset;
          this._startAction.disabled = true;
          this._startSelectionAction.disabled=true
                this._stopAction.disabled = false;
                //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
                if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                }
            }
        }

        stop(){
            if(this.running) {
                if (this.sourceBufferNode) {
                    this.sourceBufferNode.stop();
                }
                if(this.sourceAudioWorkletNode){
                  this.sourceAudioWorkletNode.disconnect();
                  if(this.timerVar!==null) {
                    window.clearInterval(this.timerVar);
                  }
                  this.running=false;
                  if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STOPPED));
                    // TODO Test only , should be called by the node
                    this.onended();
                  }
                }else {
                  if (this.timerVar !== null) {
                    window.clearInterval(this.timerVar);
                  }
                  this.running = false;
                  if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STOPPED));
                  }
                }
            }

        }

        onended() {
            if(this.timerVar!=null) {
                window.clearInterval(this.timerVar);
            }
            this._startAction.disabled = !(this.audioBuffer || this.arrayAudioBuffer);
            this._startSelectionAction.disabled=this.startSelectionDisabled()
            this._stopAction.disabled = true;
            this.running=false;
            if (this.listener) {
                this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.ENDED));
            }
        }

        get playPositionTime():number|null {
            let ppt=null;
            if(this.playStartTime!==null) {
                ppt= this.context.currentTime - this.playStartTime;
            }
            return ppt;
        }

        get playPositionFrames():number|null {
            let ppFrs:number|null=null;
            if(this._audioBuffer ) {
                let ppTime = this.playPositionTime;
                if(ppTime!==null) {
                    ppFrs = this._audioBuffer.sampleRate * ppTime;
                }
            }
            return ppFrs;
        }

    }

