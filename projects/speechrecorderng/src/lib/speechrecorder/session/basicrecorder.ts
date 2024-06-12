import {TransportActions} from "./controlpanel";
import {Browser, UserAgent, UserAgentBuilder} from "../../utils/ua-parser";
import {MatDialog} from "@angular/material/dialog";
import {MessageDialog} from "../../ui/message_dialog";
import {Session} from "./session";
import {SessionService} from "./session.service";
import {AudioCapture} from "../../audio/capture/capture";
import {AudioDevice, AudioStorageType, AutoGainControlConfig} from "../project/project";
import {LevelMeasure, StreamLevelMeasure} from "../../audio/dsp/level_measure";
import {AudioPlayer} from "../../audio/playback/player";
import {Subscription} from "rxjs";
import {AudioClip} from "../../audio/persistor";
import {Action} from "../../action/action";
import {MIN_DB_LEVEL} from "../../ui/recordingitem_display";
import {Upload, UploadHolder, UploadSet} from "../../net/uploader";
import {ChangeDetectorRef, Inject} from "@angular/core";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {SpeechRecorderUploader} from "../spruploader";

import {
  SequenceAudioFloat32ChunkerOutStream,
  SequenceAudioFloat32OutStream,
  SequenceAudioFloat32OutStreamMultiplier
} from "../../audio/io/stream";
import {RecordingFile, SprRecordingFile} from "../recording";
import {AudioContextProvider} from "../../audio/context";
import {UUID} from "../../utils/utils";
import {WakeLockManager} from "../../utils/wake_lock";
import {State as LiveLevelState} from "../../audio/ui/livelevel"
import {PersistentAudioStorageTarget} from "../../audio/inddb_audio_buffer";
import {ResponsiveComponent} from "../../ui/responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";

export const FORCE_REQUEST_AUDIO_PERMISSIONS=false;
export const RECFILE_API_CTX = 'recfile';
export const MAX_RECORDING_TIME_MS = 1000 * 60 * 60 * 60; // 1 hour

export const LEVEL_BAR_INTERVALL_SECONDS = 0.1;  // 100ms

export const NOSLEEP_VIDEO_TITLE='No Sleep';

export interface ChunkAudioBufferReceiver{
  postAudioStreamStart():void;
  postChunkAudioBuffer(audioBuffer:AudioBuffer,chunkIdx:number):void;
  postAudioStreamEnd(chunkCount:number):void;
}

export class ChunkManager implements SequenceAudioFloat32OutStream{

  set recordingFile(value: SprRecordingFile) {
    this._rf = value;
  }

  private channels:number=0;
  private sampleRate:number=-1;

  private _rf!:SprRecordingFile;

  private chunkIdx:number=0;


  constructor(private chunkAudioBufferReceiver:ChunkAudioBufferReceiver) {
  }

  close(): void {
    // Nothing to do
  }

  flush(): void {
    this.chunkAudioBufferReceiver.postAudioStreamEnd(this.chunkIdx);
  }

  nextStream(): void {
    // reset chunk counter
    this.chunkIdx=0;
    this.chunkAudioBufferReceiver.postAudioStreamStart();
  }

  setFormat(channels: number, sampleRate: number): void {
    this.channels=channels;
    this.sampleRate=sampleRate;
  }

