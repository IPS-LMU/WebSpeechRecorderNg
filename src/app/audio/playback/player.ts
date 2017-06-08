import { Action } from '../../action/action'
import { AudioClip } from '../persistor'

    export enum  EventType {STARTED, POS_UPDATE, STOPPED, ENDED}
    export class AudioPlayerEvent{

        private _type:EventType;
        private _timePosition:number;

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
        update(e:AudioPlayerEvent);
    }


    export class AudioPlayer {
        public static DEFAULT_BUFSIZE:number = 8192;
        private _startAction:Action;
        private _stopAction:Action;
        bufSize:number;
        context:AudioContext;
        // _audioClip:ips.audio.AudioClip;
        listener:AudioPlayerListener;
        stream:MediaStream;
        _audioBuffer:AudioBuffer;
        sourceBufferNode:AudioBufferSourceNode;
        bufferingNode:ScriptProcessorNode;
        buffPos:number;
        private zeroBufCnt:number;
        //data:Array<Float32Array>;

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

        set audioBuffer(audioBuffer:AudioBuffer) {
            this._audioBuffer = audioBuffer;
            if (audioBuffer) {
                this._startAction.disabled = false;
            }
        }

        start() {
            this.sourceBufferNode = this.context.createBufferSource();
            this.sourceBufferNode.buffer = this._audioBuffer;
            this.sourceBufferNode.connect(this.context.destination);
            this.sourceBufferNode.onended = ()=>this.onended();

            this.playStartTime = this.context.currentTime;
            this.sourceBufferNode.start();

            this.playStartTime = this.context.currentTime;
            this._startAction.disabled = true;
            this._stopAction.disabled = false;
            //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
            if(this.listener){
                this.listener.update(new AudioPlayerEvent(EventType.STARTED));
            }

        }

        // updatePlayPosition() {
        //     var pp = this.context.currentTime - this.playStartTime;
        //     console.log("Play position: " + pp);
        // }

        stop(){
            if (this.sourceBufferNode) {
                this.sourceBufferNode.stop();
            }
            window.clearInterval(this.timerVar);
        }

        onended() {
            window.clearInterval(this.timerVar);
            this._startAction.disabled = false;
            console.log("On ended enbled start action")
            this._stopAction.disabled = true;
            if (this.listener) {
                this.listener.update(new AudioPlayerEvent(EventType.ENDED));
                console.log("On ended listener updated")
            }
        }

        get playPositionTime() {

            return this.context.currentTime - this.playStartTime;
        }

        get playPositionFrames() {
            var ppTime = this.playPositionTime;
            return this._audioBuffer.sampleRate * ppTime;

        }

    }

