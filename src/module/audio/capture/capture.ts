

import {isNullOrUndefined} from "util";
interface AudioWorker extends Worker {
    terminate ():void;
    postMessage (message:any, transfer:Array<any>):void;
// readonly        attribute AudioWorkerParamDescriptor[] parameters;
    onmessage:(ev:MessageEvent) => any;
//     attribute EventHandler                 onloaded;
    //      AudioWorkerNode createNode (int numberOfInputs, int numberOfOutputs);
//     AudioParam      addParameter (DOMString name, float defaultValue);
//     void            removeParameter (DOMString name);
}
;



    class AudioStreamConstr implements MediaStreamConstraints{
        audio:boolean;
        video:boolean;
        constructor() {
           this.audio=true;
            this.video=false;
        }
    }
    export interface AudioCaptureListener {
        opened():void;
        started():void;
        stopped():void;
        closed():void;
        error():void;
    }
    export class AudioCapture {

        static BUFFER_SIZE:number=8192;
        //static BUFFER_SIZE:number=1024;
        context:any;
        stream:MediaStream;
        //mediaStream:MediaStreamAudioSourceNode;
        // no d.ts for Web audio API found so far (tsd query *audio*) (Nov 2015)
       // TODO use AudioRecorder

        channelCount:number;
        mediaStream:any;
        bufferingNode:any;
        listener:AudioCaptureListener;
        data:Array<Array<Float32Array>>;
        currentSampleRate:number;
        n:Navigator;

        constructor(context:any) {
           this.context=context;
            this.n=navigator;

        }

        private initData() {
          this.data = new Array<Array<Float32Array>>();
          for (let i = 0; i < this.channelCount; i++) {
            this.data.push(new Array<Float32Array>());
          }
        }

        listDevices() {
            navigator.mediaDevices.enumerateDevices().then((l:MediaDeviceInfo[])=>this.printDevices(l));
        }

      deviceInfos(cb: (deviceInfos: MediaDeviceInfo[] | null) => any, retry = true) {

        navigator.mediaDevices.enumerateDevices().then((l:MediaDeviceInfo[]) => {
          let labelsAvailable = false;
          for (let i = 0; i < l.length; i++) {
            let di = l[i];
            if (di.label) {
              labelsAvailable = true;
            }
          }
          if (!labelsAvailable) {
            if(retry) {
              // workaround to request permissions
              let audioCnstrs={echoCancelation: false}
              navigator.mediaDevices.getUserMedia({audio: audioCnstrs}).then((s: MediaStream) => {
                // stop immedialtely
                s.stop();

              });
              // retry (only once)
              this.deviceInfos(cb, false);
            }else{
              cb(null);
            }
          } else {
            cb(l);
          }
        });

      }


        printDevices(l:MediaDeviceInfo[]):void {
            let selDeviceId='___dummy___';
            for (let i = 0; i < l.length; i++) {
                let di = l[i];

                console.log("Id: " + di.deviceId + " groupId: " + di.groupId + " label: " + di.label + " kind: " + di.kind);
            }
        }

        open(channelCount:number,selDeviceId?:ConstrainDOMString,){
          console.log("Starting capture...");
          this.channelCount=channelCount;

            //var msc = new AudioStreamConstr();
          // var msc={};
            //msc.video = false;
            //msc.audio = true;

          // Chrome and Firefox stereo channels are identical !!
            // And even worse: The data coming from the source is already preprocessed on FF and Chrome. It contains DSP artifacts!!

          // https://bugs.chromium.org/p/chromium/issues/detail?id=387737
            // The workaround to set these constraints does _NOT_ help:
            //var msc={audio: {echoCancellation: false,channelCount: 2, googAudioMirroring: false},video: false};


            let msc;
            console.log(navigator.userAgent);
            if (navigator.userAgent.match(".*Edge.*")) {

              // Microsoft Edge sends unmodified audio
              // The constraint can follow the specification
              console.log("Setting media track constraints for Microsoft Edge.");
              msc={audio: {
                deviceId: selDeviceId,
                echoCancellation: false,
                channelCount: channelCount
              },
                video: false
              };
            }else if(navigator.userAgent.match(".*Chrome.*")){
            // Google Chrome: we need to switch of each of the
              console.log("Setting media track constraints for Google Chrome.");


            msc= {
              audio: {
                  "deviceId": selDeviceId,
                  "channelCount": channelCount,
                  "echoCancellation": false,
                  "googEchoCancellation": false,
                  "googAutoGainControl": false,
                  "googNoiseSuppression": false,
                  "googHighpassFilter": false
              },
              video: false,
            }

            }else if(navigator.userAgent.match(".*Firefox.*")){
              console.log("Setting media track constraints for Mozilla Firefox.");
                // Firefox
                // though it seems not to apply preprocessing stereo channels are mixed and splitted
              msc= {
                audio: {
                    "echoCancellation": false,
                    "mozAutoGainControl": false,
                    "mozNoiseSuppression": false
                },
                video: false,
              }
                msc = {audio: true, video: false};
            }
            if(msc) {
              console.log(msc.audio);
            }

          let ump = navigator.mediaDevices.getUserMedia(<MediaStreamConstraints>msc);
          ump.then((s) => {
              this.stream = s;

              let aTracks = s.getAudioTracks();
              for (let i = 0; i < aTracks.length; i++) {
                let aTrack = aTracks[i];

                console.log("Track audio info: id: " + aTrack.id + " kind: " + aTrack.kind + " label: \"" + aTrack.label + "\"");
              }
              let vTracks = s.getVideoTracks();
              for (let i = 0; i < vTracks.length; i++) {
                let vTrack = vTracks[i];
                console.log("Track video info: id: " + vTrack.id + " kind: " + vTrack.kind + " label: " + vTrack.label);
              }
              this.mediaStream = this.context.createMediaStreamSource(s);
              // stream channel count ( is always 2 !)
              let streamChannelCount: number = this.mediaStream.channelCount;
              this.currentSampleRate = this.mediaStream.sampleRate;
              console.log("Source audio node: channels: " + streamChannelCount + " samplerate: " + this.currentSampleRate);
              // W3C  -> new name is createScriptProcessor
              //
              // TODO Again deprecated, but AudioWorker not yet implemented in stable releases (June 2016)
              // AudioWorker is now AudioWorkletProcessor ... (May 2017)

              if (this.context.createAudioWorker) {
                console.log("Audio worker implemented!!")
              } else {
                console.log("Audio worker NOT implemented.")
              }

              if (this.context.registerProcessor) {
                console.log("Audio worklet processor implemented!!");
              } else {
                console.log("Audio worklet processor NOT implemented.")
              }

              if (!this.context.createScriptProcessor) {
                console.log("Audio script processor NOT implemented.")

              } else {
                //TODO
                // The ScriptProcessorNode Interface - DEPRECATED
                console.log("Audio script processor implemented!!");


                // TODO shuld we use streamChannelCount or channelCount here ?
                this.bufferingNode = this.context.createScriptProcessor(AudioCapture.BUFFER_SIZE, streamChannelCount, streamChannelCount);
                let c = 0;
                this.bufferingNode.onaudioprocess = (e: AudioProcessingEvent) => {

                  // TODO use chCnt
                  let inBuffer = e.inputBuffer;
                  let duration = inBuffer.duration;
                  // only process requested count of channels
                  for (let ch: number = 0; ch < channelCount; ch++) {
                    let chSamples = inBuffer.getChannelData(ch);
                    let chSamplesCopy = chSamples.slice(0);
                    this.data[ch].push(chSamplesCopy);
                  }

                  c++;
                  // TODO measure (peak) level here

                }
              }
              // }
              if (this.listener) {

                this.listener.opened();
              }
            }, (e) => {
              console.log(e);
              if (this.listener) {

                this.listener.error();
              }
            }
          )
        }

      start() {
        this.initData();
        this.mediaStream.connect(this.bufferingNode);
        this.bufferingNode.connect(this.context.destination);
        if (this.listener) {
          // onStartedListener();
          this.listener.started();
        }

    }

        stop(){

          this.mediaStream.disconnect(this.bufferingNode);
          this.bufferingNode.disconnect(this.context.destination);
            console.log("Captured");
          if(this.listener){
            this.listener.stopped();
          }
        }


      close(){

        this.mediaStream.disconnect();
        if(this.stream){
          //this.stream.stop();
          //'MediaStream.stop()' is deprecated and will be removed in M47, around November 2015. Please use 'MediaStream.active' instead.
            //this.stream.active=false;
            var mts = this.stream.getTracks();
            for (var i = 0; i < mts.length; i++) {
                mts[i].stop();
            }
        }
        console.log("Capture close");
        // if(this.listener){
        //   this.listener.closed();
        // }
      }


        // getData():Array<Array<Float32Array>>{
        //     return this.data;
        // }

        audioBuffer():AudioBuffer {
            console.log("Creating audio buffer ...");
            var frameLen:number = 0;
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
            console.log("Audio buffer ready.");
            return ab;
        }
    }