  write(buffers: Array<Float32Array>): number {
    let aCtx=AudioContextProvider.audioContextInstance();
    let bChs=buffers.length;
    let frameLen=0;
    if(aCtx && bChs>0) {
      frameLen=buffers[0].length;
      try {
        let ad = aCtx.createBuffer(this.channels, frameLen, this.sampleRate);
        for (let ch = 0; ch < this.channels; ch++) {
          ad.copyToChannel(buffers[ch],ch);
        }
        this.chunkAudioBufferReceiver.postChunkAudioBuffer(ad,this.chunkIdx);
        this.chunkIdx++;
      }catch(err){
        // TODO Handle errors
        // iOS Safari sometimes throws NotSupportedError
        console.error("Could not create audio buffer for chunked upload.");
        console.error("Nr. of chs: "+this.channels+", frame length: "+frameLen+", sample rate: "+this.sampleRate);
        if(err instanceof DOMException){
          console.error("DOM exception: Name: "+err.name+", Msg: "+err.message);
          if(err.name==='NotSupportedError'){
            if(frameLen==0){
              // Empty buffers are not supported by Chromium
             // No data to transfer, but this case should never happen
              return frameLen;
            }else{
              throw err;
            }
          }else if(err.name==='RangeError'){
            console.error("DOM RangeError");
            // Out of memory
            // TODO What to do ??
            throw err;
          }else{
            console.error("DOM Exception unknown");
            throw err;
          }
        }else if (err instanceof RangeError){
          console.error("RangeError: Name: "+err.name+", Msg: "+err.message);
          // Out of memory
          // TODO What to do ??
          throw err;
        }else{
          throw err;
        }
      }
    }
    return frameLen;
  }

}

export abstract class BasicRecorder extends ResponsiveComponent{
  get allowEchoCancellation(): boolean {
    return this._allowEchoCancellation;
  }

  set allowEchoCancellation(value: boolean) {
    this._allowEchoCancellation = value;
  }

  protected updateTimerId: any;

  protected maxRecTimerId: number|null=null;
  protected maxRecTimerRunning: boolean=false;

  get maxAutoNetMemStoreSamples(): number {
    return this._maxAutoNetMemStoreSamples;
  }

  set maxAutoNetMemStoreSamples(value: number) {
    this._maxAutoNetMemStoreSamples = value;
  }

  public static readonly DEFAULT_MAX_NET_AUTO_MEM_STORE_SAMPLES:number=2880000*5; // Default 5 minutes one channel at 48kHz
  protected _maxAutoNetMemStoreSamples:number=BasicRecorder.DEFAULT_MAX_NET_AUTO_MEM_STORE_SAMPLES;

  public static readonly DEFAULT_CHUNK_SIZE_SECONDS:number=30;

  get clientAudioStorageType(): AudioStorageType {
    return this._clientAudioStorageType;
  }

  set clientAudioStorageType(value: AudioStorageType) {

    let oldValue=this._clientAudioStorageType;
    this._clientAudioStorageType = value;
    if(value!==oldValue){
      this.configureStreamCaptureStream();
    }
  }
  get persistentAudioStorageTarget(): PersistentAudioStorageTarget | null {
    return this._persistentAudioStorageTarget;
  }

  set persistentAudioStorageTarget(value: PersistentAudioStorageTarget | null) {
    let oldValue=this._persistentAudioStorageTarget;
    this._persistentAudioStorageTarget = value;
    if(value!==oldValue){
      this.configureStreamCaptureStream();
    }

  }

  // Enable only for developemnt/debug purposes of array audio buffers !!
  public static readonly FORCE_ARRRAY_AUDIO_BUFFER=false;

  get uploadChunkSizeSeconds(): number|null {
    return this._uploadChunkSizeSeconds;
  }

  set uploadChunkSizeSeconds(value: number|null) {
    let oldValue=this.uploadChunkSizeSeconds;
    this._uploadChunkSizeSeconds = value;
    if(value!==oldValue){
      this.configureStreamCaptureStream();
    }
  }

  protected userAgent:UserAgent;
  statusMsg: string='';
  statusAlertType!: string;
  statusWaiting: boolean=false;
  readonly=false;
  protected rfUuid:string|null=null;
  processingRecording=false;
  ac: AudioCapture|null=null;

