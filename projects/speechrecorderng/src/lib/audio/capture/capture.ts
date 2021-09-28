import {SequenceAudioFloat32OutStream} from "../io/stream";
import {
  NAME_CHROME,
  NAME_EDGE,
  NAME_FIREFOX,
  NAME_SAFARI,
  OS_ANDROID,
  OS_WINDOWS,
  UserAgentParser
} from "../../utils/ua-parser";
import {AutoGainControlConfig, Platform} from "../../speechrecorder/project/project";

class AudioStreamConstr implements MediaStreamConstraints {
  audio: boolean;
  video: boolean;

  constructor() {
    this.audio = true;
    this.video = false;
  }
}

export interface AudioCaptureListener {
  opened(): void;

  started(): void;

  stopped(): void;

  closed(): void;

  error(msg?:string,advice?:string): void;
}

export class AudioCapture {
  get opened(): boolean {
    return this._opened;
  }

  static BUFFER_SIZE: number = 8192;
  context: any;
  stream!: MediaStream;
  //mediaStream:MediaStreamAudioSourceNode;
  // no d.ts for Web audio API found so far (tsd query *audio*) (Nov 2015)
  // TODO use AudioRecorder

  channelCount!: number;
  mediaStream: any;
  agcStatus:boolean|null=null;
  bufferingNode: any;
  listener!: AudioCaptureListener;
  data!: Array<Array<Float32Array>>;
  currentSampleRate!: number;
  n: Navigator;
  audioOutStream: SequenceAudioFloat32OutStream | null=null;
  private disconnectStreams = true;
  private _opened=false;
  private capturing = false;

  framesRecorded: number=0;

  constructor(context: any) {
    this.context = context;
    this.n = navigator;
  }

