import { Action } from '../../action/action'
import { AudioClip } from '../persistor'

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
        sourceBufferNode:AudioBufferSourceNode|null=null;
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
        this._audioClip=audioClip;
        let length = 0;
        let chs = 0;
        if (audioClip && audioClip.buffer) {
          chs = audioClip.buffer.numberOfChannels;
          if (chs > 0) {
            length = audioClip.buffer.length;
            if (chs > this.context.destination.maxChannelCount) {
              // TODO exception
            }
          }
          this.audioBuffer = audioClip.buffer;
          audioClip.addSelectionObserver((ac)=> {
              this._startSelectionAction.disabled = this.startSelectionDisabled()
              if (!this.startSelectionAction.disabled && this._autoPlayOnSelectToggleAction.value) {
                this.startSelected()
              }
            }
          )
        }else{
          this.audioBuffer=null;
        }
      }

        set audioBuffer(audioBuffer:AudioBuffer | null) {
            this.stop();
            this._audioBuffer = audioBuffer;
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

        start() {
            if(!this._startAction.disabled && !this.running) {
                this.context.resume();
                this.sourceBufferNode = this.context.createBufferSource();
                this.sourceBufferNode.buffer = this._audioBuffer;
                this.sourceBufferNode.connect(this.context.destination);
                this.sourceBufferNode.onended = () => this.onended();

                this.playStartTime = this.context.currentTime;
                this.running=true;
                this.sourceBufferNode.start();

                this.playStartTime = this.context.currentTime;
                this._startAction.disabled = true;
                this._startSelectionAction.disabled=true
                this._stopAction.disabled = false;
                //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
                if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
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
            let s=ac.selection
            let sr=ac.buffer.sampleRate
            offset=s.leftFrame/sr
            let stopPosInsecs=s.rightFrame/sr
          let dur=stopPosInsecs-offset
            // TODO check valid values
            this.sourceBufferNode.start(0,offset,dur)
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
                if(this.timerVar!==null) {
                    window.clearInterval(this.timerVar);
                }
                this.running=false;
                if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STOPPED));
                }
            }

        }

        onended() {
            if(this.timerVar!=null) {
                window.clearInterval(this.timerVar);
            }
            this._startAction.disabled = !(this.audioBuffer);
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

