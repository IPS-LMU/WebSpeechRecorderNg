import {SequenceAudioFloat32OutStream, SequenceAudioFloat32OutStreamMultiplier} from "../io/stream";
import {Browser, Platform, UserAgentBuilder} from "../../utils/ua-parser";

import {AutoGainControlConfig, Platform as CfgPlatform} from "../../speechrecorder/project/project";
import {ArrayAudioBuffer} from "../array_audio_buffer";
import {SprDb} from "../../db/inddb";
import {UUID} from "../../utils/utils";
import {Observable, Subscriber} from "rxjs";
import {IndexedDbAudioBuffer, PersistentAudioStorageTarget} from "../inddb_audio_buffer";



export const CHROME_ACTIVATE_ECHO_CANCELLATION_WITH_AGC=false;

const DEBUG_TRACE_LEVEL=0;

const ENABLE_AUDIO_WORKLET=true;

// Super dirty way to load this module
// Copy content of interceptor_worklet.js to this string
const awpStr="class AudioCaptureInterceptorProcessor extends AudioWorkletProcessor{\n" +
    "\n" +
    "    BUFFER_QUANTUMS=64;\n" +
    "    QUANTUM_FRAME_LEN=128;\n" +
    "    BUFFER_FRAME_LEN=this.QUANTUM_FRAME_LEN*this.BUFFER_QUANTUMS;\n" +
    "    buffer=null;\n" +
    "    bufferPos=0;\n" +
    "    bufferPosBytes=0;\n" +
    "    constructor() {\n" +
    "        super();\n" +
    "\n" +
    "    }\n" +
    "\n" +
    " process(\n" +
    "      inputs,\n" +
    "      outputs,\n" +
    "      parameters\n" +
    "  ){\n" +
    "\n" +
    "     let inputsCnt=inputs.length;\n" +
    "     let channelCount=0;\n" +
    "     let inputLen=0;\n" +
    "     let inputLenBytes=0;\n" +
    "     if(inputsCnt>0) {\n" +
    "         let input0 = inputs[0];\n" +
    "         channelCount = input0.length;\n" +
    "         if (channelCount > 0) {\n" +
    "             let input0ch0=input0[0];\n" +
    "             inputLen=input0ch0.length;\n" +
    "             inputLenBytes=input0ch0.buffer.length;\n" +
    "         }\n" +
    "     }\n" +
    "     if (!this.buffer || this.buffer.length < channelCount) {\n" +
    "         this.buffer = new Array(channelCount);\n" +
    "         this.bufferPos = 0\n" +
    "         for (let bch = 0; bch < channelCount; bch++) {\n" +
    "             this.buffer[bch] = new Float32Array(this.BUFFER_FRAME_LEN);\n" +
    "             this.bufferPos = 0;\n" +
    "             this.bufferPosBytes=0;\n" +
    "         }\n" +
    "     }\n" +
    "     let bufAvail = this.BUFFER_FRAME_LEN - this.bufferPos;\n" +
    "     // check if buffer has to be transferred\n" +
    "     if (inputLen > bufAvail) {\n" +
    "         let ada=new Array(channelCount);\n" +
    "         for (let ch = 0; ch < channelCount; ch++) {\n" +
    "             ada[ch]=this.buffer[ch].buffer.slice(0);\n" +
    "         }\n" +
    "         this.port.postMessage({\n" +
    "             data: ada,\n" +
    "             chs: channelCount,\n" +
    "             len: this.bufferPos\n" +
    "         }, ada);\n" +
    "         // buffer transferred, reset\n" +
    "         this.bufferPos = 0;\n" +
    "         this.bufferPosBytes=0;\n" +
    "     }\n" +
    "\n" +
    "     for(let ii=0;ii<inputsCnt;ii++) {\n" +
    "         for (let ch = 0; ch < channelCount; ch++) {\n" +
    "             // Mute outputs\n" +
    "             //outputs[ii][ch].fill(0);\n" +
    "             let chSamples = inputs[ii][ch];\n" +
    "             this.buffer[ch].set(chSamples,this.bufferPos);\n" +
    "         }\n" +
    "         this.bufferPos+=inputLen;\n" +
    "         this.bufferPosBytes+=inputLenBytes;\n" +
    "     }\n" +
    "    \n" +
    "     return true;\n" +
    "  }\n" +
    "}\n" +
    "\n" +
    "registerProcessor('capture-interceptor',AudioCaptureInterceptorProcessor);\n";