  protected _wakeLock:boolean=false;
  // Property audioDevices from project config: list of names of allowed audio devices.
  protected _audioDevices: Array<AudioDevice> | null| undefined;
  protected _selectedDeviceId:string|undefined=undefined;
  protected selCaptureDeviceId: ConstrainDOMString | null;
  protected _channelCount = 2;
  protected _autoGainControlConfigs: Array<AutoGainControlConfig> | null| undefined;
  protected _allowEchoCancellation:boolean=false;

  _session: Session|null=null;
  protected _recordingFile:RecordingFile|null=null;

  transportActions: TransportActions;
  playStartAction: Action<void>;

  protected startedDate:Date|null=null;

  uploadProgress: number = 100;
  uploadStatus: string = 'ok'
  protected uploadSet:UploadSet|null=null;

  audioSignalCollapsed = true;

  protected streamLevelMeasure: StreamLevelMeasure;
  protected levelMeasure: LevelMeasure;
  peakLevelInDb:number=MIN_DB_LEVEL;
  audioLoaded:boolean=false;
  disableAudioDetails:boolean=false;
  protected _controlAudioPlayer: AudioPlayer|null=null;
  public displayAudioClip: AudioClip | null=null;
  protected audioFetchSubscription:Subscription|null=null;

  liveLevelDisplayState:LiveLevelState=LiveLevelState.READY;
  keepLiveLevel:boolean=false;
  private calcBufferInfosSubscr:Subscription|null=null;

  protected destroyed=false;

  protected navigationDisabled=true;

  protected _uploadChunkSizeSeconds:number|null=null;
  //=BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;

  // Default: Continuous HTML5 Audio API AudioBuffer, no chunked upload
  protected _clientAudioStorageType:AudioStorageType=AudioStorageType.MEM_ENTIRE;

  protected _persistentAudioStorageTarget:PersistentAudioStorageTarget|null=null;

  protected _screenLocked=false;

  private wakeLockManager?:WakeLockManager;

  protected constructor(protected bpo:BreakpointObserver,protected changeDetectorRef: ChangeDetectorRef,
                public dialog: MatDialog,
                protected sessionService:SessionService,
                protected uploader: SpeechRecorderUploader,
                @Inject(SPEECHRECORDER_CONFIG) public config?: SpeechRecorderConfig) {
    super(bpo);
    this.userAgent=UserAgentBuilder.userAgent();
    const detPfm=this.userAgent.detectedPlatform;
    if(detPfm) {
      console.debug("Detected platform: " +detPfm);
    }
    const detBr=this.userAgent.detectedBrowser;
    const detBrVers=this.userAgent.detectedBrowserVersion;
    if(detBr) {
      let detBrVersStr=(detBrVers)?' '+detBrVers:'';
      console.debug("Detected browser: " +detBr+detBrVersStr);
    }
    this.transportActions = new TransportActions();
    this.playStartAction = new Action('Play');
    this.levelMeasure = new LevelMeasure();
    this.streamLevelMeasure = new StreamLevelMeasure();
    this.selCaptureDeviceId = null;
  }

  get wakeLock(): boolean {
    return this._wakeLock;
  }

  set wakeLock(value: boolean) {
    this._wakeLock = value;
  }

  enableWakeLockCond(){
    if(this.wakeLock===true) {
      if(!this.wakeLockManager){
        this.wakeLockManager=new WakeLockManager();
        this.wakeLockManager.behaviorSubject.subscribe({
            next: (v) => {
              this._screenLocked = v;
            },
            error: (err) => {
              console.error("Wake lock error!")
              this._screenLocked = false;
            }
          }
        );
      }
      this.wakeLockManager.enableWakeLock();
    }
  }

  disableWakeLockCond(){
    this.wakeLockManager?.disableWakeLock();
  }

  get screenLocked(){
    return this._screenLocked;
  }

  set audioDevices(audioDevices: Array<AudioDevice> | null | undefined) {
    this._audioDevices = audioDevices;
  }