  private initData() {
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
          //console.debug("Starting dummy session to request audio permissions...")

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

  open(channelCount: number, selDeviceId?: ConstrainDOMString|null,autoGainControlConfigs?:Array<AutoGainControlConfig>|null|undefined){
      this.context.resume().then(()=>{
        this._open(channelCount,selDeviceId,autoGainControlConfigs);
      })
  }

  _open(channelCount: number, selDeviceId?: ConstrainDOMString|null,autoGainControlConfigs?:Array<AutoGainControlConfig>|null|undefined) {
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

    let msc:any;
    console.info('User agent: '+navigator.userAgent);

    // @ts-ignore
    if(navigator.userAgentData){
      // maybe we can use this in  the future
      console.info("Browser provides userAgentData:");

      console.info("Brands:");
      // @ts-ignore
      navigator.userAgentData.brands.forEach((br=>{
        console.info(br.brand +" "+br.version);
      }))
      // @ts-ignore
      console.info("Platform: "+navigator.userAgentData.platform);
      // @ts-ignore
      console.info("Mobile:"+navigator.userAgentData.mobile);
      // @ts-ignore
      //console.info(navigator.userAgentData.toJSON());
    }else {
      console.info("Browser does not provide userAgentData.");
    }
      let ua=UserAgentParser.parse(navigator.userAgent);

      ua.components.forEach((c)=>{
        console.info("UA_Comp: "+c.toString());
      })

     let agcCfg:AutoGainControlConfig|null=null;

    if(autoGainControlConfigs){
      for(let agcc of autoGainControlConfigs){
        if(agcc.platform===Platform.Android && ua.runsOnOS(OS_ANDROID)){
            agcCfg=agcc;
            break;
        }
        if(agcc.platform===Platform.Windows && ua.runsOnOS(OS_WINDOWS)){
          agcCfg=agcc;
          break;
        }
      }
    }


    if (ua.isBrowser(NAME_EDGE)) {

      // Microsoft Edge sends unmodified audio
      // The constraint can follow the specification
      console.info("Setting media track constraints for Microsoft Edge.");
      msc = {
        audio: {
          deviceId: selDeviceId,
          echoCancellation: false,
          channelCount: channelCount
        },
        video: false
      };
    } else if (ua.isBrowser(NAME_CHROME)) {
      // Google Chrome: we need to switch of each of the preprocessing units including the
      console.info("Setting media track constraints for Google Chrome.");

      // Chrome 60 -> 61 changed
      // it works now without mandatory/optional sub-objects


      // Requires at least Chrome 61
      msc = {
        audio: {
          "deviceId": selDeviceId,
          "channelCount": channelCount,
          "echoCancellation": false,
          "autoGainControl": false,
          "googEchoCancellation": false,
          "googExperimentalEchoCancellation": false,
          "googAutoGainControl": false,
          "googTypingNoiseDetection": false,
          "googNoiseSuppression": false,
          "googHighpassFilter": false,
          "googBeamforming": false
        },
        video: false,
      }

    } else if (ua.isBrowser(NAME_FIREFOX)) {
      console.info("Setting media track constraints for Mozilla Firefox.");
      // Firefox
      msc = {
        audio: {
            "deviceId": selDeviceId,
            "channelCount": channelCount,
          "echoCancellation": false,
            "mozEchoCancellation": false,
            "autoGainControl": false,
          "mozAutoGainControl": false,
          "noiseSuppression": false,
          "mozNoiseSuppression": false
        },
        video: false,
      }

    } else if (ua.isBrowser(NAME_SAFARI)) {
      console.info("Setting media track constraints for Safari browser.")
      console.info("Apply workaround for Safari: Avoid disconnect of streams.");
      this.disconnectStreams = false;
      msc = {
        audio: {
          "deviceId": selDeviceId,
          "channelCount": channelCount,
          "echoCancellation": false
        },
        video: false,
      }

    } else {

      // TODO default constraints or error Browser not supported
    }

    if(agcCfg){
      // TODO use EXACT/IDEAL constraint
      msc.autoGainControl=agcCfg.value;

      // TODO query real AGC status
      this.agcStatus=agcCfg.value;
    }else{
      this.agcStatus=false;
    }

    console.debug("Audio capture, AGC: "+this.agcStatus)


    let ump = navigator.mediaDevices.getUserMedia(<MediaStreamConstraints>msc);
    ump.then((s) => {
        this.stream = s;

        let aTracks = s.getAudioTracks();

        for (let i = 0; i < aTracks.length; i++) {
          let aTrack = aTracks[i];

          console.info("Track audio info: id: " + aTrack.id + " kind: " + aTrack.kind + " label: \"" + aTrack.label + "\"");
        }

        let vTracks = s.getVideoTracks();
        for (let i = 0; i < vTracks.length; i++) {
          let vTrack = vTracks[i];
          console.info("Track video info: id: " + vTrack.id + " kind: " + vTrack.kind + " label: " + vTrack.label);
        }
        this.mediaStream = this.context.createMediaStreamSource(s);
        // stream channel count ( is always 2 !)
        let streamChannelCount: number = this.mediaStream.channelCount;

        // is not set!!
        //this.currentSampleRate = this.mediaStream.sampleRate;
        this.currentSampleRate = this.context.sampleRate;
        console.info("Source audio node: channels: " + streamChannelCount + " samplerate: " + this.currentSampleRate);
        if (this.audioOutStream) {
          this.audioOutStream.setFormat(this.channelCount, this.currentSampleRate);
        }
        // W3C  -> new name is createScriptProcessor
        //
        // TODO Again deprecated, but AudioWorker not yet implemented in stable releases (June 2016)
        // AudioWorker is now AudioWorkletProcessor ... (May 2017)

      // Update 12-2020:
       // The ScriptProcessorNode Interface - DEPRECATED
      // TODO

        if (this.context.createAudioWorker) {
          //console.debug("Audio worker implemented!!")
        } else {
          //console.debug("Audio worker NOT implemented.")
        }

        if (this.context.registerProcessor) {
          //console.debug("Audio worklet processor implemented!!");
        } else {
          //console.debug("Audio worklet processor NOT implemented.")
        }

        if (!this.context.createScriptProcessor) {
          //console.debug("Audio script processor NOT implemented.")

        } else {
          //TODO
          // The ScriptProcessorNode Interface - DEPRECATED
          //console.debug("Audio script processor implemented!!");

          // TODO should we use streamChannelCount or channelCount here ?
          this.bufferingNode = this.context.createScriptProcessor(AudioCapture.BUFFER_SIZE, streamChannelCount, streamChannelCount);
          let c = 0;
          this.bufferingNode.onaudioprocess = (e: AudioProcessingEvent) => {

            if (this.capturing) {
              // TODO use chCnt
              let inBuffer = e.inputBuffer;
              let duration = inBuffer.duration;
              // only process requested count of channels
              let currentBuffers = new Array<Float32Array>(channelCount);
              for (let ch: number = 0; ch < channelCount; ch++) {
                let chSamples = inBuffer.getChannelData(ch);
                let chSamplesCopy = chSamples.slice(0);
                currentBuffers[ch] = chSamplesCopy.slice(0);
                this.data[ch].push(chSamplesCopy);
                this.framesRecorded += chSamplesCopy.length;
              }
              c++;
              if (this.audioOutStream) {
                this.audioOutStream.write(currentBuffers);
              }
            }
          }
        }
        this._opened=true;
        if (this.listener) {

          this.listener.opened();
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
    this.mediaStream.connect(this.bufferingNode);
    this.bufferingNode.connect(this.context.destination);
    if (this.listener) {
      this.listener.started();
    }

  }

  stop() {

    if (this.disconnectStreams) {
      this.mediaStream.disconnect(this.bufferingNode);
      this.bufferingNode.disconnect(this.context.destination);
    }

    if (this.audioOutStream) {
      this.audioOutStream.flush();
    }
    this.capturing = false;
    if (this.listener) {
      this.listener.stopped();
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
    var frameLen: number = 0;
    var ch0Data = this.data[0];

    for (var ch0Chk of ch0Data) {
      frameLen += ch0Chk.length;
    }
    var ab = this.context.createBuffer(this.channelCount, frameLen, this.context.sampleRate);
    for (var ch = 0; ch < this.channelCount; ch++) {

      var chD = ab.getChannelData(ch);
      var pos = 0;
      for (var chChk of this.data[ch]) {
        var bufLen = chChk.length;
        chD.set(chChk, pos);
        pos += bufLen;
      }
    }
    return ab;
  }
}