export interface AudioCaptureListener {
  opened(): void;

  started(): void;

  stopped(): void;

  closed(): void;

  error(msg?:string,advice?:string): void;
}

export class AudioCapture {
  get persistentAudioStorageTarget(): PersistentAudioStorageTarget | null {
    return this._persistentAudioStorageTarget;
  }

  set persistentAudioStorageTarget(value: PersistentAudioStorageTarget | null) {
    this._persistentAudioStorageTarget = value;
  }

  get opened(): boolean {
    return this._opened;
  }

  static BUFFER_SIZE: number = 8192;
  context: AudioContext;
  stream!: MediaStream;
  channelCount!: number;
  recUUID?:string;
  mediaStream: any;
  agcStatus:boolean|null=null;
  bufferingNode: AudioNode|null=null;
  listener!: AudioCaptureListener;
  data!: Array<Array<Float32Array>>;
  currentSampleRate!: number;
  n: Navigator;
  audioOutStream: SequenceAudioFloat32OutStream | null=null;
  private disconnectStreams = true;
  private _opened=false;
  private capturing = false;

  framesRecorded: number=0;

  private _persistentAudioStorageTarget:PersistentAudioStorageTarget|null=null;

  private persisted=true;
  private persistError:Error|null=null;
  private inddbAudioBuffer:IndexedDbAudioBuffer|null=null;

  constructor(context: AudioContext) {
    this.context = context;
    this.n = navigator;
  }

  private initData() {
    this.recUUID=UUID.generate();
    this.persistError=null;
    if(this._persistentAudioStorageTarget && this.recUUID) {
      this.inddbAudioBuffer = new IndexedDbAudioBuffer(this._persistentAudioStorageTarget, this.channelCount,this.currentSampleRate,AudioCapture.BUFFER_SIZE,0,this.recUUID)
    }
    this.data = new Array<Array<Float32Array>>();
    for (let i = 0; i < this.channelCount; i++) {
      this.data.push(new Array<Float32Array>());
    }
    this.framesRecorded = 0;
  }

  listDevices() {
    navigator.mediaDevices.enumerateDevices().then((l: MediaDeviceInfo[]) => this.printDevices(l));
  }

  private dummySession():Promise<MediaStream>{
    // workaround to request permissions:
    // Start a dummy session
    let mediaStrCnstrs = <MediaStreamConstraints>{audio:
        {echoCancelation: false}
    };
    return navigator.mediaDevices.getUserMedia(mediaStrCnstrs);

  }


  private stopAllSessionTracks(mediaStream:MediaStream){
      let ats = mediaStream.getTracks();
      for (let atIdx = 0; atIdx < ats.length; atIdx++) {
        //console.debug("Stop dummy session track: #" + atIdx)
        ats[atIdx].stop();
      }
  }

