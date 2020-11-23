import {SequenceAudioFloat32OutStream} from "../io/stream";
import {MIMEType} from "../../net/mimetype";
import {migrateExpression} from "@angular/core/schematics/migrations/renderer-to-renderer2/migration";

// interface AudioWorker extends Worker {
//   terminate (): void;
//
//   postMessage (message: any, transfer: Array<any>): void;
//
// // readonly        attribute AudioWorkerParamDescriptor[] parameters;
//   onmessage: (ev: MessageEvent) => any;
// //     attribute EventHandler                 onloaded;
//   //      AudioWorkerNode createNode (int numberOfInputs, int numberOfOutputs);
// //     AudioParam      addParameter (DOMString name, float defaultValue);
// //     void            removeParameter (DOMString name);
// }
// ;

class AudioStreamConstr implements MediaStreamConstraints {
    audio: boolean;
    video: boolean;

    constructor() {
        this.audio = true;
        this.video = false;
    }
}

export interface MediaCaptureListener {
    opened(): void;

    started(): void;

    stopped(): void;

    closed(): void;

    dataAvailable(blob: Blob): void;

    error(msg?: string, advice?: string): void;
}

export class AudioCapture {
    get opened(): boolean {
        return this._opened;
    }

    static BUFFER_SIZE: number = 8192;
    context: any;
    stream: MediaStream;
    //mediaStream:MediaStreamAudioSourceNode;
    // no d.ts for Web audio API found so far (tsd query *audio*) (Nov 2015)
    // TODO use AudioRecorder
    mediaRecorder: MediaRecorder = null;
    mediaRecorderOptions: MediaRecorderOptions = {};
    mimeType: MIMEType = null;
    channelCount: number;
    mediaStream: any;
    bufferingNode: any;
    listener: MediaCaptureListener;
    data: Array<Array<Float32Array>>;
    currentSampleRate: number;
    n: Navigator;
    audioOutStream: SequenceAudioFloat32OutStream | null;
    private disconnectStreams = true;
    private _opened = false;
    private capturing = false;

    framesRecorded: number;

    constructor(context: any) {
        this.context = context;
        this.n = navigator;
    }

    private initData() {
        if (this.mimeType.isAudioPCM()) {
            this.data = new Array<Array<Float32Array>>();
            for (let i = 0; i < this.channelCount; i++) {
                this.data.push(new Array<Float32Array>());
            }
        }
        this.framesRecorded = 0;
    }

    listDevices() {
        navigator.mediaDevices.enumerateDevices().then((l: MediaDeviceInfo[]) => this.printDevices(l));
    }


    private dummySession(): Promise<MediaStream> {
        // workaround to request permissions:
        // Start a dummy session
        let mediaStrCnstrs = <MediaStreamConstraints>{
            audio:
                {echoCancelation: false}
        };
        return navigator.mediaDevices.getUserMedia(mediaStrCnstrs);

    }


    private stopAllSessionTracks(mediaStream: MediaStream) {
        let ats = mediaStream.getTracks();
        for (let atIdx = 0; atIdx < ats.length; atIdx++) {
            //console.debug("Stop dummy session track: #" + atIdx)
            ats[atIdx].stop();
        }
    }

