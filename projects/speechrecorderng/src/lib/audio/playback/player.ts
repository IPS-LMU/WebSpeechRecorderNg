import { Action } from '../../action/action'
import { AudioClip } from '../persistor'
import {ArrayAudioBuffer} from "../array_audio_buffer";
import {ArrayAudioBufferSourceNode} from "./array_audio_buffer_source_node";
import {IndexedDbAudioBuffer} from "../inddb_audio_buffer";
import {AudioSourceWorkletModuleLoader} from "./audio_source_worklet_module_loader";
import {IndexedDbAudioBufferSourceNode} from "./inddb_audio_buffer_source_node";
import {AudioSourceNode} from "./audio_source_node";
import {NetAudioBuffer} from "../net_audio_buffer";
import {NetAudioBufferSourceNode} from "./net_audio_buffer_source_node";
import {AudioBufferSource, AudioSource} from "../audio_data_holder";
import {AudioContextProvider} from "../context";



    export enum  EventType {CLOSED,READY,STARTED,POS_UPDATE, STOPPED, ENDED,ERROR}

    export class AudioPlayerEvent{

        private readonly _type:EventType;
        private readonly _timePosition:number | undefined;

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
        private readonly _startAction:Action<void>;
        private readonly _startSelectionAction:Action<void>;
        private readonly _autoPlayOnSelectToggleAction:Action<boolean>
        private readonly _stopAction:Action<void>;
        bufSize:number;
        context:AudioContext|null=null;
        ready=false;
        listener:AudioPlayerListener;
        _audioClip:AudioClip|null=null;
        private _audioSource:AudioSource|null=null;
        sourceBufferNode:AudioBufferSourceNode|null=null;
        sourceAudioWorkletNode:AudioSourceNode|null=null;

        buffPos:number;
        private zeroBufCnt:number;
        n:any;
        zb:Float32Array;
        private playStartTime:number|null=null;

        private timerVar:number|null=null;

        constructor(listener:AudioPlayerListener) {
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

        private _audioContext():AudioContext|null{
            if(!this.context){
                this.context=AudioContextProvider.audioContextInstance();
                if(this.context) {
                    this.context.addEventListener('statechange', (ev) => {
                            if(this.context && this.context.state!=='running'){
                                this.stop();
                            }
                        }
                    );
                }
            }
            return this.context;
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
          this._audioClip=audioClip
            let length = 0;
            let chs = 0;
            if (audioClip && audioClip.audioDataHolder) {
                let audioDataHolder=audioClip.audioDataHolder;
                chs = audioDataHolder.numberOfChannels
                if (chs > 0) {
                    length = audioDataHolder.frameLen;
                    //if (chs > this.context.destination.maxChannelCount) {
                    //    // TODO exception
                    //}
                }
                this.audioSource=audioDataHolder.audioSource;

                audioClip.addSelectionObserver((ac)=> {
                    this._startSelectionAction.disabled = this.startSelectionDisabled()
                    if (!this.startSelectionAction.disabled && this._autoPlayOnSelectToggleAction.value) {
                      this.startSelected()
                    }
                  }
                )
            }else{
                this.audioSource=null;
            }
        }

      get audioSource(): AudioSource | null {
        return this._audioSource;
      }

      set audioSource(value: AudioSource | null) {
        this.stop();
        this._audioSource = value;
            if (this._audioSource) {

                this.ready = true;
                this.updateStartActions();
                if (this.listener) {
                    this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
                }
            }else {
              this.ready = false;
              this.updateStartActions();
              if (this.listener) {
                this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
              }
            }
      }

        private _loadSourceWorkletAndInitStart(){
            if(this.context) {
                AudioSourceWorkletModuleLoader.loadModule(this.context).then(() => {
                    //console.debug("Player ready. ( by Player::_loadSourceWorkletAndInitStart()");
                    this.ready = true;
                    this.updateStartActions();
                    if (this.listener) {
                        this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.READY));
                    }
                }).catch((error: any) => {
                    this.ready = false;
                    this.updateStartActions();
                    if (this.listener) {
                        this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
                    }
                    console.error('Could not add module ' + error);
                });
            }
        }


  private _startAudioSourceWorkletNode(){
      this._loadSourceWorkletAndInitStart();
          if(this.context && this.sourceAudioWorkletNode) {
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

            this.sourceAudioWorkletNode.connect(this.context.destination); // this already starts playing
            this.sourceAudioWorkletNode.onended = () => this.onended();
            this.running = true;
            this.sourceAudioWorkletNode.start();
            //console.debug("Playback start action enabled. ( by Player::_startAudioSourceWorkletNode()");
            this._startAction.disabled = true;
            this._startSelectionAction.disabled = true
            this._stopAction.disabled = false;

            if (this.listener) {
              this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
            }
          }

  }

        start() {

            this._audioContext();

            if(this.context) {
                if (!this._startAction.disabled && !this.running) {
                    if (this.context.state === 'suspended') {
                        this.context.resume().then(() => {
                            this._start();
                        }).catch((reason) => {
                            console.error(reason.message());
                            throw reason;
                        })
                    } else if (this.context.state === 'closed') {
                        const msg = 'Error: Cannot start playback. Audio context is already closed!';
                        console.error(msg);
                        throw new Error(msg);
                    } else {
                        this._start();
                    }
                }
            }
        }

        updateStartActions(){

          if(this.ready){
            if(this._audioSource instanceof AudioBufferSource || this._audioSource instanceof ArrayAudioBuffer || this._audioSource instanceof IndexedDbAudioBuffer){
              this._startAction.disabled=false;
              this._startSelectionAction.disabled=this.startSelectionDisabled();
            }else{
              if(this._audioSource instanceof NetAudioBuffer){
                this._audioSource.addOnReadyListener(()=>{
                  this._startAction.disabled=false;
                  this._startSelectionAction.disabled=this.startSelectionDisabled();
                });
              }
            }
          }else{
            this._startAction.disabled=true;
            this._startSelectionAction.disabled=true;
          }
        }

        startSelectionDisabled(){
          return !(this._audioClip && this.context && !this.startAction.disabled && this._audioClip.selection )
        }


        private _start(playSelection=false){
                if(!this.context){
                    throw new Error("Could not get audio context!");
                }

          if (this._audioSource instanceof AudioBufferSource) {
            this.sourceBufferNode = this.context.createBufferSource();
            this.sourceBufferNode.buffer = this._audioSource.audioBuffer;
            this.sourceBufferNode.connect(this.context.destination);
            this.sourceBufferNode.onended = () => this.onended();
            this.playStartTime = this.context.currentTime;
            this.running = true;
            // unfortunately Web Audio API uses time values not frames
            const ac = this._audioClip
            let offset = 0;
            if (playSelection && ac && ac.selection) {

              const s = ac.selection;
              const sr = ac.audioDataHolder.sampleRate;
              offset = s.leftFrame / sr;
              const stopPosInsecs = s.rightFrame / sr;
              const dur = stopPosInsecs - offset;
              this.sourceBufferNode.start(0, offset, dur)
            } else {
              this.sourceBufferNode.start();
            }
            this.playStartTime = this.context.currentTime - offset;
            this._startAction.disabled = true;
            this._startSelectionAction.disabled = true
            this._stopAction.disabled = false;

            if (this.listener) {
              this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
            }
          } else if (this._audioSource instanceof ArrayAudioBuffer || this._audioSource instanceof IndexedDbAudioBuffer || this._audioSource instanceof NetAudioBuffer) {
              AudioSourceWorkletModuleLoader.loadModule(this.context).then(() => {
                  this.playStartTime = null;
                  if (this.context) {
                  if (this._audioSource instanceof ArrayAudioBuffer) {
                      const aabsn = new ArrayAudioBufferSourceNode(this.context);
                      aabsn.arrayAudioBuffer = this._audioSource;
                      this.sourceAudioWorkletNode = aabsn;
                  } else if (this._audioSource instanceof IndexedDbAudioBuffer) {
                      const iasn = new IndexedDbAudioBufferSourceNode(this.context);
                      iasn.inddbAudioBuffer = this._audioSource;
                      this.sourceAudioWorkletNode = iasn;
                  } else if (this._audioSource instanceof NetAudioBuffer) {
                      const nabsn = new NetAudioBufferSourceNode(this.context);
                      nabsn.netAudioBuffer = this._audioSource;
                      this.sourceAudioWorkletNode = nabsn;
                  }
                  if (this.sourceAudioWorkletNode) {
                      this.sourceAudioWorkletNode.onprocessorerror = (ev: Event) => {
                          let msg = 'Unknwon error';
                          if (ev instanceof ErrorEvent) {
                              msg = ev.message;
                          }
                          console.error("Audio source worklet error: " + msg);
                          if (this.listener) {
                              this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.ERROR));
                          }
                      };

                      this.sourceAudioWorkletNode.connect(this.context.destination); // this already starts playing
                      this.sourceAudioWorkletNode.onended = () => this.onended();

                      this.running = true;

                      const ac = this._audioClip
                      let offset = 0
                      if (playSelection && ac && ac.selection) {
                          const s = ac.selection;
                          const sr = ac.audioDataHolder.sampleRate;
                          offset = s.leftFrame / sr;
                          const stopPosInsecs = s.rightFrame / sr;
                          const dur = stopPosInsecs - offset
                          this.sourceAudioWorkletNode.start(0, offset, dur)
                      } else {
                          this.sourceAudioWorkletNode.start();
                      }

                      //this.playStartTime = this.context.currentTime - offset;
                      this._startAction.disabled = true;
                      this._startSelectionAction.disabled = true
                      this._stopAction.disabled = false;

                      if (this.listener) {
                          this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.STARTED));
                      }
                  }
              }
              }).catch((error: any) => {
                  console.error(error.message);
                  this.ready = false;
                  this.updateStartActions();
                  if (this.listener) {
                      this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.CLOSED));
                  }

                  throw error;
              });

          }
        }

      startSelected() {
          if(!this.context){
              this.context=AudioContextProvider.audioContextInstance();
          }

          if(!this.context){
              throw new Error("Could not get audio context!");
          }

          if(!this._startAction.disabled && !this.running) {
          if (this.context.state === 'suspended') {
            this.context.resume().then(() => {
              this._start(true);
            }).catch((reason) => {
              console.error(reason.message);
              throw reason;
            })
          }else if(this.context.state==='closed'){
            const msg='Error: Cannot start playback of selection. Audio context is already closed!';
            console.error(msg);
            throw new Error(msg);
          }else{
            this._start(true);
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
            this._startAction.disabled = !this._audioSource;
            this._startSelectionAction.disabled=this.startSelectionDisabled()
            this._stopAction.disabled = true;
            this.running=false;
            if (this.listener) {
                this.listener.audioPlayerUpdate(new AudioPlayerEvent(EventType.ENDED));
            }
        }

        get playPositionTime():number|null {
            let ppt=null;
            if(this.context && this.playStartTime!==null) {
                ppt= this.context.currentTime - this.playStartTime;
            }else if(this.sourceAudioWorkletNode){
              ppt=this.sourceAudioWorkletNode.playPositionTime;
            }
            return ppt;
        }

      get playPositionFrames():number|null {
        let ppFrs:number|null=null;
       if(this._audioSource) {
         let sr=this._audioSource.sampleRate;
         if (sr) {
           let ppTime = this.playPositionTime;
           if (ppTime !== null) {
             ppFrs = sr * ppTime;
           }
         }
       }
        return ppFrs;
      }

    }

