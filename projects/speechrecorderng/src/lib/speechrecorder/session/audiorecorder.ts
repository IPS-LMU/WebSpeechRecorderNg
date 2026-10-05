import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'
import {RecordingFile, RecordingFileUtils} from '../recording'
import {messageOf} from '../../utils/utils'
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild
} from "@angular/core";
import {SessionService} from "./session.service";
import {MatDialog} from "@angular/material/dialog";
import {KEY} from "./keybindings";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig, SprLogo} from "../../spr.config";
import {Session} from "./session";
import {AudioStorageFormatEncoding, AudioStorageType, Project, ProjectUtil} from "../project/project";
import {MessageDialog} from "../../ui/message_dialog";
import {RecordingService} from "../recordings/recordings.service";
import {AudioClip} from "../../audio/persistor";

import {Upload, UploaderStatus, UploaderStatusChangeEvent, UploadHolder} from "../../net/uploader";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {ProjectService} from "../project/project.service";
import {LevelBar, State as LiveLevelState} from "../../audio/ui/livelevel";
import {RecorderCombiPane} from "./recorder_combi_pane";
import {BasicRecorder, ChunkAudioBufferReceiver, MAX_RECORDING_TIME_MS, RECFILE_API_CTX} from "./basicrecorder";
import {ReadyStateProvider, RecorderComponent} from "../../recorder_component";
import {Mode} from "../../speechrecorderng.component";
import {AudioBufferSource, AudioDataHolder, AudioSource} from "../../audio/audio_data_holder";
import {ArrayAudioBuffer} from "../../audio/array_audio_buffer";
import {NetAudioBuffer} from "../../audio/net_audio_buffer";
import {IndexedDbAudioBuffer} from "../../audio/inddb_audio_buffer";
import {BreakpointObserver} from "@angular/cdk/layout";
import {SprLogger} from "../../utils/logger";
import {SprTranslator} from "../../i18n/translate";

export const enum Status {
  BLOCKED, IDLE,STARTING, RECORDING,  STOPPING_STOP, ERROR
}


@Component({
    selector: 'app-audiorecorder',
    providers: [SessionService],
    template: `
    <app-warningbar [show]="isTestSession()" [warningText]="i18n.t('spr.warning.testRecording')"></app-warningbar>
    <app-warningbar [show]="isDefaultAudioTestSession()" severity="caution"
    [warningText]="i18n.t('spr.warning.defaultDevice')"></app-warningbar>
    <app-recordercombipane (selectedRecordingFileChanged)="selectRecordingFile($event)"
      [audioSignalCollapsed]="audioSignalCollapsed"
      [selectedRecordingFile]="displayRecFile"
      [selectDisabled]="isActive()"
      [displayAudioClip]="displayAudioClip"
      [playStartAction]="controlAudioPlayer?.startAction"
      [playStopAction]="controlAudioPlayer?.stopAction"
      [playSelectionAction]="controlAudioPlayer?.startSelectionAction"
      [autoPlayOnSelectToggleAction]="controlAudioPlayer?.autoPlayOnSelectToggleAction"
    ></app-recordercombipane>

    <div [class]="{audioStatusDisplay:!screenXs,audioStatusDisplayXs:screenXs}">
      <audio-levelbar style="flex:1 0 1%" [streamingMode]="isRecording() || keepLiveLevel" [state]="liveLevelDisplayState"
      [displayLevelInfos]="displayAudioClip?.levelInfos"></audio-levelbar>
      <div style="display:flex;flex-direction: row">
        <spr-recordingitemcontrols style="flex:10 0 1px"
          [disableAudioDetails]="disableAudioDetails"
          [audioLoaded]="audioLoaded"
          [playStartAction]="controlAudioPlayer?.startAction"
          [playStopAction]="controlAudioPlayer?.stopAction"
          [peakDbLvl]="peakLevelInDb"
          [agc]="this.ac?.agcStatus"
          (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed">
        </spr-recordingitemcontrols>

        @if (screenXs && enableUploadRecordings) {
          <app-uploadstatus class="ricontrols dark" style="flex:0 0 0"
            [value]="uploadProgress"
          [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        }
        @if (screenXs) {
          <app-wakelockindicator class="ricontrols dark" style="flex:0 0 0" [screenLocked]="screenLocked"></app-wakelockindicator>
        }
        @if (screenXs) {
          <app-readystateindicator class="ricontrols dark" style="flex:0 0 0"
          [ready]="dataSaved && !isActive()"></app-readystateindicator>
        }
      </div>
    </div>
    <div #controlpanel class="controlpanel">
      @if (leadingLogos) {
        <spr-logos class="spr-leading" [logos]="leadingLogos" [height]="26"></spr-logos>
      }
      @if (!screenXs) {
        <app-sprstatusdisplay style="flex:0 1 30%;" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"
          [statusWaiting]="statusWaiting"
        class="hidden-xs"></app-sprstatusdisplay>
      }
      <div [class.startstop]="!screenXs" [class.startstopscreenxs]="screenXs">
        <div style="align-content: center">
          <button (click)="startStopPerform()" [disabled]="startDisabled() && stopDisabled()" mat-raised-button class="bigbutton">
            <mat-icon class="bigbuttonicon" [style.color]="startStopNextIconColor()">{{startStopNextIconName()}}</mat-icon>
            <span class="bigbuttontext">{{startStopNextName()}}</span>
          </button>
        </div>
      </div>
      <div style="flex:0 1 30%;display:flex;justify-items: flex-end;justify-content:flex-end" >
        @if (controlLogos) {
          <spr-logos class="spr-separator" [logos]="controlLogos" [height]="26"></spr-logos>
        }
        @if (!screenXs && enableUploadRecordings) {
          <app-uploadstatus class="ricontrols"
            [value]="uploadProgress"
          [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        }
        @if (!screenXs) {
          <app-wakelockindicator  class="ricontrols" [screenLocked]="screenLocked"></app-wakelockindicator>
        }
        @if (!screenXs) {
          <app-readystateindicator class="ricontrols"
          [ready]="dataSaved && !isActive()"></app-readystateindicator>
        }
      </div>
    </div>
    `,
    styles: [`:host {
    flex: 2;
    background: var(--spr-page, #EEF1F5);
    color: var(--spr-ink, #1F3044);
    display: flex; /* Vertical flex container: Bottom transport panel, above prompting panel */
    flex-direction: column;
    margin: 0;
    padding: 0;
    height: 100%;
    min-height: 0px;
      /* Prevents horizontal scroll bar on swipe right */
      overflow: hidden;
  }`, `.ricontrols {
        padding: 4px;
        box-sizing: border-box;
        height: 100%;
    }`, `.dark {
    background: transparent;
    color: var(--spr-canvas-ink, #FFFFFF);
  }`, `.controlpanel {
    display:flex;
    flex-direction: row;
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    background: var(--spr-surface, #FFFFFF);
    border-top: 1px solid var(--spr-border, #D8DFE8);
    color: var(--spr-ink, #1F3044);
    min-height: min-content; /* important */
  }`, `.startstop {
    width: 100%;
    flex:1 0 30%;
    align-items: center;
    text-align: center;
    align-content: center;
  }`, `.startstopscreenxs {
    width: 100%;
    flex:1 0 100%;
    align-items: center;
    text-align: center;
    align-content: center;
  }`, `.bigbutton {
    vertical-align: middle;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
    letter-spacing: normal;
    min-width: 70px;
    min-height: 50px;
    padding: 0 20px;
    background: var(--spr-primary, #2A4765);
    color: var(--spr-primary-ink, #FFFFFF);
    border-radius: 17px;
    box-shadow: var(--spr-shadow-cta, 0 12px 22px rgba(42, 71, 101, 0.22));
  }`, `.bigbutton:disabled {
    background: var(--spr-disabled-bg, rgba(42, 71, 101, 0.06));
    color: var(--spr-ink-disabled, #6D7C98);
    box-shadow: none;
  }`, `.bigbuttonicon {
    min-width: 34px;
    min-height: 34px;
    font-size: 34px;
    width: 34px;
    height: 34px;
  }`, `.bigbuttontext {
      font-weight: 700;
      font-size: var(--spr-type-body, 16px);
      vertical-align: middle;
  }
  `, `.audioStatusDisplay{
    display:flex;
    flex-direction: row;
    height:100px;
    min-height: 100px;
    background: var(--spr-canvas, #0E1A26);
    color: var(--spr-canvas-ink, #FFFFFF);
  }`, `.audioStatusDisplayXs{
    display:flex;
    flex-direction: column;
    height:125px;
    min-height: 125px;
    background: var(--spr-canvas, #0E1A26);
    color: var(--spr-canvas-ink, #FFFFFF);
  }`
    ],
    standalone: false
})
export class AudioRecorder extends BasicRecorder implements OnInit,AfterViewInit,OnDestroy, AudioCaptureListener,ReadyStateProvider,ChunkAudioBufferReceiver {

