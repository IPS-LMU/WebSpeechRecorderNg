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
        public static DEFAULT_BUFSIZE:number = 8192;
        private running=false;
        private _startAction:Action;
        private _stopAction:Action;
        bufSize:number;
        context:AudioContext;
        listener:AudioPlayerListener;
        _audioBuffer:AudioBuffer | null;
        sourceBufferNode:AudioBufferSourceNode;
        buffPos:number;
        private zeroBufCnt:number;
        n:any;
        zb:Float32Array;
        private playStartTime:number;

        private timerVar:number;

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
            this._stopAction = new Action('Stop');
            this._stopAction.disabled = true;
            this._stopAction.onAction = ()=>this.stop();
        }

        get startAction() {
            return this._startAction;
        }

        get stopAction() {
            return this._stopAction;
        }

        set audioClip(audioClip:AudioClip) {

            var length = 0;
            var chs = 0;
            if (audioClip.buffer) {
                chs = audioClip.buffer.numberOfChannels;
                if (chs > 0) {
                    length = audioClip.buffer.length;
                    if (chs > this.context.destination.maxChannelCount) {
                        // TODO exception
                    }
                }
            }

            this.audioBuffer = audioClip.buffer;
        }

        set audioBuffer(audioBuffer:AudioBuffer | null) {
            this.stop();
            this._audioBuffer = audioBuffer;
            if (audioBuffer && this.context) {
                this._startAction.disabled = false;
                if(this.listener){
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
                }
            }else{
                this._startAction.disabled = true;
                if(this.listener){
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
                }
            }
        }
        get audioBuffer():AudioBuffer{
            return this._audioBuffer;
        }

        start() {
            if(!this._startAction.disabled && !this.running) {
                this.sourceBufferNode = this.context.createBufferSource();
                this.sourceBufferNode.buffer = this._audioBuffer;
                this.sourceBufferNode.connect(this.context.destination);
                this.sourceBufferNode.onended = () => this.onended();

                this.playStartTime = this.context.currentTime;
                this.running=true;
                this.sourceBufferNode.start();

                this.playStartTime = this.context.currentTime;
                this._startAction.disabled = true;
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
                window.clearInterval(this.timerVar);
                this.running=false;
                if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STOPPED));
                }
            }

        }

        onended() {
            window.clearInterval(this.timerVar);

            this._startAction.disabled = !(this.audioBuffer);
            this._stopAction.disabled = true;
            this.running=false;
            if (this.listener) {
                this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.ENDED));
            }
        }

        get playPositionTime() {

            return this.context.currentTime - this.playStartTime;
        }

        get playPositionFrames() {
          if(this._audioBuffer) {
            var ppTime = this.playPositionTime;
            return this._audioBuffer.sampleRate * ppTime;
          }
        }

    }

