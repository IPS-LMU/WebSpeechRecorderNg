import { Action } from '../../action/action'
import { AudioClip } from '../persistor'
import {ArrayAudioBuffer} from "../array_audio_buffer";
import {ArrayAudioBufferSourceNode, AudioSourceWorkletModuleLoader} from "./array_audio_buffer_source_node";



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
        sourceAudioWorkletNode:ArrayAudioBufferSourceNode|null=null;
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
                chs = audioDataHolder.numberOfChannels
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

          AudioSourceWorkletModuleLoader.loadModule(this.context).then(()=>{

          this._startAction.disabled = false;
          this._startSelectionAction.disabled=this.startSelectionDisabled()
          if(this.listener){
            this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
          }
          }).catch((error: any)=>{
            this._startAction.disabled = true;
            this._startSelectionAction.disabled=true
            if(this.listener){
              this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
            }
          console.log('Could not add module '+error);
        });
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
                  if(this._arrayAudioBuffer) {
                      this.sourceAudioWorkletNode=new ArrayAudioBufferSourceNode(this.context);
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
                      };
                      this.sourceAudioWorkletNode.arrayAudioBuffer=this._arrayAudioBuffer;
                      this.sourceAudioWorkletNode.connect(this.context.destination); // this already starts playing
                      this.sourceAudioWorkletNode.onended = () => this.onended();

                      this.playStartTime = this.context.currentTime;
                      this.running = true;

                      this.sourceAudioWorkletNode.start();
                      this.playStartTime = this.context.currentTime;
                      this._startAction.disabled = true;
                      this._startSelectionAction.disabled=true
                      this._stopAction.disabled = false;

                      if (this.listener) {
                        this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                      }


                  }
                }
            }
        }

        startSelectionDisabled(){
          return !(this._audioClip && this.context && !this.startAction.disabled && this._audioClip.selection )
        }

      startSelected() {
        if(!this._startAction.disabled && !this.running) {
          this.context.resume();
          if (this._audioBuffer) {
            this.sourceBufferNode = this.context.createBufferSource();
            this.sourceBufferNode.buffer = this._audioBuffer;
            this.sourceBufferNode.connect(this.context.destination);
            this.sourceBufferNode.onended = () => this.onended();

            this.playStartTime = this.context.currentTime;
            this.running = true;
            // unfortunately Web Audio API uses time values not frames
            let ac = this._audioClip
            let offset = 0
            if (ac && ac.selection) {
              let s = ac.selection;
              let sr = ac.audioDataHolder.sampleRate;
              offset = s.leftFrame / sr;
              let stopPosInsecs = s.rightFrame / sr;
              let dur = stopPosInsecs - offset
              // TODO check valid values
              this.sourceBufferNode.start(0, offset, dur)

            } else {
              this.sourceBufferNode.start();
            }
            this.playStartTime = this.context.currentTime - offset;
            this._startAction.disabled = true;
            this._startSelectionAction.disabled = true
            this._stopAction.disabled = false;
            //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
            if (this.listener) {
              this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
            }
          }else if(this._arrayAudioBuffer){
            if(this._arrayAudioBuffer) {
              let aabsn=new ArrayAudioBufferSourceNode(this.context);
                this.sourceAudioWorkletNode=aabsn;
                aabsn.onprocessorerror = (ev: Event) => {
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
                };
                aabsn.arrayAudioBuffer=this._arrayAudioBuffer;
                aabsn.connect(this.context.destination); // this already starts playing
                aabsn.onended = () => this.onended();

                this.playStartTime = this.context.currentTime;
                this.running = true;

                let ac = this._audioClip
                let offset = 0
                if (ac && ac.selection) {
                  let s = ac.selection;
                  let sr = ac.audioDataHolder.sampleRate;
                  offset = s.leftFrame / sr;
                  let stopPosInsecs = s.rightFrame / sr;
                  let dur = stopPosInsecs - offset
                  // TODO check valid values
                  aabsn.start(0, offset, dur)

                } else {
                  aabsn.start();
                }
                this.playStartTime = this.context.currentTime - offset;
                this._startAction.disabled = true;
                this._startSelectionAction.disabled=true
                this._stopAction.disabled = false;

                if (this.listener) {
                  this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                }
            }
          }
        }
        }

        stop(){
            if(this.running) {
                if (this.sourceBufferNode) {
                    this.sourceBufferNode.stop();
                }
                if(this.sourceAudioWorkletNode){
                  this.sourceAudioWorkletNode.stop();
                }
                  if (this.timerVar !== null) {
                    window.clearInterval(this.timerVar);
                  }
                  this.running = false;
                  if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STOPPED));
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
        let sr:number|null=null;
        if(this._audioBuffer ) {
          sr=this._audioBuffer.sampleRate;
        }else if(this._arrayAudioBuffer){
          sr=this._arrayAudioBuffer.sampleRate;
        }
        if(sr ) {
          let ppTime = this.playPositionTime;
          if(ppTime!==null) {
            ppFrs = sr * ppTime;
          }
        }
        return ppFrs;
      }

    }