  deviceInfos(cb: (deviceInfos: MediaDeviceInfo[] | null) => any, retry = true,dummyStream?:MediaStream) {

    navigator.mediaDevices.enumerateDevices().then((l: MediaDeviceInfo[]) => {
      let labelsAvailable = false;
      for (let i = 0; i < l.length; i++) {
        let di = l[i];
        if (di.label) {
          labelsAvailable = true;
        }
      }
      if (!labelsAvailable) {
        //console.debug("Media device enumeration: No labels.")
        if (retry) {
            console.info("Starting dummy session to request audio permissions...")

            this.dummySession().then((s: MediaStream) => {
            // and stop it immediately

            if(s) {
              //console.debug("Got dummy session stream: " + s + " .")
            }else{
              //console.debug("No dummy stream")
            }
            // retry (only once)
            this.deviceInfos(cb, false,s);
          },reason => {
            //console.debug("Dummy session rejected.")
            // TODO error callback
            cb(null);
          });
        } else {
          cb(null);
        }
      } else {
        // success
        cb(l);
      }
      if(dummyStream){
        this.stopAllSessionTracks(dummyStream);
      }
    },(reason)=> {
      //rejected
      //console.debug("Media device enumeration rejected.")
      if (retry) {
        //console.debug("Starting dummy session to request audio permissions...")
        this.dummySession().then((s: MediaStream) => {
          // and stop it immediately
          //console.debug("Dummy session.")
          if(s) {
            //console.debug("Got dummy session stream: " + s + " .")
          }else{
            //console.debug("No dummy stream")
          }
          // retry (only once)
          this.deviceInfos(cb, false,s);
        }, reason => {
          //console.debug("Dummy session rejected.")
          // TODO error callback
          cb(null);
        });
      } else {
        cb(null);
      }
      if(dummyStream){
        this.stopAllSessionTracks(dummyStream);
      }
    });



  }


  printDevices(l: MediaDeviceInfo[]): void {
    let selDeviceId = '___dummy___';
    for (let i = 0; i < l.length; i++) {
      let di = l[i];

      console.log("Audio device: Id: " + di.deviceId + " groupId: " + di.groupId + " label: " + di.label + " kind: " + di.kind);
    }
  }

  open(channelCount: number, selDeviceId?: ConstrainDOMString|undefined,autoGainControlConfigs?:Array<AutoGainControlConfig>|null|undefined){
    this.context.resume().then(()=>{
      this._open(channelCount, selDeviceId, autoGainControlConfigs);
    })
  }