  /** Marks for the transport bar, configured by the deploying application. */
  get controlLogos(): SprLogo[] | undefined {
    const logos = this.config?.branding?.controls;
    return logos && logos.length ? logos : undefined;
  }

  /** Marks at the left end of the bar, ahead of the status message. */
  get leadingLogos(): SprLogo[] | undefined {
    const logos = this.config?.branding?.controlsLeft;
    return logos && logos.length ? logos : undefined;
  }


  _project:Project|undefined| null=null;
  @Input() projectName:string|undefined|null=null;
  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status = Status.BLOCKED;

  @ViewChild(RecorderCombiPane, { static: true }) recorderCombiPane!: RecorderCombiPane;
  @ViewChild(LevelBar, { static: true }) liveLevelDisplay!: LevelBar;

  @Input() dataSaved=true




  startStopNextButtonName!:string;
  startStopNextButtonIconName!:string;

  audio: any;

  private _displayRecFile: RecordingFile | null=null;
  private displayRecFileVersion: number=0;


  constructor(protected bpo:BreakpointObserver,changeDetectorRef: ChangeDetectorRef,
              private renderer: Renderer2,
              dialog: MatDialog,
              sessionService:SessionService,
              private recFileService:RecordingService,
              protected uploader: SpeechRecorderUploader,
              i18n: SprTranslator,
              @Inject(SPEECHRECORDER_CONFIG) config?: SpeechRecorderConfig) {
    super(bpo,changeDetectorRef,dialog,sessionService,uploader,i18n,config);

    //super(injector);
    this.status = Status.IDLE;

    this.audio = document.getElementById('audio');

    if (this.config && this.config.enableUploadRecordings != null) {
      this.enableUploadRecordings = this.config.enableUploadRecordings;
    }
    if (this.config && this.config.enableDownloadRecordings != null) {
      this.enableDownloadRecordings = this.config.enableDownloadRecordings;
    }
    //this.init();
  }


  ngAfterViewInit() {

    this.streamLevelMeasure.levelListener = this.liveLevelDisplay;
    this.streamLevelMeasure.peakLevelListener=(peakLvlInDb)=>{
      this.peakLevelInDb=peakLvlInDb;
      this.changeDetectorRef.detectChanges();
    }
    //let wakeLockSupp=('wakeLock' in navigator);
    //alert('Wake lock API supported: '+wakeLockSupp);
  }

  ready():boolean{
    return this.dataSaved && !this.isActive()
  }
    ngOnDestroy() {
      this.disableWakeLockCond();
       this.destroyed=true;
       // TODO stop capture /playback
    }