  set autoGainControlConfigs(autoGainControlConfigs: Array<AutoGainControlConfig>|null|undefined){
    this._autoGainControlConfigs=autoGainControlConfigs;
  }

  set channelCount(channelCount: number) {
    this._channelCount = channelCount;
  }

  set session(session: Session|null) {
    this._session = session;
  }

  get session():Session|null{
    return this._session;
  }

  enableStartUserGesture() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Ready.';
  }

  configureStreamCaptureStream() {
    let outStream;

    if (AudioStorageType.MEM_ENTIRE!==this._clientAudioStorageType || this.uploadChunkSizeSeconds) {
      if(!this.uploadChunkSizeSeconds){
        this.uploadChunkSizeSeconds=BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;
      }
      // Multiply the capture stream to...
      let sasm = new SequenceAudioFloat32OutStreamMultiplier();

      // ...upload audio data in chunks...
      let chMng = new ChunkManager(this);  // The chunk manager connects the chunked audio stream to this class to upload the chunks
      let chOsUpload = new SequenceAudioFloat32ChunkerOutStream(chMng, this.uploadChunkSizeSeconds); // The audio stream chunker itself
      sasm.sequenceAudioFloat32OutStreams.push(chOsUpload);

      // ...and to measure the level
      let chOsLvlMeas = new SequenceAudioFloat32ChunkerOutStream(this.streamLevelMeasure, LEVEL_BAR_INTERVALL_SECONDS)
      sasm.sequenceAudioFloat32OutStreams.push(chOsLvlMeas);

      outStream = sasm;
    } else {
      outStream = new SequenceAudioFloat32ChunkerOutStream(this.streamLevelMeasure, LEVEL_BAR_INTERVALL_SECONDS);
    }
    if(this.ac) {
      this.ac.maxAutoNetMemStoreSamples=this._maxAutoNetMemStoreSamples;
      this.ac.audioStorageType=this._clientAudioStorageType;
      this.ac.audioOutStream = outStream;
      if(AudioStorageType.DB_CHUNKED===this._clientAudioStorageType && this._persistentAudioStorageTarget!==null) {
        this.ac.persistentAudioStorageTarget = this._persistentAudioStorageTarget;
      }
    }
  }


  showRecording() {
    if(this._controlAudioPlayer) {
      this._controlAudioPlayer.stop();
    }
    if(this.calcBufferInfosSubscr){
      this.calcBufferInfosSubscr.unsubscribe();
    }
    if (this.displayAudioClip) {
      let dap=this.displayAudioClip;
      let adh=dap.audioDataHolder;
      if(adh){
        if(!this.keepLiveLevel) {
          this.liveLevelDisplayState = LiveLevelState.LOADING;
        }
        adh.addOnReadyListener(()=>{
          //console.debug("Audio data holder ready. Enable playback. Audio loaded true.")
          if(!this.keepLiveLevel) {
            this.liveLevelDisplayState = LiveLevelState.RENDERING;
            this.calcBufferInfosSubscr = this.levelMeasure.calcBufferLevelInfos(adh, LEVEL_BAR_INTERVALL_SECONDS).subscribe((levelInfos) => {
              //console.debug("Level infos: levelInfos number size: "+levelInfos.numberSize());
              dap.levelInfos = levelInfos;
              this.liveLevelDisplayState = LiveLevelState.READY;
              this.changeDetectorRef.detectChanges();
            });
          }
          this.playStartAction.disabled = false;
          this.audioLoaded=true;
          this.changeDetectorRef.detectChanges();
        });
        //console.debug("Audio data holder added onReady.")
      }
      //this.playStartAction.disabled = false;
    } else {

      this.playStartAction.disabled = true;
      this.audioLoaded=false;
      // Collapse audio signal display if open
      if (!this.audioSignalCollapsed) {
        this.audioSignalCollapsed = true;
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  start() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Starting session...';
    this.statusWaiting=false;
    if(this._session) {
      if (this._session.sealed) {
        this.readonly = true
        this.statusMsg = 'Session sealed!';
        //let dialogRef = this.dialog.open(SessionSealedDialog, {});
        this.dialog.open(MessageDialog, {
          data: {
            type: 'error',
            title: 'Error',
            msg: "This session is sealed. Recordings cannot be added anymore.",
            advice: 'Please ask your experimenter what to do (e.g start a new session).',
          }
        });
      } else {
        let body: any = {};
        if (this._session.status === "CREATED") {
          this._session.status = "LOADED";
          body.status = this._session.status;
          if (!this._session.loadedDate) {
            this._session.loadedDate = new Date();
            body.loadedDate = this._session.loadedDate;
          }
        } else {
          this._session.restartedDate = new Date();
          body.restartedDate = this._session.restartedDate;
        }
        this.sessionService.patchSessionObserver(this._session, body).subscribe()
      }
    }

    // Check browser compatibility

    // Safari seems to support Stereo recordings now (2024-06-12, iPadOS 17.5.1)
    // if(this.userAgent.detectedBrowser===Browser.Safari && this._channelCount>1){
    //   let eMsg="Error: Safari browser does not support stereo recordings.";
    //   console.error(eMsg);
    //   this.dialog.open(MessageDialog, {
    //     data: {
    //       type: 'error',
    //       title: 'Browser not supported',
    //       msg: eMsg,
    //       advice: "Please use a supported browser, e.g. Mozilla Firefox."
    //     }
    //   })
    // }

    //console.log("Session ID: "+this._session.session+ " status: "+this._session.status)
    this._selectedDeviceId=undefined;

    if (!this.readonly && this.ac && (FORCE_REQUEST_AUDIO_PERMISSIONS || (this._audioDevices && this._audioDevices.length > 0))) {
      this.statusMsg = 'Requesting audio permissions...';
      this.statusAlertType = 'info';

      this.ac.deviceInfos((mdis) => {
        let audioCaptureDeviceAvail: boolean = false;
        let audioPlayDeviceAvail: boolean = false;
        if (mdis) {
          if(this.ac) {
            this.ac.printDevices(mdis);
          }
          if (mdis.length > 0) {
            for (let mdii = 0; mdii < mdis.length; mdii++) {
              let mdi = mdis[mdii];
              let kind=mdi.kind;
              if(kind === "audioinput"){
                audioCaptureDeviceAvail=true;
              }else if(kind=== "audiooutput"){
                audioPlayDeviceAvail=true;
              }
            }
          }

          if (this._session && this._session.type !== 'TEST_DEF_A' && this._audioDevices && this._audioDevices.length > 0) {
            let fdi: MediaDeviceInfo | null = null;
            for (let adI = 0; adI < this._audioDevices.length; adI++) {
              let ad = this._audioDevices[adI];
              if (ad.playback) {
                // project audio device config for playback device
                // not used for now
                continue;
              }
              for (let mdii = 0; mdii < mdis.length; mdii++) {
                let mdi = mdis[mdii];
                let kind=mdi.kind;
                if(kind === "audioinput"){
                  audioCaptureDeviceAvail=true;
                }else if(kind=== "audiooutput"){
                  audioPlayDeviceAvail=true;
                }
                if (ad.regex) {
                  //console.log("Match?: \'"+mdi.label+"\' \'"+ad.name+"\'");
                  if (mdi.label.match(ad.name)) {
                    fdi = mdi;
                    //console.log("Match!");
                  }
                } else {
                  if (mdi.label.trim() === ad.name.trim()) {
                    fdi = mdi;
                  }
                }
                if (fdi) {
                  break;
                }
              }
              if (fdi) {
                break;
              }
            }

            if (fdi) {
              // matching device found

              // Not able to open device here since Chrome 71
              // Chrome 71 requires a user gesture before the AudioContext can be resumed
              // sessionmanager.ts:712 Open session with default audio device for 1 channels
              // capture.ts:128 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu
              // push../projects/speechrecorderng/src/lib/audio/capture/capture.ts.AudioCapture.open @ capture.ts:128

              //this.ac.open(this._channelCount, fdi.deviceId);
              console.info("Set selected audio device: \'" + fdi.label + "\' Id: \'" + fdi.deviceId + "\'");
              this._selectedDeviceId = fdi.deviceId;

              this.enableStartUserGesture()
            } else {
              // device not found
              this.statusMsg = 'ERROR: Required audio device not available!';
              this.statusAlertType = 'error';
              this.readonly = true;

              this.dialog.open(MessageDialog, {
                data: {
                  type: 'error',
                  title: 'Required audio device',
                  msg: "Required audio device not found",
                  advice: "Please connect a suitable audio device for this project and retry (press the browser reload button)."
                }
              })
            }
          }else{
            if(!audioCaptureDeviceAvail && !audioPlayDeviceAvail){
              // no device found
              this.statusMsg = 'ERROR: No audio device available!';
              this.statusAlertType = 'warn';
              //this.readonly = true;

              this.dialog.open(MessageDialog, {
                data: {
                  type: 'warn',
                  title: 'No audio device',
                  msg: "No audio device found",
                  advice: "Please connect an audio device and retry (press the browser reload button) or try to continue anyway."
                }
              })
            }else {
              if (!this.readonly && !audioCaptureDeviceAvail) {
                // no device found
                this.statusMsg = 'WARNING: No audio capture device available!';
                this.statusAlertType = 'warning';
                //this.readonly = true;

                this.dialog.open(MessageDialog, {
                  data: {
                    type: 'warning',
                    title: 'No audio capture device',
                    msg: "No audio capture device found",
                    advice: "Please connect an audio capture device and retry (press the browser reload button) or try to continue anyway."
                  }
                })
              }
              // Safari does not list playback devices
              if (!audioPlayDeviceAvail) {
                // Firefox does not enumerate audiooutput devices
                // Do not show this warning, because it would always appear on Firefox
                // When https://bugzilla.mozilla.org/show_bug.cgi?id=1498512 is fixed the warning can be enabled for Firefox as well

                // It is already implemneted but kept behind a preference setting https://bugzilla.mozilla.org/show_bug.cgi?id=1152401


                // Output devices are listed if about:config media.setsinkid.enabled=true
                // but default setting is false


                // Same problem with Safari

                if (!(this.userAgent.detectedBrowser===Browser.Safari || this.userAgent.detectedBrowser===Browser.Firefox)) {
                  // no device found
                  this.statusMsg = 'WARNING: No audio playback device available!';
                  this.statusAlertType = 'warn';
                  //this.readonly = true;

                  this.dialog.open(MessageDialog, {
                    data: {
                      type: 'warn',
                      title: 'No audio playback device',
                      msg: "No audio playback device found",
                      advice: "Please connect an audio playback device and retry (press the browser reload button) or try to continue anyway."
                    }
                  })
                }
              }
            }

            // Not able to open device here since Chrome 71
            // Chrome 71 requires a user gesture before the AudioContext can be resumed
            // sessionmanager.ts:712 Open session with default audio device for 1 channels
            // capture.ts:128 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu
            // push../projects/speechrecorderng/src/lib/audio/capture/capture.ts.AudioCapture.open @ capture.ts:128
            //console.log("Open session with default audio device for "+this._channelCount+" channels");
            //this.ac.open(this._channelCount);

            // enable start gesture anyway
            this.enableStartUserGesture()
          }
        }

      });
    }
    this.statusMsg='Ready.';
  }

  startItem() {
    this.rfUuid = UUID.generate();
    if(this.ac) {
      this.ac.recUUID = this.rfUuid;
    }
    this.startedDate=null;
    this.enableWakeLockCond();
    //this.rfUuid=UUID.generate();
    this.uploadSet=null;
    this.transportActions.startAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
  }

  protected startCapture() {
    if (this.ac) {
      if (!this.ac.opened) {
        if (this._selectedDeviceId) {
          console.log("Open session with audio device Id: \'" + this._selectedDeviceId + "\' for " + this._channelCount + " channels");
        } else {
          console.log("Open session with default audio device for " + this._channelCount + " channels");
        }
        this.ac.open(this._channelCount, this._selectedDeviceId, this._autoGainControlConfigs,this._allowEchoCancellation);
      } else {
        this.ac.start();
      }
    }
  }

  opened() {
    if(this.ac) {
      this.ac.start();
    }
  }

  started() {

    if(!this.startedDate) {
      this.startedDate=new Date();
    }
    this.transportActions.startAction.disabled = true;
  }

  postRecording(wavFile: Uint8Array, recUrl: string,rf:RecordingFile|null,uploadHolder?:UploadHolder) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
    let ul = new Upload(wavBlob, recUrl,rf);
    if(uploadHolder){
      uploadHolder.upload=ul;
    }
    this.uploader.queueUpload(ul);
  }

  postAudioStreamStart(): void {
    if(this.rfUuid) {
      this.uploadSet=new UploadSet();
      let apiEndPoint = '';
      if (this.config && this.config.apiEndPoint) {
        apiEndPoint = this.config.apiEndPoint;
      }
      if (apiEndPoint !== '') {
        apiEndPoint = apiEndPoint + '/'
      }
      let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
      let recUrl: string = sessionsUrl + '/' + this.session?.sessionId + '/' + RECFILE_API_CTX + '/' + this.rfUuid + '/prepareChunksRequest';
      let fd = new FormData();
      // Note: At least one parameter must be set
      fd.set('uuid',this.rfUuid);
      if(!this.startedDate) {
        this.startedDate=new Date();
      }
      fd.set('startedDate',this.startedDate.toJSON());

      let ul = new Upload(fd, recUrl);
      this.uploadSet.add(ul);
      this.uploader.queueUpload(ul);
    }else{
      console.error("Recording file UUID not set!")
    }
  }

protected sessionsBaseUrl():string {
  let apiEndPoint = '';
  if (this.config && this.config.apiEndPoint) {
    apiEndPoint = this.config.apiEndPoint;
  }
  if (apiEndPoint !== '') {
    apiEndPoint = apiEndPoint + '/'
  }
  return  apiEndPoint + SessionService.SESSION_API_CTX;
}

  abstract postChunkAudioBuffer(audioBuffer: AudioBuffer, chunkIdx: number): void;

  postAudioStreamEnd(chunkCount: number): void {

    if(this.rfUuid) {

      let sessionsUrl = this.sessionsBaseUrl();
      let recUrl: string = sessionsUrl + '/' + this.session?.sessionId + '/' + RECFILE_API_CTX + '/' + this.rfUuid+'/concatChunksRequest';
      let fd=new FormData();
      fd.set('uuid',this.rfUuid);
      fd.set('chunkCount',chunkCount.toString());
      let ul = new Upload(fd, recUrl,this._recordingFile);
      if(this.uploadSet){
        this.uploadSet.add(ul);
        this.uploadSet.complete();
      }
      this.uploader.queueUpload(ul);
      //console.debug("Queued for upload: "+this._recordingFile);
    }else{
      console.error("Recording file UUID not set!")
    }
  }

  closed() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Session closed.';
  }

  error(msg='An unknown error occured during recording.',advice:string='Please retry.') {
    this.navigationDisabled = false;
    this.statusMsg = 'ERROR: Recording.';
    this.statusAlertType = 'error';
    this.dialog.open(MessageDialog, {
      data: {
        type: 'error',
        title: 'Recording error',
        msg: msg,
        advice: advice
      }
    });
  }

}