  _open(channelCount: number, selDeviceId?: ConstrainDOMString|undefined,autoGainControlConfigs?:Array<AutoGainControlConfig>|null|undefined) {
    this.channelCount = channelCount;
    this.framesRecorded = 0;


    //var msc = new AudioStreamConstr();
    // var msc={};
    //msc.video = false;
    //msc.audio = true;

    // Chrome and Firefox stereo channels are identical !!
    // And even worse: The data coming from the source is already preprocessed on FF and Chrome. It contains DSP artifacts!!

    // https://bugs.chromium.org/p/chromium/issues/detail?id=387737
    // The workaround to set these constraints does _NOT_ help:
    //var msc={audio: {echoCancellation: false,channelCount: 2, googAudioMirroring: false},video: false};

    // Safari at least version 11: Support for media streams
    // TODO test if input is unprocessed

    let msc:MediaStreamConstraints;
    console.info('User agent: '+navigator.userAgent);


      let ua=UserAgentBuilder.userAgent();

      // ua.components.forEach((c)=>{
      //   console.info("UA_Comp: "+c.toString());
      // })

     let agcCfg:AutoGainControlConfig|null=null;

    let autoGainControl=false;
    let chromeEchoCancellation=false;
    if(autoGainControlConfigs){
      for(let agcc of autoGainControlConfigs){
        if(agcc.platform===CfgPlatform.Android && ua.detectedPlatform===Platform.Android){
            agcCfg=agcc;
            break;
        }
        if(agcc.platform===CfgPlatform.Windows && ua.detectedPlatform===Platform.Windows){
          agcCfg=agcc;
          break;
        }
      }
      if(agcCfg){
        // TODO use EXACT/IDEAL constraint
        autoGainControl=agcCfg.value;
        if(CHROME_ACTIVATE_ECHO_CANCELLATION_WITH_AGC){
          chromeEchoCancellation=agcCfg.value;
        }
        // TODO query real AGC status
        this.agcStatus=agcCfg.value;
      }else{
        this.agcStatus=false;
      }
    }

    // default
    msc = {
      audio: {
        deviceId: selDeviceId,
        echoCancellation: false,
        channelCount: channelCount,
        autoGainControl: autoGainControl
      },
      video: false
    };

    if (ua.detectedBrowser===Browser.Edge) {

      // Microsoft Edge sends unmodified audio
      // The constraint can follow the specification
      console.info("Setting media track constraints for Microsoft Edge.");
      msc = {
        audio: {
          deviceId: selDeviceId,
          echoCancellation: false,
          channelCount: channelCount,
          autoGainControl: autoGainControl
        },
        video: false
      };
    } else if (ua.detectedBrowser===Browser.Chrome) {
      // Google Chrome: we need to switch of each of the preprocessing units including the
      console.info("Setting media track constraints for Google Chrome.");

      // Chrome 60 -> 61 changed
      // it works now without mandatory/optional sub-objects


      // Requires at least Chrome 61
      msc = {
        audio: {
          deviceId: selDeviceId,
          channelCount: channelCount,
          echoCancellation: {exact:chromeEchoCancellation},
          autoGainControl: {exact:autoGainControl},
          sampleSize:{min: 16},
        },
        video: false,
      }

    } else if (ua.detectedBrowser===Browser.Firefox) {
      console.info("Setting media track constraints for Mozilla Firefox.");
      // Firefox
      msc = {
        audio: {
            deviceId: selDeviceId,
            channelCount: channelCount,
          echoCancellation: false,
            autoGainControl: autoGainControl,
          noiseSuppression: false
        },
        video: false,
      }

    } else if (ua.detectedBrowser===Browser.Safari) {
      console.info("Setting media track constraints for Safari browser.")
      console.info("Apply workaround for Safari: Avoid disconnect of streams.");

      this.disconnectStreams = false;
      msc = {
        audio: {
          deviceId: selDeviceId,
          channelCount: channelCount,
          echoCancellation: false
        },
        video: false,
      }

    } else {

      // TODO default constraints or error Browser not supported
    }



    console.debug("Audio capture, AGC: "+this.agcStatus)


    let ump = navigator.mediaDevices.getUserMedia(msc);
    ump.then((s) => {
        this.stream = s;

        let aTracks = s.getAudioTracks();

        for (let i = 0; i < aTracks.length; i++) {
          let aTrack = aTracks[i];

          console.info("Track audio info: id: " + aTrack.id + " kind: " + aTrack.kind + " label: \"" + aTrack.label + "\"");
          let mtrSts=aTrack.getSettings();

          // Typescript lib.dom.ts MediaTrackSettings.channelCount is missing
          // https://github.com/mdn/browser-compat-data/blob/5493d8f937e05b2ddbd41b99f5bdfad4a1f2ed85/api/MediaTrackSettings.json
          //@ts-ignore
          console.info("Track audio settings: Ch cnt: "+mtrSts.channelCount+", AGC: "+mtrSts.autoGainControl+", Echo cancell.: "+mtrSts.echoCancellation);
          if(mtrSts.autoGainControl){
            this.agcStatus=mtrSts.autoGainControl;
          }
        }

        let vTracks = s.getVideoTracks();
        for (let i = 0; i < vTracks.length; i++) {
          let vTrack = vTracks[i];
          console.info("Track video info: id: " + vTrack.id + " kind: " + vTrack.kind + " label: " + vTrack.label);
        }
        this.mediaStream = this.context.createMediaStreamSource(s);
        // stream channel count ( is always 2 !)
        let streamChannelCount: number = this.mediaStream.channelCount;
        console.info("Stream channel count: "+streamChannelCount);
        // is not set!!
        //this.currentSampleRate = this.mediaStream.sampleRate;
        this.currentSampleRate = this.context.sampleRate;
        console.info("Source audio node: channels: " + streamChannelCount + " samplerate: " + this.currentSampleRate);
        if (this.audioOutStream) {
          this.audioOutStream.setFormat(this.channelCount, this.currentSampleRate);
        }
        // W3C  -> new name is createScriptProcessor
        //
        // Again deprecated, but AudioWorker not yet implemented in stable releases (June 2016)
        // AudioWorker is now AudioWorkletProcessor ... (May 2017)

      // Update 12-2020:
       // The ScriptProcessorNode Interface - DEPRECATED

      // Update 06-2021
      //  AudioWorkletProcessor is here to stay. Web Audio API has now Recommendation status !

          if(ENABLE_AUDIO_WORKLET && this.context.audioWorklet){
            //const workletFileName = ('file-loader!./interceptor_worklet.js');
            //const workletFileName = 'http://localhost:4200/assets/interceptor_worklet.js';
            //console.log(awpStr);
            let audioWorkletModuleBlob= new Blob([awpStr], {type: 'text/javascript'});

            let audioWorkletModuleBlobUrl=window.URL.createObjectURL(audioWorkletModuleBlob);

            this.context.audioWorklet.addModule(audioWorkletModuleBlobUrl).then(()=> {
                  const awn = new AudioWorkletNode(this.context, 'capture-interceptor');
                  awn.onprocessorerror=(ev:Event)=>{
                    let msg='Unknwon error';
                    if(ev instanceof ErrorEvent){
                      msg=ev.message;
                    }
                    console.error("Capture audio worklet error: "+msg);
                    if(this.listener){
                      this.listener.error(msg);
                    }
                  }
                  let awnPt = awn.port;
                  if (awnPt) {
                    awnPt.onmessage = (ev: MessageEvent<any>) => {
                      if (this.capturing) {
                        let dt=ev.data;
                        let chs = dt.chs;
                        let adaLen = dt.data.length;
                        if(DEBUG_TRACE_LEVEL>8) {
                          console.debug('Received data from worklet: ' +chs + ' ' + dt.len +' Data chs: '+adaLen);
                        }
                        //let chunkLen = adaLen / chs;
                        let chunkLen = adaLen;
                        let chunk = new Array<Float32Array>(chs);
                        for (let ch = 0; ch < chs; ch++) {
                          if (this.data && this.data[ch]) {
                            let adaPos = ch * chunkLen;
                            if(dt.data[ch]) {
                              let fa = new Float32Array(dt.data[ch]);
                              this.data[ch].push(fa);
                              chunk[ch] = fa;
                              // Use samples of channel 0 to count frames (samples)
                              if (ch == 0) {
                                this.framesRecorded += fa.length;
                              }
                            }else{
                              if(DEBUG_TRACE_LEVEL>8) {
                                console.debug('Channel '+ch+' data not set!!');
                              }
                            }
                          }
                        }
                        if (this.audioOutStream) {
                          this.audioOutStream.write(chunk);
                        }
                        if(this._persistentAudioStorageTarget){
                          this.store();
                        }
                      }
                    };
                  }
                  this.bufferingNode = awn;
                  this._opened = true;
                  if (this.listener) {
                    this.listener.opened();
                  }
                }
            ).catch((error: any)=>{
              console.log('Could not add module '+error);
            });

          }else if(this.context.createScriptProcessor) {
            // The ScriptProcessorNode Interface - DEPRECATED Only as fallback
            // TODO should we use streamChannelCount or channelCount here ?
            let scriptProcessorNode= this.context.createScriptProcessor(AudioCapture.BUFFER_SIZE, streamChannelCount, streamChannelCount);
            this.bufferingNode=scriptProcessorNode;
            let c = 0;
            if(scriptProcessorNode.onaudioprocess){
              scriptProcessorNode.onaudioprocess = (e: AudioProcessingEvent) => {

                if (this.capturing) {
                  let inBuffer = e.inputBuffer;
                  let duration = inBuffer.duration;
                  // only process requested count of channels
                  let currentBuffers = new Array<Float32Array>(channelCount);
                  for (let ch: number = 0; ch < channelCount; ch++) {
                    let chSamples = inBuffer.getChannelData(ch);
                    let chSamplesCopy = chSamples.slice(0);
                    currentBuffers[ch] = chSamplesCopy.slice(0);
                    this.data[ch].push(chSamplesCopy);
                    if(DEBUG_TRACE_LEVEL>8){
                      console.debug("Process "+chSamplesCopy.length+" samples.");
                    }
                    this.framesRecorded += chSamplesCopy.length;
                  }
                  c++;
                  if (this.audioOutStream) {
                    this.audioOutStream.write(currentBuffers);
                  }
                }
              };
              this._opened = true;
              if (this.listener) {
                this.listener.opened();
              }
            }else{
              this.listener.error('Browser does not support audio processing (ScriptProcessor.onaudioprocess method not found)!');
            }
          }else{
            this.listener.error('Browser does not support audio processing (neither AudioWorkletProcessor nor ScriptProcessor)!');
          }
        }, (e) => {
          console.error(e + " Error name: " +e.name);
          if (this.listener) {
            if('NotAllowedError' === e.name){
              this.listener.error('Not allowed to use your microphone.','Please make sure that microphone access is allowed for this web page and reload the page.');
            }else if('NotReadableError' === e.name){
              this.listener.error('Could not read from your audio device.','Please make sure your audio device is working.');
            }else if('OverconstrainedError' === e.name){
              let eMsg=e.msg?e.msg:'Overconstrained media device request error.';
              this.listener.error(eMsg);
            } else {
              this.listener.error();
            }
          }
        }
    )
  }