  ngOnInit() {
    this.transportActions.startAction.disabled = true;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.playStartAction.disabled = true;

      this.ac = new AudioCapture(this.i18n);
      if (this.ac) {
        this.transportActions.startAction.onAction = () => this.startItem();
        this.ac.listener = this;
        this.configureStreamCaptureStream();

        // Don't list the devices here. If we do not have audio permissions we only get anonymized devices without labels.
        //this.ac.listDevices();
      } else {
        this.transportActions.startAction.disabled = true;
        let errMsg = 'Browser does not support Media/Audio API!';
        this.statusMsg = 'ERROR: ' + errMsg;
        this.statusAlertType = 'error';
        this.dialog.open(MessageDialog, {
          data: {
            type: 'error',
            title: this.i18n.t('spr.dialog.unsupportedBrowserTitle'),
            msg: errMsg,
            advice: this.i18n.t('spr.dialog.unsupportedBrowserAdvice'),
          }
        });
        return;
      }
      this.transportActions.stopAction.onAction = () => this.stopItem();
      this.transportActions.nextAction.onAction = () => this.stopItem();
      //this.transportActions.pauseAction.onAction = () => this.pauseItem();

      this.playStartAction.onAction = () => this.controlAudioPlayer?.start();

    this.uploader.listener = (ue) => {
      this.uploadUpdate(ue);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ke: KeyboardEvent) {
    if (ke.key == KEY.START_STOP) {
      if(!this.transportActions.startAction.disabled){
        this.transportActions.startAction.perform();
      }else if(!this.transportActions.stopAction.disabled) {
        this.transportActions.stopAction.perform();
      }
    }
    if (ke.key == KEY.PAUSE) {
      this.transportActions.pauseAction.perform();
    }
    if (ke.key == KEY.STOP) {
      if (!this.audioSignalCollapsed) {
        this.audioSignalCollapsed = true;
      }
      this.transportActions.stopAction.perform();
      this.transportActions.pauseAction.perform();
    }

    if (ke.key == KEY.PLAY) {
      this.playStartAction.perform();
    }
    if (ke.key === KEY.FORWARD) {
      this.transportActions.fwdAction.perform();
    }
    if (ke.key === KEY.BACKWARD) {
      this.transportActions.bwdAction.perform();
    }
  }

  isTestSession():boolean {
    return ((this._session!=null) && (this._session.type === 'TEST' || this._session.type==='TEST_DEF_A' || this._session.type === 'SINUS_TEST'));
  }

  isDefaultAudioTestSession():boolean {
    return ((this._session!=null) && (this._session.type==='TEST_DEF_A'));
  }

  isDefaultAudioTestSessionOverwriteingProjectRequirements():boolean {
    return ((this._session!=null) && (this._session.type==='TEST_DEF_A') && (this.audioDevices!=null) && this.audioDevices.length>0)
  }



  fetchRecordings(sess:Session){
    this.statusAlertType='info';
    this.statusMsg = 'Fetching infos of recordings...';
    this.statusWaiting=true;
    //let prNm:string|null=null;
    if(this.project) {
      let rfsObs = this.recFileService.recordingFileList(this.project.name, sess.sessionId);
      rfsObs.subscribe({next:(rfs: Array<RecordingFile>) => {
        this.statusAlertType = 'info';
        this.statusMsg = 'Received infos of recordings.';
        this.statusWaiting = false;
        if (rfs) {
          if (rfs instanceof Array) {
            rfs.forEach((rf) => {
              // the list comes from the server, asssuem all recording files as server persisted
              rf.serverPersisted=true;
              if(rf.startedDate){
                rf._startedAsDateObj=new Date(rf.startedDate);
              }
              if(rf.date){
                rf._dateAsDateObj=new Date(rf.date);
              }
              this.recorderCombiPane.addRecFile(rf);
            })
          } else {
            SprLogger.error('Expected type array for list of already recorded files ')
          }

        } else {
          //console.debug("Recording file list: " + rfs);
        }
      }, error:(err) => {
        // Failed fetching existing, but we start the session anyway
        this.start()
      }, complete:() => {
        // Normal start
        this.start()
      }
    })
    }else{
      // No project def -> error
      this.statusAlertType = 'error';
      this.statusMsg = 'No project definiton.';
      this.statusWaiting = false;
      SprLogger.error(this.statusMsg);
    }
  }


  set project(project: Project|undefined|null) {
    this._project = project;
    let chCnt = ProjectUtil.DEFAULT_AUDIO_CHANNEL_COUNT;

    if (project) {
      SprLogger.info("Project name: " + project.name)
      if (project.recordingDeviceWakeLock === true) {
        this.wakeLock = true;
      }
      this.audioDevices = project.audioDevices;
      chCnt = ProjectUtil.audioChannelCount(project);
      SprLogger.info("Project requested recording channel count: " + chCnt);
      this.autoGainControlConfigs = project.autoGainControlConfigs;
      if(project.allowEchoCancellation!==undefined) {
        this.allowEchoCancellation = project.allowEchoCancellation;
      }
      if (project.chunkedRecording === true) {
        this.uploadChunkSizeSeconds = BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;
      } else {
        this.uploadChunkSizeSeconds = null;
      }
      if (project.clientAudioStorageType) {
        this.clientAudioStorageType = project.clientAudioStorageType;
      }
    } else {
      SprLogger.error("Empty project configuration!")
    }
    this.channelCount = chCnt;
  }


  get project():Project|undefined|null{
    return this._project;
  }

  selectRecordingFile(rf:RecordingFile){
    this.liveLevelDisplayState=LiveLevelState.READY;
    this.keepLiveLevel=false;
    this.displayRecFile=rf;
  }

  uploadUpdate(ue: UploaderStatusChangeEvent) {
    let upStatus = ue.status;
    this.dataSaved = (UploaderStatus.DONE === upStatus);
    let percentUpl = ue.percentDone();
    if (UploaderStatus.ERR === upStatus) {
      this.uploadStatus = 'warn'
    } else {
      if (percentUpl < 50) {
        this.uploadStatus = 'accent'
      } else {
        this.uploadStatus = 'success'
      }
      this.uploadProgress = percentUpl;
    }

    this.changeDetectorRef.detectChanges()
  }

  set controlAudioPlayer(controlAudioPlayer: AudioPlayer|null) {
    this._controlAudioPlayer=controlAudioPlayer;
    if (this._controlAudioPlayer) {
      this._controlAudioPlayer.listener = this;
    }
  }

  get controlAudioPlayer(): AudioPlayer|null {
    return this._controlAudioPlayer;
  }

  update(e: AudioPlayerEvent) {
    if (e.type == EventType.STARTED) {
      this.playStartAction.disabled = true;
      this.updateTimerId = window.setInterval(() => {
        //this.audioSignal.playFramePosition = this.ap.playPositionFrames;
      }, 50);
    } else if (e.type == EventType.STOPPED || e.type == EventType.ENDED) {
      window.clearInterval(this.updateTimerId);
      //console.debug("Enable play start action (by player events stopped or ended): "+(!(this.displayRecFile)));
      this.playStartAction.disabled = (!(this.displayRecFile));

    }
  }

  startDisabled() {
    return !this.transportActions || this.readonly || this.transportActions.startAction.disabled
  }

  stopDisabled() {
    return !this.transportActions || this.transportActions.stopAction.disabled
  }

  startStopNextName():string{
    if(!this.startDisabled()){
      this.startStopNextButtonName=this.i18n.t('spr.transport.start')
    }else if(!this.stopDisabled()) {
      this.startStopNextButtonName = this.i18n.t('spr.transport.stop')
    }
    return this.startStopNextButtonName;
  }
  startStopNextIconName():string{
    if(!this.startDisabled()){
      this.startStopNextButtonIconName="fiber_manual_record"
    }else if(!this.stopDisabled()){
      this.startStopNextButtonIconName="stop"
    }
    return this.startStopNextButtonIconName
  }
  startStopNextIconColor():string{
    if(!this.startDisabled()){
      return "var(--spr-ok, #73A790)"
    }else if(!this.stopDisabled()){
      return "var(--spr-caution, #D7B17C)"
    }else{
      return "var(--spr-chrome-ink-muted, rgba(255, 255, 255, 0.62))";
    }
  }

  startStopPerform(){
    if(!this.startDisabled()){
      this.transportActions.startAction.perform();
    }else if(!this.stopDisabled()){
      this.transportActions.stopAction.perform();
    }
  }

  startItem() {
    this.status=Status.STARTING;
    super.startItem();
    if (this.readonly) {
      this.status=Status.IDLE;
      return
    }
    this.transportActions.fwdAction.disabled = true
    this.transportActions.fwdNextAction.disabled = true
    this.transportActions.bwdAction.disabled = true
    this.displayRecFile = null;
    this.displayRecFileVersion = 0;
    this.displayAudioClip = null;
    this.liveLevelDisplay.reset(true);
    this.liveLevelDisplayState=LiveLevelState.READY;
    this.showRecording();

    this.startCapture();
  }


  downloadRecording() {
    if (this.displayRecFile) {
      let ab: AudioDataHolder | null = this.displayRecFile.audioDataHolder;
      const ww = new WavWriter(this.project?.mediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this.project?.mediaStorageFormat?.audioPCMsampleSizeInBits);
      let as=ab?.audioSource;
      if(as instanceof AudioBufferSource) {
          ww.writeAsync(as.audioBuffer, (wavFile) => {
            let blob = new Blob([wavFile], {type: 'audio/wav'});
            let rfUrl = URL.createObjectURL(blob);

            let dataDnlLnk = this.renderer.createElement('a');
            //dataDnlLnk.name = 'Recording';
            dataDnlLnk.href = rfUrl;

            this.renderer.appendChild(document.body, dataDnlLnk);

            // download property not yet in TS def
            if (this.displayRecFile) {
              let fn = this.displayRecFile.filenameString();
              fn += '_' + this.displayRecFileVersion;
              fn += '.wav';
              dataDnlLnk.download = fn;
              dataDnlLnk.click();
            }
            this.renderer.removeChild(document.body, dataDnlLnk);
          });
      }
    }
  }

  set displayRecFile(displayRecFile: RecordingFile | null) {
    //this.audioLoaded=false;
    this.liveLevelDisplay.playFramePosition =null;
    this._displayRecFile = displayRecFile;
    if (this._displayRecFile) {
      let adh: AudioDataHolder| null = this._displayRecFile.audioDataHolder;
      if(adh) {
        this.displayAudioClip = new AudioClip(adh);
        //this.audioLoaded=true;
        //console.debug(" set recording file: display audio clip set");
        if(this._controlAudioPlayer) {
          this._controlAudioPlayer.audioClip = this.displayAudioClip;
        }
        this.showRecording();
      }else {
        // clear for now ...
        this.displayAudioClip = null;
        //console.debug("set recording file: display audio clip null");
        if(this._controlAudioPlayer) {
          this._controlAudioPlayer.audioClip = null;
        }

        if (this._controlAudioPlayer && this._session) {
          //... and try to fetch from server
          this.liveLevelDisplayState=LiveLevelState.LOADING;
          const rf=this._displayRecFile;

          let audioDownloadType=this._clientAudioStorageType;
          if(AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED===this._clientAudioStorageType || AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED===this._clientAudioStorageType) {
            // Default is network mode
            audioDownloadType=AudioStorageType.NET_CHUNKED;
            if (rf.channels && rf.frames) {
              const samples = rf.channels * rf.frames;
              if (samples <= this._maxAutoNetMemStoreSamples) {
                // But if audio file is small, load in continuous resp. chunked mode
                if(AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED===this._clientAudioStorageType){
                  audioDownloadType=AudioStorageType.MEM_ENTIRE;
                }else if(AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED===this._clientAudioStorageType) {
                  audioDownloadType = AudioStorageType.MEM_CHUNKED;
                }
              }
            }
          }

          if(AudioStorageType.DB_CHUNKED===this._clientAudioStorageType){
            // Fetch chunked indexed db audio buffer
            let nextIab: IndexedDbAudioBuffer | null = null;
            if(!this._persistentAudioStorageTarget){
              throw Error('Error: Persistent storage target not set.');
            }else {
              //console.debug("Fetch audio and store to indexed db...");
              this.audioFetchSubscription = this.recFileService.fetchRecordingFileIndDbAudioBuffer(this._persistentAudioStorageTarget, this._session.project, rf).subscribe({
                next: (iab) => {
                  //console.debug("Sessionmanager: Received inddb audio buffer: "+iab);
                  nextIab = iab;
                },
                complete: () => {
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  let fabDh = null;
                  if (nextIab) {
                    if (rf ) {
                      fabDh = new AudioDataHolder(nextIab);
                      //this.audioLoaded=true;
                      this.recorderCombiPane.setRecFileAudioData(rf, fabDh);
                    }
                  } else {
                    // Should actually be handled by the error resolver
                    this.statusMsg = 'Recording file could not be loaded.'
                    this.statusAlertType = 'error'
                  }
                  if (fabDh) {
                    // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore, there should be no risk to set to wrong item
                    this.displayAudioClip = new AudioClip(fabDh);
                  }
                  if(this._controlAudioPlayer) {
                    this._controlAudioPlayer.audioClip = this.displayAudioClip
                  }
                  this.showRecording();
                },
                error: err => {
                  SprLogger.error("Could not load recording file from server: " + err);
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  this.statusMsg = 'Recording file could not be loaded: ' + messageOf(err);
                  this.statusAlertType = 'error';
                  this.changeDetectorRef.detectChanges();
                }
              });
            }
          }else if(AudioStorageType.NET_CHUNKED===audioDownloadType){
            // Fetch chunked audio buffer from network
            let nextNetAb: NetAudioBuffer | null = null;

            //console.debug("Fetch chunked audio from network");
            this.audioFetchSubscription = this.recFileService.fetchRecordingFileNetAudioBuffer( this._session.project, rf).subscribe({
              next: (netAb) => {
                //console.debug("Sessionmanager: Received net audio buffer: "+netAb);
                nextNetAb = netAb;
              },
              complete: () => {
                this.liveLevelDisplayState = LiveLevelState.READY;
                let fabDh = null;
                if (nextNetAb) {
                  if (rf) {
                    fabDh = new AudioDataHolder(nextNetAb);

                    this.recorderCombiPane.setRecFileAudioData(rf, fabDh);
                  }
                } else {
                  // Should actually be handled by the error resolver
                  this.statusMsg = 'Recording file could not be loaded.'
                  this.statusAlertType = 'error'
                }
                if (fabDh) {
                  // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore, there should be no risk to set to wrong item
                  //console.debug("set displayRecFile(): fetch net ab complete, set displayAudioClip.")
                  this.displayAudioClip = new AudioClip(fabDh);
                  // fabDh.onReady=()=>{
                  //   this.audioLoaded=true;
                  // }
                }
                if(this._controlAudioPlayer) {
                  this._controlAudioPlayer.audioClip = this.displayAudioClip;
                }
                this.showRecording();
              },
              error: err => {
                SprLogger.error("Could not load recording file from server: " + err);
                this.liveLevelDisplayState = LiveLevelState.READY;
                this.statusMsg = 'Recording file could not be loaded: ' + messageOf(err);
                this.statusAlertType = 'error';
                this.changeDetectorRef.detectChanges();
              }
            });

          }else if(AudioStorageType.MEM_CHUNKED===audioDownloadType){
            // Fetch chunked array audio buffer
            let nextAab: ArrayAudioBuffer | null = null;
            //console.debug("Fetch audio and store to (chunked) array buffer...");
            this.audioFetchSubscription = this.recFileService.fetchRecordingFileArrayAudioBuffer( this._session.project, rf).subscribe({
              next: (aab) => {
                nextAab = aab;
              },
              complete: () => {
                this.liveLevelDisplayState = LiveLevelState.READY;
                let fabDh = null;
                if (nextAab) {
                  if (rf ) {
                    fabDh = new AudioDataHolder(nextAab);
                    this.recorderCombiPane.setRecFileAudioData(rf, fabDh);
                  }
                } else {
                  // Should actually be handled by the error resolver
                  this.statusMsg = 'Recording file could not be loaded.'
                  this.statusAlertType = 'error'
                }
                if (fabDh) {
                  // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore, there should be no risk to set to wrong item
                  this.displayAudioClip = new AudioClip(fabDh);
                  //this.audioLoaded=true;
                }
                if(this._controlAudioPlayer) {
                  this._controlAudioPlayer.audioClip = this.displayAudioClip;
                }
                this.showRecording();
              },
              error: err => {
                SprLogger.error("Could not load recording file from server: " + err);
                this.liveLevelDisplayState = LiveLevelState.READY;
                this.statusMsg = 'Recording file could not be loaded: ' + messageOf(err);
                this.statusAlertType = 'error';
              }
            });

          } else {
            this.audioFetchSubscription = this.recFileService.fetchRecordingFileAudioBuffer(this._session.project, rf).subscribe({
              next: ab => {
                this.liveLevelDisplayState = LiveLevelState.READY;
                let fabDh = null;
                if (ab) {
                  let abSrc=new AudioBufferSource(ab);
                  if (rf) {
                    fabDh = new AudioDataHolder(abSrc);
                    this.recorderCombiPane.setRecFileAudioData(rf, fabDh);
                  }
                } else {
                  SprLogger.error('Recording file could not be loaded.');
                  this.statusMsg = 'Recording file could not be loaded.';
                  this.statusAlertType = 'error';
                }
                if (fabDh) {
                  // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore, there should be no risk to set to wrong item
                  this.displayAudioClip = new AudioClip(fabDh);
                  //this.audioLoaded=true;
                  //console.debug("set recording file: display audio clip from fetched audio buffer");
                }
                if(this._controlAudioPlayer) {
                  this._controlAudioPlayer.audioClip = this.displayAudioClip;
                }
                this.showRecording();
              }, error: err => {
                SprLogger.error("Could not load recording file from server: " + err);
                this.liveLevelDisplayState = LiveLevelState.READY;
                this.statusMsg = 'Recording file could not be loaded: ' + messageOf(err);
                this.statusAlertType = 'error';
              }
            })
          }
        }else{
          this.statusMsg = 'Recording file could not be decoded. Audio context unavailable.';
          this.statusAlertType = 'error';
        }
      }

    } else {
      //console.debug("recording file null");
      this.displayAudioClip = null;
      if(this._controlAudioPlayer) {
        this._controlAudioPlayer.audioClip = null;
      }
    }
    this.showRecording();
  }

  get displayRecFile(): RecordingFile | null {
    return this._displayRecFile;
  }

  updateStartActionDisableState(){
    this.transportActions.startAction.disabled=!(this.ac);
  }

  start() {
    super.start();
    this.recorderCombiPane.selectTop();
    this.enableNavigation();
    this.updateStartActionDisableState();

  }

  isRecording(): boolean {
    return (this.status === Status.RECORDING || this.status===Status.STOPPING_STOP);
  }

  isActive(): boolean{
    return (!(this.status === Status.BLOCKED || this.status=== Status.IDLE || this.status===Status.ERROR) || this.processingRecording || this.sessionService.uploadCount>0)
  }

  /**
   * The capture may be reopened for another device only between takes: `isActive()` also covers
   * pending uploads, which do not depend on the microphone and must not block a switch.
   */
  protected override isBusyRecording(): boolean {
    return !(this.status === Status.BLOCKED || this.status === Status.IDLE
      || this.status === Status.ERROR);
  }


  updateWakeLock(dataSaved:boolean=this.dataSaved){
    //console.debug("Update wake lock: dataSaved: "+dataSaved+", not active: "+! this.isActive())
    if(dataSaved && ! this.isActive()){
      this.disableWakeLockCond();
    }
  }

  private updateNavigationActions(){

    this.transportActions.fwdAction.disabled = this.navigationDisabled;
    this.transportActions.bwdAction.disabled = this.navigationDisabled;
  }

  enableStartUserGesture() {
    super.enableStartUserGesture();
    this.transportActions.startAction.disabled=!(this.ac);
  }

  enableNavigation(){
    this.navigationDisabled=false;
    this.updateNavigationActions();
  }

  started() {
    this.status = Status.RECORDING;
    super.started();
    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

    let sessId: string | number = 0;
    if(this._session){
      sessId=this._session.sessionId;
    }

    if(this.rfUuid) {
      let rf = new RecordingFile(this.rfUuid, sessId, null);
      rf._startedAsDateObj = this.startedDate;
      if (rf._startedAsDateObj) {
        rf.startedDate = rf._startedAsDateObj.toString();
      }
      this._recordingFile = rf;
    }
    let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
    this.maxRecTimerId = window.setTimeout(() => {
      this.stopRecordingMaxRec()
    }, maxRecordingTimeMs);
    this.maxRecTimerRunning = true;
    this.transportActions.stopAction.disabled = false;
  }

  stopItem() {

    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.status = Status.STOPPING_STOP;
    this.stopRecording();

  }

  stopRecording() {
    if (this.maxRecTimerRunning && this.maxRecTimerId!=null) {
      window.clearTimeout(this.maxRecTimerId);
      this.maxRecTimerRunning = false;
    }
    if(this.ac) {
      this.ac.stop();
    }
  }

  stopRecordingMaxRec(){

    this.maxRecTimerRunning = false;
    this.status = Status.STOPPING_STOP;
    if(this.ac) {
      this.ac.stop();
    }
  }

  stopped() {
    this.updateStartActionDisableState()
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = this.i18n.t('spr.status.recorded');

    let ab:AudioBuffer|null=null;

    if(this.ac) {
      let adh:AudioDataHolder|null=null;
      let as:AudioSource|null=null;
      if(this.ac) {
        if (AudioStorageType.NET_CHUNKED === this.ac.audioStorageType) {
          this.playStartAction.disabled = true;
          //this.audioLoaded=false;
          this.keepLiveLevel=true;
          let rUUID:string|null=null;
            let burl:string|null=null;
            if(this._session) {
              if (this._recordingFile) {

                let rf = this._recordingFile;
                rf.frames=this.ac.framesRecorded;
                rUUID=rf.uuid;
                //console.debug("stopped(): Set frames: "+rf.frames+" on rfId: "+this.displayRecFile?.recordingFileId);
                burl = this.recFileService.audioFileUrl(this._session?.project, rf);
              } else if (this.session?.project) {
                if(this.ac.recUUID) {
                  rUUID=this.ac.recUUID;
                  burl = this.recFileService.audioFileUrlByUUID(this.session.project, this.session.sessionId, rUUID);
                }
              }else{
                SprLogger.error("Could not create net audio buffer.");
              }
              if (burl) {
                const sr = this.ac.currentSampleRate;
                const chFl=sr*RecordingService.DEFAULT_CHUNKED_DOWNLOAD_SECONDS;
                //console.debug("stopped(): rfID: "+this._recordingFile?.recordingFileId+", net ab url: " + burl+", frames: "+this.ac.framesRecorded+", sample rate: "+sr);
                let netAs = new NetAudioBuffer(this.recFileService, burl, this.ac.channelCount, sr, chFl, this.ac.framesRecorded, rUUID, chFl);
                as=netAs;
                if(this.uploadSet){
                  this.uploadSet.onDone=(uploadSet)=>{
                    //console.debug("upload set on done: Call ready provider.ready");
                    netAs.ready();
                  }
                  this.uploadSet.onFail=(uploadSet)=>{
                    this.error('Upload failed. Recordings were not stored on the server.','Please check your connection and retry.');
                  }
                }

              }
            }

        }else if (AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED === this.ac.audioStorageType || AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED === this.ac.audioStorageType) {
          if (AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED === this.ac.audioStorageType){
            const acAb=this.ac.audioBuffer();
            if(acAb) {
              as = new AudioBufferSource(acAb);
            }
          }
          if(AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED === this.ac.audioStorageType){
            as = this.ac.audioBufferArray();
          }
          if(!as){
            this.playStartAction.disabled = true;
            this.keepLiveLevel=true;
            let rUUID:string|null=null;
            let burl:string|null=null;
            if(this._session) {
              if (this._recordingFile) {
                let rf = this._recordingFile;
                rf.frames=this.ac.framesRecorded;
                rUUID=rf.uuid;
                //console.debug("stopped(): Set frames: "+rf.frames+" on rfId: "+this.displayRecFile?.recordingFileId);
                burl = this.recFileService.audioFileUrl(this._session?.project, rf);
              } else if (this.session?.project) {
                if(this.ac.recUUID) {
                  rUUID=this.ac.recUUID;
                  burl = this.recFileService.audioFileUrlByUUID(this.session.project, this.session.sessionId, rUUID);
                }
              }else{
                SprLogger.error("Could not create net audio buffer.");
              }
              if (burl) {
                const sr = this.ac.currentSampleRate;
                const chFl=sr*RecordingService.DEFAULT_CHUNKED_DOWNLOAD_SECONDS;
                //console.debug("stopped(): rfID: "+this._recordingFile?.recordingFileId+", net ab url: " + burl+", frames: "+this.ac.framesRecorded+", sample rate: "+sr);
                let netAs = new NetAudioBuffer(this.recFileService, burl, this.ac.channelCount, sr, chFl, this.ac.framesRecorded, rUUID, chFl);
                as = netAs;
                if (this.uploadSet) {
                  this.uploadSet.onDone = (uploadSet) => {
                    //console.debug("upload set on done: Call ready provider.ready");
                    netAs.ready();
                  }
                  this.uploadSet.onFail = (uploadSet) => {
                    this.error('Upload failed. Recordings were not stored on the server.','Please check your connection and retry.');
                  }
                }
              }
            }
          }
        } else if (AudioStorageType.DB_CHUNKED === this.ac.audioStorageType) {
          as = this.ac.inddbAudioBufferArray();
        } else if (AudioStorageType.MEM_CHUNKED === this.ac.audioStorageType) {
          as = this.ac.audioBufferArray();
        } else {
          ab = this.ac.audioBuffer();
          if(ab) {
            as = new AudioBufferSource(ab);
          }
        }
        if (as) {
          adh = new AudioDataHolder(as);
        }
      }

      let sessId: string | number = 0;
      if(this._session){
        sessId=this._session.sessionId;
      }

      if(this._recordingFile) {
        //this._recordingFile.samplerate=this.ac.currentSampleRate;
        // Use an own reference since the writing of the wave file is asynchronous and this._recordingFile might already contain the next recording
        let rf = this._recordingFile;
        RecordingFileUtils.setAudioData(rf,adh);
        this.recorderCombiPane.addRecFile(rf);

        // Upload if upload enabled and not in chunked upload mode
        if (this.enableUploadRecordings && this._uploadChunkSizeSeconds===null && AudioStorageType.MEM_ENTIRE===this._clientAudioStorageType && rf != null && ab != null) {
          let apiEndPoint = '';

          if (this.config && this.config.apiEndPoint) {
            apiEndPoint = this.config.apiEndPoint;
          }
          if (apiEndPoint !== '') {
            apiEndPoint = apiEndPoint + '/'
          }

          let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
          let recUrl: string = sessionsUrl + '/' + encodeURIComponent(rf.session ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(rf.uuid ?? '');

          // convert asynchronously to 16-bit integer PCM
          // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
          // TODO duplicate conversion for manual download

          this.processingRecording = true
          const ww = new WavWriter(this.project?.mediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this.project?.mediaStorageFormat?.audioPCMsampleSizeInBits);
          ww.writeAsync(ab, (wavFile) => {
            this.postRecordingMultipart(wavFile,recUrl,rf);
            this.processingRecording = false;
            this.updateWakeLock();
            this.changeDetectorRef.detectChanges();
          });
        }
      }
    }
    this.displayRecFile = this._recordingFile;
    this.status = Status.IDLE;
    this.navigationDisabled = false;
    this.updateNavigationActions();
    this.updateWakeLock();
    this.changeDetectorRef.detectChanges();
  }

  error(msg=this.i18n.t('spr.dialog.unknownError'),advice:string=this.i18n.t('spr.dialog.retryAdvice')) {
    this.status=Status.ERROR;
    super.error(msg,advice);
    this.updateNavigationActions();
    this.updateStartActionDisableState();
  }

  postRecordingMultipart(wavFile: ArrayBuffer,recUrl: string,rf:RecordingFile) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});