    deviceInfos(cb: (deviceInfos: MediaDeviceInfo[] | null) => any, retry = true, dummyStream?: MediaStream) {

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

                        if (s) {
                            //console.debug("Got dummy session stream: " + s + " .")
                        } else {
                            //console.debug("No dummy stream")
                        }
                        // retry (only once)
                        this.deviceInfos(cb, false, s);
                    }, reason => {
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
            if (dummyStream) {
                this.stopAllSessionTracks(dummyStream);
            }
        }, (reason) => {
            //rejected
            //console.debug("Media device enumeration rejected.")
            if (retry) {
                //console.debug("Starting dummy session to request audio permissions...")
                this.dummySession().then((s: MediaStream) => {
                    // and stop it immediately
                    //console.debug("Dummy session.")
                    if (s) {
                        //console.debug("Got dummy session stream: " + s + " .")
                    } else {
                        //console.debug("No dummy stream")
                    }
                    // retry (only once)
                    this.deviceInfos(cb, false, s);
                }, reason => {
                    //console.debug("Dummy session rejected.")
                    // TODO error callback
                    cb(null);
                });
            } else {
                cb(null);
            }
            if (dummyStream) {
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

    open(mimeType: MIMEType, channelCount: number, selDeviceId?: ConstrainDOMString) {
        this.context.resume().then(() => {
            this._open(mimeType, channelCount, selDeviceId);
        })
    }


    _open(mimeType: MIMEType, channelCount: number, selDeviceId?: ConstrainDOMString,) {
        this.mimeType = mimeType;
        let mimeTypeStr = mimeType.toHeaderString();

        this.channelCount = channelCount;
        this.framesRecorded = 0;

        let video = mimeType.isVideo();

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

        let msc: any;
        console.info('User agent: ' + navigator.userAgent);
        if (navigator.userAgent.match(".*Edge.*")) {

            // Microsoft Edge sends unmodified audio
            // The constraint can follow the specification
            console.info("Setting media track constraints for Microsoft Edge.");
            msc = {
                audio: {
                    deviceId: selDeviceId,
                    echoCancellation: false,
                    channelCount: channelCount
                },
                video: video
            };
        } else if (navigator.userAgent.match(".*Chrome.*")) {
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
                video: video
            };

            // TODO MediaRecorder of Chrome always creates Matroska files with video/webm
            // Seems to be a bug
            // Workaround use: 'video/webm;codecs=vp9'
            // https://stackoverflow.com/questions/64233494/mediarecorder-does-not-produce-a-valid-webm-file
            if (mimeTypeStr === 'video/webm') {
                mimeTypeStr = 'video/webm;codecs="vp9,opus"';
            }

        } else if (navigator.userAgent.match(".*Firefox.*")) {
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
                video: video
            };

        } else if (navigator.userAgent.match(".*Safari.*")) {
            console.info("Setting media track constraints for Safari browser.")
            console.info("Apply workaround for Safari: Avoid disconnect of streams.");
            this.disconnectStreams = false;
            msc = {
                audio: {
                    "deviceId": selDeviceId,
                    "channelCount": channelCount,
                    "echoCancellation": false
                },
                video: video
            };

        } else {

            // TODO default constraints or error Browser not supported
        }

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

                if (this.mimeType.isAudioPCM()) {
                    // Use Audio API
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
                } else {

                    if (MediaRecorder.isTypeSupported(mimeTypeStr)) {
                        this.mediaRecorderOptions = {
                            mimeType: mimeTypeStr
                        }
                        console.log("Video MIME " + mimeTypeStr + " supported.");
                    } else {
                        console.log("Video MIME " + mimeTypeStr + " not supported. Falling back to default.");
                    }
                    // Use MediaRecorder API
                    if (!this.mediaRecorder || this.mediaRecorder.mimeType !== mimeTypeStr) {
                        // Create media recorder on demand
                        this.mediaRecorder = new MediaRecorder(this.stream, this.mediaRecorderOptions);
                        if (this.listener) {
                            this.mediaRecorder.onstart = (ev) => {
                                console.log("Media recorder started.");
                                this.listener.started();
                            }
                            this.mediaRecorder.onstop = (ev) => {
                                console.log("Media recorder stopped.");
                                this.listener.stopped();
                            }
                            this.mediaRecorder.onpause = (ev) => {
                                console.log("Media recorder paused.");
                            }
                            this.mediaRecorder.onresume = (ev) => {
                                console.log("Media recorder resumed.");
                            }
                            this.mediaRecorder.onerror = (ev) => {
                                console.error("Media recorder error!");
                                this.listener.error(ev.error.message);
                            }
                        }
                        this.mediaRecorder.ondataavailable = (blobEvent: BlobEvent) => {
                            console.log("Recorded Blob: " + blobEvent.data);
                            if (this.listener) {
                                this.listener.dataAvailable(blobEvent.data);
                            }
                        };
                    }

                }
                this._opened = true;
                if (this.listener) {

                    this.listener.opened();
                }
            }, (e) => {
                console.error(e + " Error name: " + e.name);

                if (this.listener) {
                    if ('NotAllowedError' === e.name) {
                        this.listener.error('Not allowed to use your microphone.', 'Please make sure that microphone access is allowed for this web page and reload the page.');
                    } else if ('NotReadableError' === e.name) {
                        this.listener.error('Could not read from your audio device.', 'Please make sure your audio device is working.');
                    } else if ('OverconstrainedError' === e.name) {
                        let eMsg = e.msg ? e.msg : 'Overconstrained media device request error.';
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
        if (this.mimeType.isAudioPCM()) {
            if (this.audioOutStream) {
                this.audioOutStream.nextStream()
            }
            this.capturing = true;
            this.mediaStream.connect(this.bufferingNode);
            this.bufferingNode.connect(this.context.destination);

            if (this.listener) {
                this.listener.started();
            }
        } else {

            if (this.mediaRecorder) {
                this.capturing = true;
                this.mediaRecorder.start();
            }
        }

    }

    stop() {
        if (this.mimeType.isAudioPCM()) {
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
        } else if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.capturing = false;
        }
    }


    close() {
        if (this.mimeType.isAudioPCM()) {
            this.mediaStream.disconnect();
        }
        if (this.stream) {
            //this.stream.stop();
            //'MediaStream.stop()' is deprecated and will be removed in M47, around November 2015. Please use 'MediaStream.active' instead.
            //this.stream.active=false;
            var mts = this.stream.getTracks();
            for (var i = 0; i < mts.length; i++) {
                mts[i].stop();
            }
        }

        this._opened = false;
    }

    audioBuffer(): AudioBuffer {
        if (!this.mimeType.isAudioPCM()) {
            return null;
        }
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