  start() {

    this.initData();
    if (this.audioOutStream) {
      this.audioOutStream.nextStream()
    }
    this.capturing = true;
    if(this.bufferingNode) {
      this.mediaStream.connect(this.bufferingNode);
      this.bufferingNode.connect(this.context.destination);
    }
    if (this.listener) {
      this.listener.started();
    }

  }

  stop() {

    if (this.disconnectStreams && this.bufferingNode) {
      this.mediaStream.disconnect(this.bufferingNode);
      this.bufferingNode.disconnect(this.context.destination);
    }

    if (this.audioOutStream) {
      this.audioOutStream.flush();
    }
    this.capturing = false;
    if(this.inddbAudioBuffer && this.persistError){
      // Delete invalid persistent audio data and hope that it will be completely uploaded to the server
      this.inddbAudioBuffer.releaseAudioData();
      this.inddbAudioBuffer=null;
    }
    if (this.listener && (this.persistError || this.persisted)) {
      console.debug("Stopped by stop() method call");
      this.listener.stopped();
    }
  }


  store(){
   // if(this.db && this.recUUID){
   //    let tr= this.db.transaction(SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME, 'readwrite');
   //    let recFileObjStore = tr.objectStore(SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME);
   //
   //      try {
   //        let ch0Data=this.data[0];
   //        let dataChkCnt=ch0Data.length;
   //          let pos = 0;
   //          for (let chCkIdx = 0; chCkIdx < dataChkCnt; chCkIdx++) {
   //            let bufLen=0;
   //            for (let ch = 0; ch < this.channelCount; ch++) {
   //              let chChk = this.data[ch][chCkIdx];
   //              bufLen = chChk.length;
   //              //let cacheId = uuid + '_' + ch + '_' + chCkIdx;
   //              let chkDbId = [this.recUUID, this.indDbChkIdx + chCkIdx, ch];
   //              let cr = recFileObjStore.add(chChk, chkDbId);
   //              //console.debug("Added: "+ch+" "+(this.indDbChkIdx+chCkIdx));
   //              cr.onsuccess=()=>{
   //                //console.debug("Stored audio data to indexed db");
   //              }
   //              cr.onerror=()=>{
   //                console.error("Error storing audio data to indexed db");
   //              }
   //            }
   //            pos += bufLen;
   //        }
   //        this.indDbChkIdx+=dataChkCnt;
   //
   //        tr.onerror = (err) => {
   //          console.error('Failed to cache audio data to indexed db: ' + err)
   //        }
   //        tr.oncomplete = () => {
   //          //console.debug('Transferred capture audio data to indexed db, deleting original data from memory...');
   //
   //          /// Audio data saved to index db delete from in memory data array
   //          for (let ch = 0; ch < this.channelCount; ch++) {
   //           this.data[ch].splice(0);
   //            //console.debug("Spliced/removed ch: "+ch);
   //          }
   //
   //          this.persisted=true;
   //          if(this.listener && !this.capturing){
   //            //console.debug("Stopped by indexed db hook");
   //            this.listener.stopped();
   //          }
   //        }
   //        // Commit chunks
   //        this.persisted=false;
   //        tr.commit();
   //      } catch (err) {
   //        console.error('Transfer capture audio data error: '+err);
   //      }
   //    }

    // if(!this.inddbAudioBuffer && this._persistentAudioStorageTarget && this.recUUID) {
    //   this.inddbAudioBuffer = new IndexedDbAudioBuffer(this._persistentAudioStorageTarget, this.channelCount,this.currentSampleRate,AudioCapture.BUFFER_SIZE,0,this.recUUID)
    // }
    if(this.inddbAudioBuffer){

      // Try to append to
      this.inddbAudioBuffer.appendRawAudioData(this.data).subscribe({
        complete: () => {
          //console.debug('Transferred capture audio data to indexed db, deleting original data from memory...');

          /// Audio data saved to index db delete from in memory data array
          for (let ch = 0; ch < this.channelCount; ch++) {
            this.data[ch].splice(0);
            //console.debug("Spliced/removed ch: "+ch);
          }

          this.persisted = true;
          if (this.listener && !this.capturing) {
            //console.debug("Stopped by indexed db hook");
            this.listener.stopped();
          }
        },error:(err)=>{
          // Only log the first error
          if(!this.persistError) {
            this.persistError = err;
            console.error("Error persisting audio data: " + err);
          }
        }
      });
      this.persisted=false;
    }
  }