    let fd=new FormData();
    if(rf.uuid) {
      fd.set('uuid', rf.uuid);
    }
    if(rf.session!==null) {
      fd.set('sessionId', rf.session.toString());
    }
    if(rf._startedAsDateObj){
      fd.set('startedDate',rf._startedAsDateObj.toJSON());
    }
    fd.set('audio',wavBlob);
    let ul = new Upload(fd, recUrl,rf);
    this.uploader.queueUpload(ul);
  }

  postChunkAudioBuffer(buffers: Array<Float32Array>, sampleRate: number, chunkIdx: number): void {
    this.processingRecording = true;

    // The upload holder is required to add the upload now to the upload set. The real upload is created async in postrecording and the upload set is already complete at that time.
    let ulh=new UploadHolder();
    if(this.uploadSet){
      this.uploadSet.add(ulh);
    }
    const chunkBaseUrl = this.sessionsBaseUrl() + '/' + encodeURIComponent(this.session?.sessionId ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(this.rfUuid ?? '');
    if (this.config?.uploadConfig?.checkStoredChunkBeforeUpload===true) {
      this.recFileService.chunkStoredRequest(chunkBaseUrl, chunkIdx).subscribe({
        next: (stored: boolean) => {
          if (stored) {
            // server already holds this chunk: mark the upload done without re-posting
            const skipUl = new Upload(new Blob([]), chunkBaseUrl + '/' + chunkIdx);
            ulh.upload = skipUl;
            skipUl.succeeded();
            this.processingRecording = false;
          } else {
            this.encodeAndPostChunk(buffers, sampleRate, chunkIdx, ulh);
          }
        },
        error: () => {
          // stored check failed: fall back to a blind upload (the idempotency key still protects against duplicates)
          this.encodeAndPostChunk(buffers, sampleRate, chunkIdx, ulh);
        }
      });
    } else {
      this.encodeAndPostChunk(buffers, sampleRate, chunkIdx, ulh);
    }
  }

  private encodeAndPostChunk(buffers: Array<Float32Array>, sampleRate: number, chunkIdx: number, ulh: UploadHolder): void {
    const ww = new WavWriter(this.project?.mediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this.project?.mediaStorageFormat?.audioPCMsampleSizeInBits);
    let recUrl: string = this.sessionsBaseUrl() + '/' + encodeURIComponent(this.session?.sessionId ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(this.rfUuid ?? '')+'/'+chunkIdx;
    let rf=this._recordingFile;
    const channels=buffers.length;
    const frameLength=channels>0?buffers[0].length:0;
    ww.writeAsyncPlanar(channels,sampleRate,frameLength,buffers, (wavFile) => {
      this.postRecording(wavFile, recUrl,rf,ulh);
      this.processingRecording = false;
    });
  }

  stop() {
    if(this.ac) {
      this.ac.close();
    }
  }

  private updateControlPlaybackPosition() {
    if(this._controlAudioPlayer){
      const ppFrames=this._controlAudioPlayer.playPositionFrames;
      if (ppFrames!==null) {
        this.recorderCombiPane.audioDisplay.playFramePosition = ppFrames;
      }
      this.liveLevelDisplay.playFramePosition = ppFrames;
    }else{
      this.liveLevelDisplay.playFramePosition =null;
    }
  }

  audioPlayerUpdate(e: AudioPlayerEvent) {
    if (EventType.READY === e.type) {

    } else if (EventType.STARTED === e.type) {
      //this.status = 'Playback...';
      this.updateTimerId = window.setInterval(() => this.updateControlPlaybackPosition(), 50);

    } else if (EventType.ENDED === e.type) {
      //.status='Ready.';
      window.clearInterval(this.updateTimerId);
      this.updateControlPlaybackPosition();

    }
    if(!this.destroyed) {
        this.changeDetectorRef.detectChanges();
    }
  }
}

@Component({
    selector: 'app-audiorecorder-comp',
    providers: [SessionService],
    template: `
    <app-audiorecorder [projectName]="_project?.name" [dataSaved]="dataSaved"></app-audiorecorder>
  `,
    styles: [`:host{
    flex: 2;
    display: flex;
      height: 100%;
    flex-direction: column;
    min-height:0;

  }`],
    standalone: false
})
export class AudioRecorderComponent extends RecorderComponent  implements OnInit,OnDestroy,AfterViewInit,ReadyStateProvider {

  mode!:Mode;
  controlAudioPlayer!:AudioPlayer;
  audio:any;

  _project:Project|undefined;
  sessionId!: string;
  session!:Session;

  @ViewChild(AudioRecorder, { static: true }) ar!:AudioRecorder;

  constructor(private route: ActivatedRoute,
              private router: Router,
              private changeDetectorRef: ChangeDetectorRef,
              private sessionService:SessionService,
              private projectService:ProjectService,
              protected uploader:SpeechRecorderUploader,
              private i18n: SprTranslator
  ) {
    super(uploader);
  }

  ngOnInit() {

    this.controlAudioPlayer = new AudioPlayer(this.ar, this.i18n);

    this.ar.controlAudioPlayer=this.controlAudioPlayer;

    //TODO Duplicate code in SpeechRecorderComponent
    window.addEventListener('beforeunload', (e) => {
      SprLogger.debug("Before page unload event");

      if (this.ready()) {
        return;
      } else {
        // all this attempts to customize the message do not work anymore (for security reasons)!!
        const message = "Please do not leave the page, until all recordings are uploaded!";
        alert(message);
        e = e || window.event;

        if (e) {
          e.returnValue = message;
          e.cancelBubble = true;
          if (e.stopPropagation) {
            e.stopPropagation();
          }
          if (e.preventDefault) {
            e.preventDefault();
          }
        }

        return message;
      }
    });
  }

  ngAfterViewInit() {

    // TODO call prepare !!

    this.uploader.listener = (ue) => {
      this.uploadUpdate(ue);
    }
    this.uploader.restorePersistedUploads().subscribe({
      next: (restored: number) => {
        if (restored > 0) {
          SprLogger.info('Restored ' + restored + ' persisted uploads.');
        }
      },
      error: (err: unknown) => {
        SprLogger.error('Could not restore persisted uploads: ' + err);
      }
    });
    this.route.queryParams.subscribe((params: Params) => {
      if (params['sessionId']) {
        this.fetchSession(params['sessionId']);
      }
    });
    this.route.params.subscribe((params: Params) => {
      let routeParamsId = params['id'];
      if (routeParamsId) {
        this.fetchSession(routeParamsId);
      }
    });
  }

  ngOnDestroy() {
    //super.ngOnDestroy();
  }

  get screenLocked():boolean{
    return  this.ar.screenLocked;
  }

  fetchSession(sessionId:string){

    let sessObs= this.sessionService.sessionObserver(sessionId);

    if(sessObs) {
      sessObs.subscribe({
        next:(sess) => {
          this.ar.statusAlertType='info';
          this.ar.statusMsg = 'Received session info.';
          this.ar.statusWaiting=false;
          this.session=sess;
          this.ar.session=sess;
          if (sess.project) {
            //console.debug("Session associated project: "+sess.project)
            this.projectService.projectObservable(sess.project).subscribe({
              next:(project)=>{
              this.ar.project=project;
              this.ar.fetchRecordings(sess);
            },error:(reason) =>{
              this.ar.statusMsg=messageOf(reason);
              this.ar.statusAlertType='error';
              this.ar.statusWaiting=false;
              SprLogger.error("Error fetching project config: "+this.ar.statusMsg)
            }});

          } else {
            SprLogger.info("Session has no associated project. Using default configuration.")
          }
        },
        error:(reason) => {
          this.ar.statusMsg = messageOf(reason);
          this.ar.statusAlertType = 'error';
          this.ar.statusWaiting=false;
          SprLogger.error("Error fetching session " + reason)
        }});
    }
  }

  uploadUpdate(ue: UploaderStatusChangeEvent) {
    let upStatus = ue.status;
    this.dataSaved = (UploaderStatus.DONE === upStatus);
    let percentUpl = ue.percentDone();
    if (UploaderStatus.ERR === upStatus) {
      this.ar.uploadStatus = 'warn'
      this.ar.uploadStatusMsg = ue.lastError ? 'Upload error: ' + ue.lastError.message : null;
    } else if (UploaderStatus.PARTIAL === upStatus) {
      this.ar.uploadStatus = 'warn'
      this.ar.uploadStatusMsg = ue.lastError ? 'Upload failed: ' + ue.lastError.message : 'Some uploads failed. Recordings were not stored on the server.';
    } else {
      this.ar.uploadStatusMsg = null;
      if (percentUpl < 50) {
        this.ar.uploadStatus = 'accent'
      } else {
        this.ar.uploadStatus = 'success'
      }
      this.ar.uploadProgress = percentUpl;
    }
    this.ar.updateWakeLock(this.dataSaved);
    this.changeDetectorRef.detectChanges()
  }


  ready():boolean{
    return this.dataSaved && !this.ar.isActive()
  }

}