  close() {
    this.mediaStream.disconnect();
    if (this.stream) {
      //this.stream.stop();
      //'MediaStream.stop()' is deprecated and will be removed in M47, around November 2015. Please use 'MediaStream.active' instead.
      //this.stream.active=false;
      var mts = this.stream.getTracks();
      for (var i = 0; i < mts.length; i++) {
        mts[i].stop();
      }
    }
    this._opened=false;
  }

  audioBuffer(): AudioBuffer {
    let frameLen: number = 0;
    let ch0Data = this.data[0];

    for (let ch0Chk of ch0Data) {
      frameLen += ch0Chk.length;
    }
    let ab:AudioBuffer;
      try {
        ab = this.context.createBuffer(this.channelCount, frameLen, this.context.sampleRate);
      }catch(err){
        if(err instanceof DOMException){
          if(err.name==='NotSupportedError'){
            if(frameLen==0){
              // Empty buffers are not supported by Chromium
              // Create dummy buffer with one sample
              ab = this.context.createBuffer(this.channelCount, 1, this.context.sampleRate);
            }else{
              throw err;
            }
          }else{
            throw err;
          }
        }else if (err instanceof RangeError){
          // Out of memory
          // TODO What to do ??
          throw err;
        }else{
          throw err;
        }
      }
      for (let ch = 0; ch < this.channelCount; ch++) {
        let chD = ab.getChannelData(ch);
        let pos = 0;
        for (let chChk of this.data[ch]) {
          let bufLen = chChk.length;
          chD.set(chChk, pos);
          pos += bufLen;
        }
      }
    return ab;
  }

  audioBufferArray():ArrayAudioBuffer{
      let aba=new ArrayAudioBuffer(this.channelCount,this.currentSampleRate,this.data);
      return aba;
  }

  inddbAudioBufferArray():IndexedDbAudioBuffer|null{
    // let iab:IndexedDbAudioBuffer|null=null;
    // if(this.db && this.recUUID) {
    //   iab = new IndexedDbAudioBuffer(this.db, SprDb.RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME, this.channelCount, this.currentSampleRate, AudioCapture.BUFFER_SIZE,this.framesRecorded,this.recUUID);
    // }
    // return iab;
    if(this.persistError){
      return null;
    }else {
      return this.inddbAudioBuffer;
    }
  }


}

