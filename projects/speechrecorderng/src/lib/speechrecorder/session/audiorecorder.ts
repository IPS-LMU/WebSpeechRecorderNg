import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'
import {RecordingFile} from '../recording'
import {
  Component, ViewChild, ChangeDetectorRef, Inject,
  AfterViewInit, HostListener, OnDestroy, Input, Renderer2, OnInit, Injector
} from "@angular/core";
import {SessionService} from "./session.service";
import { MatDialog } from "@angular/material/dialog";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import { Project, ProjectUtil} from "../project/project";
import {MessageDialog} from "../../ui/message_dialog";
import {RecordingService} from "../recordings/recordings.service";

import {AudioContextProvider} from "../../audio/context";
import {AudioClip} from "../../audio/persistor";

import {Upload, UploaderStatus, UploaderStatusChangeEvent} from "../../net/uploader";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {ProjectService} from "../project/project.service";
import {UUID} from "../../utils/utils";
import {LevelBar} from "../../audio/ui/livelevel";
import {RecorderCombiPane} from "./recorder_combi_pane";
import {BasicRecorder, LEVEL_BAR_INTERVALL_SECONDS, MAX_RECORDING_TIME_MS, RECFILE_API_CTX} from "./basicrecorder";
import {ReadyStateProvider, RecorderComponent} from "../../recorder_component";
import {Mode} from "../../speechrecorderng.component";


export const enum Status {
  BLOCKED, IDLE,STARTING, RECORDING,  STOPPING_STOP, ERROR
}

export class Item {
  promptAsString: string;
  training: boolean;
  recs: Array<RecordingFile> | null;

  constructor(promptAsString: string, training: boolean) {
    this.promptAsString = promptAsString;
    this.training = training;
    this.recs = null;
  }
}


@Component({
  selector: 'app-audiorecorder',
  providers: [SessionService],
  template: `
    <app-warningbar [show]="isTestSession()" warningText="Test recording only!"></app-warningbar>
    <app-warningbar [show]="isDefaultAudioTestSession()"
                    warningText="This test uses default audio device! Regular sessions may require a particular audio device (microphone)!"></app-warningbar>
    <app-recordercombipane (selectedRecordingFileChanged)="selectRecordingFile($event)"
                           [audioSignalCollapsed]="audioSignalCollapsed"
                           [selectedRecordingFile]="displayRecFile"
                           [selectDisabled]="isActive()"
                           [displayAudioClip]="displayAudioClip"
                           [playStartAction]="controlAudioPlayer.startAction"
                           [playStopAction]="controlAudioPlayer.stopAction"
                           [playSelectionAction]="controlAudioPlayer.startSelectionAction"
                           [autoPlayOnSelectToggleAction]="controlAudioPlayer.autoPlayOnSelectToggleAction"
    ></app-recordercombipane>

    <div fxLayout="row" fxLayout.xs="column" [ngStyle]="{'height.px':100,'min-height.px': 100}"
         [ngStyle.xs]="{'height.px':125,'min-height.px': 125}">
      <audio-levelbar fxFlex="1 0 1" [streamingMode]="isRecording()"
                      [displayLevelInfos]="displayLevelInfos"></audio-levelbar>
      <div fxLayout="row">
        <spr-recordingitemcontrols fxFlex="10 0 1"
                                   [audioLoaded]="displayAudioClip?.buffer!==null"
                                   [playStartAction]="controlAudioPlayer?.startAction"
                                   [playStopAction]="controlAudioPlayer?.stopAction"
                                   [peakDbLvl]="peakLevelInDb"
                                   [agc]="this.ac?.agcStatus"
                                   (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed">
        </spr-recordingitemcontrols>

        <app-uploadstatus class="ricontrols dark" fxHide fxShow.xs fxFlex="0 0 0" *ngIf="enableUploadRecordings"
                          [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-wakelockindicator class="ricontrols dark" fxHide fxShow.xs fxFlex="0 0 0" [screenLocked]="screenLocked"></app-wakelockindicator>
        <app-readystateindicator class="ricontrols dark" fxHide fxShow.xs fxFlex="0 0 0"
                                 [ready]="dataSaved && !isActive()"></app-readystateindicator>
      </div>
    </div>
    <div #controlpanel class="controlpanel" fxLayout="row">
      <app-sprstatusdisplay fxHide.xs fxFlex="30% 1 30%" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"
                            [statusWaiting]="statusWaiting"
                            class="hidden-xs"></app-sprstatusdisplay>
      <div fxFlex="100% 0 100%" class="startstop">
        <div style="align-content: center">
          <button (click)="startStopPerform()" [disabled]="startDisabled() && stopDisabled()" mat-raised-button class="bigbutton">
            <mat-icon [style.color]="startStopNextIconColor()" inline="true">{{startStopNextIconName()}}</mat-icon>
            <span style="font-weight: bolder;font-size: 14px">{{startStopNextName()}}</span>
          </button>
        </div>
      </div>
      <div fxFlex="30% 1 30%" >
        <div fxFlex="1 1 auto"></div>

        <app-uploadstatus class="ricontrols" fxHide.xs fxFlex="0 0 0" *ngIf="enableUploadRecordings"
                          [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-wakelockindicator class="ricontrols" fxHide.xs [screenLocked]="screenLocked"></app-wakelockindicator>
        <app-readystateindicator class="ricontrols" fxHide.xs
                                 [ready]="dataSaved && !isActive()"></app-readystateindicator>
      </div>
    </div>
  `,
  styles: [`:host {
    flex: 2;
    background: lightgrey;
    display: flex; /* Vertical flex container: Bottom transport panel, above prompting panel */
    flex-direction: column;
    margin: 0;
    padding: 0;
    height: 100%;
    min-height: 0px;
      /* Prevents horizontal scroll bar on swipe right */
      overflow: hidden;
  }`,`.ricontrols {
        padding: 4px;
        box-sizing: border-box;
        height: 100%;
    }`,`.dark {
    background: darkgray;
  }`,`.controlpanel {
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    min-height: min-content; /* important */
  }`,`.startstop {
    width: 100%;
    text-align: center;
    align-content: center;
    align-items: center;
  }`,`.bigbutton {
    min-width: 70px;
    min-height: 50px;
    font-size: 50px;
    border-radius: 20px;
  }`
   ]
})
export class AudioRecorder extends BasicRecorder implements OnInit,AfterViewInit,OnDestroy, AudioCaptureListener,ReadyStateProvider {

  _project:Project|undefined| null=null;
  @Input() projectName:string|undefined|null=null;
  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status = Status.BLOCKED;

  @ViewChild(RecorderCombiPane, { static: true }) recorderCombiPane!: RecorderCombiPane;
  @ViewChild(LevelBar, { static: true }) liveLevelDisplay!: LevelBar;

  @Input() dataSaved=true


  private maxRecTimerId: number|null=null;
  private maxRecTimerRunning: boolean=false;
  private updateTimerId: any;

  startStopNextButtonName!:string;
  startStopNextButtonIconName!:string;

  audio: any;

  private _promptIndex:number|null=null;

  //items: Array<Item>|null=null;
  //selectedItemIdx: number;
  private _displayRecFile: RecordingFile | null=null;
  private displayRecFileVersion: number=0;


  constructor(private changeDetectorRef: ChangeDetectorRef,
              private renderer: Renderer2,
              private route: ActivatedRoute,
              public dialog: MatDialog,
              protected sessionService:SessionService,
              private recFileService:RecordingService,
              protected uploader: SpeechRecorderUploader,
              @Inject(SPEECHRECORDER_CONFIG) public config?: SpeechRecorderConfig) {
    super(dialog,sessionService,uploader,config);

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

    let context:AudioContext|null=null;
    try {
      context = AudioContextProvider.audioContextInstance()
    } catch (err) {
      this.status = Status.ERROR;
      let errMsg = 'Unknown error';
      if(err instanceof Error){
        errMsg=err.message;
      }
      this.statusMsg = 'ERROR: ' + errMsg;
      this.statusAlertType = 'error';
      this.dialog.open(MessageDialog, {
        data: {
          type: 'error',
          title: 'Error',
          msg: errMsg,
          advise: 'Please use a supported browser.',
        }
      });
      return;
    }
    if(context) {
      console.info("State of audio context: " + context.state)
    }else{
      console.info("No audio context available!");
    }
    if (!context || !navigator.mediaDevices) {
      this.status = Status.ERROR;
      let errMsg = 'Browser does not support Media streams!';
      this.statusMsg = 'ERROR: ' + errMsg;
      this.statusAlertType = 'error';
      this.dialog.open(MessageDialog, {
        data: {
          type: 'error',
          title: 'Error',
          msg: errMsg,
          advise: 'Please use a supported browser.',
        }
      });
      return;
    } else {
      //this.controlAudioPlayer = new AudioPlayer(context, this);
      this.ac = new AudioCapture(context);
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
            title: 'Error',
            msg: errMsg,
            advise: 'Please use a supported browser.',
          }
        });
        return;
      }
      this.transportActions.stopAction.onAction = () => this.stopItem();
      this.transportActions.nextAction.onAction = () => this.stopItem();
      //this.transportActions.pauseAction.onAction = () => this.pauseItem();

      this.playStartAction.onAction = () => this.controlAudioPlayer.start();

    }
    this.uploader.listener = (ue) => {
      this.uploadUpdate(ue);
    }
  }

  @HostListener('window:keypress', ['$event'])
  onKeyPress(ke: KeyboardEvent) {
    if (ke.key == ' ') {
      //this.transportActions.startAction.perform();
      //this.transportActions.nextAction.perform();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ke: KeyboardEvent) {
    if (ke.key == ' ') {
      if(!this.transportActions.startAction.disabled){
        this.transportActions.startAction.perform();
      }else if(!this.transportActions.stopAction.disabled) {
        this.transportActions.stopAction.perform();
      }
    }
    if (ke.key == 'p') {
      this.transportActions.pauseAction.perform();
    }
    if (ke.key == 'Escape') {
      if (!this.audioSignalCollapsed) {
        this.audioSignalCollapsed = true;
      }
      this.transportActions.stopAction.perform();
      this.transportActions.pauseAction.perform();
    }

    if (ke.key == 'MediaPlayPause') {
      this.playStartAction.perform();
    }
    if (ke.key === 'ArrowRight') {
      this.transportActions.fwdAction.perform();
    }
    if (ke.key === 'ArrowLeft') {
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
    let prNm:string|null=null;
    if(this.project) {
      let rfsObs = this.recFileService.recordingFileList(this.project.name, sess.sessionId);
      rfsObs.subscribe({next:(rfs: Array<RecordingFile>) => {
        this.statusAlertType = 'info';
        this.statusMsg = 'Received infos of recordings.';
        this.statusWaiting = false;
        if (rfs) {
          if (rfs instanceof Array) {
            rfs.forEach((rf) => {
              if(rf.startedDate){
                rf._startedAsDateObj=new Date(rf.startedDate);
              }
              if(rf.date){
                rf._dateAsDateObj=new Date(rf.date);
              }
              this.recorderCombiPane.push(rf);
            })
          } else {
            console.error('Expected type array for list of already recorded files ')
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
      console.error(this.statusMsg);
    }
  }


  set project(project: Project|undefined|null) {
    this._project = project;
    let chCnt = ProjectUtil.DEFAULT_AUDIO_CHANNEL_COUNT;
    let sampleSize:number|null=null;
    if (project) {
      console.info("Project name: " + project.name)
      if(project.recordingDeviceWakeLock===true){
        this.wakeLock=true;
      }
      this.audioDevices = project.audioDevices;
      chCnt = ProjectUtil.audioChannelCount(project);
      console.info("Project requested recording channel count: " + chCnt);
      sampleSize=ProjectUtil.sampleSize(project);
      if(sampleSize) {
        console.info("Project requested sampleSize: " + sampleSize);
      }
      this.autoGainControlConfigs=project.autoGainControlConfigs;
      if(project.chunkedRecording===true){
        this.uploadChunkSizeSeconds=BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;
      }else{
        this.uploadChunkSizeSeconds=null;
      }
    } else {
      console.error("Empty project configuration!")
    }
    this.channelCount = chCnt;
    this.sampleSize=sampleSize;
  }


  get project():Project|undefined|null{
    return this._project;
  }

  selectRecordingFile(rf:RecordingFile){
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

  set controlAudioPlayer(controlAudioPlayer: AudioPlayer) {
    if (this._controlAudioPlayer) {
      //this._controlAudioPlayer.listener=null;
    }
    this._controlAudioPlayer = controlAudioPlayer;
    if (this._controlAudioPlayer) {
      this._controlAudioPlayer.listener = this;
    }
  }

  get controlAudioPlayer(): AudioPlayer {
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
      // this.audioSignal.playFramePosition = this.ap.playPositionFrames;
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
      this.startStopNextButtonName="Start"
    }else if(!this.stopDisabled()) {
      this.startStopNextButtonName = "Stop"
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
      return "red"
    }else if(!this.stopDisabled()){
      return "yellow"
    }else{
      return "grey";
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
    this.showRecording();

    if (this.ac) {
      if (!this.ac.opened) {
        if (this._selectedDeviceId) {
          console.log("Open session with audio device Id: \'" + this._selectedDeviceId + "\' for " + this._channelCount + " channels");
        } else {
          console.log("Open session with default audio device for " + this._channelCount + " channels");
        }
        this.ac.open(this._channelCount,this.sampleSize, this._selectedDeviceId,this._autoGainControlConfigs);
      } else {
        this.ac.start();
      }
    }
  }


  downloadRecording() {
    if (this.displayRecFile) {
      let ab: AudioBuffer | null = this.displayRecFile.audioBuffer;
      let ww = new WavWriter();
      if(this.sampleSize){
        ww.sampleSize=this.sampleSize;
      }
      if (ab) {
        let wavFile = ww.writeAsync(ab, (wavFile) => {
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
    this._displayRecFile = displayRecFile;
    if (this._displayRecFile) {
      let ab: AudioBuffer| null = this._displayRecFile.audioBuffer;
      if(ab) {
        this.displayAudioClip = new AudioClip(ab);
        this.controlAudioPlayer.audioClip = this.displayAudioClip;
      }else {
        // clear for now ...
        this.displayAudioClip = null;
        this.controlAudioPlayer.audioClip = null;

        if (this._controlAudioPlayer && this._session) {
            //... and try to fetch from server
            this.audioFetchSubscription = this.recFileService.fetchAndApplyRecordingFile(this._controlAudioPlayer.context, this._session.project, this._displayRecFile).subscribe((rf) => {
              let fab = null;
              if (rf && this._displayRecFile) {
                fab = this._displayRecFile.audioBuffer;
              } else {
                this.statusMsg = 'Recording file could not be loaded.'
                this.statusAlertType = 'error'
              }
              if (fab){
                this.displayAudioClip = new AudioClip(fab);
              }
              this.controlAudioPlayer.audioClip =this.displayAudioClip
              this.showRecording();

            }, err => {
              console.error("Could not load recording file from server: " + err)
              this.statusMsg = 'Recording file could not be loaded: ' + err
              this.statusAlertType = 'error'
            })
        }else{
          this.statusMsg = 'Recording file could not be decoded. Audio context unavailable.'
          this.statusAlertType = 'error'
        }
      }

    } else {
      this.displayAudioClip = null;
      this.controlAudioPlayer.audioClip = null;
    }
    this.showRecording();
  }

  get displayRecFile(): RecordingFile | null {
    return this._displayRecFile;
  }

  showRecording() {
    this.controlAudioPlayer.stop();

    if (this.displayAudioClip) {

      this.levelMeasure.calcBufferLevelInfos(this.displayAudioClip.buffer, LEVEL_BAR_INTERVALL_SECONDS).then((levelInfos) => {
        this.displayLevelInfos = levelInfos;
        this.changeDetectorRef.detectChanges();
      });
      this.playStartAction.disabled = false;

    } else {

      // TODO
      // Setting to null does not trigger a change if it was  null before (happens after nextitem() in AUTOPROGRESS mode)
      // The level bar display does not clear, it shows the last captured stream
      this.displayLevelInfos = null;

      this.playStartAction.disabled = true;

      // Collapse audio signal display if open
      if (!this.audioSignalCollapsed) {
        this.audioSignalCollapsed = true;
      }
    }
    this.changeDetectorRef.detectChanges();
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
    return (this.status === Status.RECORDING);
  }

  isActive(): boolean{
    return (!(this.status === Status.BLOCKED || this.status=== Status.IDLE || this.status===Status.ERROR) || this.processingRecording || this.sessionService.uploadCount>0)
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

  opened() {
    if(this.ac) {
      this.ac.start();
    }
  }

  started() {
    this.status = Status.RECORDING;
    super.started();
    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

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
    this.statusMsg = 'Recorded.';

    let ad:AudioBuffer;
    if(this.ac) {
      ad = this.ac.audioBuffer();
      let sessId: string | number = 0;
      if(this._session){
        sessId=this._session.sessionId;
      }
      if(!this.rfUuid){
        this.rfUuid=UUID.generate()
      }
      let rf = new RecordingFile(this.rfUuid,sessId,ad);
      rf._startedAsDateObj=this.startedDate;
      if(rf._startedAsDateObj) {
        rf.startedDate = rf._startedAsDateObj.toString();
      }
      rf.frames = ad.length;
      this.displayRecFile = rf;
      this.recorderCombiPane.push(rf);

      // Upload if upload enabled and not in chunked upload mode
      if (this.enableUploadRecordings && !this.uploadChunkSizeSeconds) {
        let apiEndPoint = '';

        if (this.config && this.config.apiEndPoint) {
          apiEndPoint = this.config.apiEndPoint;
        }
        if (apiEndPoint !== '') {
          apiEndPoint = apiEndPoint + '/'
        }

        let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
        let recUrl: string = sessionsUrl + '/' + rf.session + '/' + RECFILE_API_CTX + '/' + rf.uuid;

        // convert asynchronously to 16-bit integer PCM
        // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
        // TODO duplicate conversion for manual download

        this.processingRecording = true
        let ww = new WavWriter();
        if(this.sampleSize){
          ww.sampleSize=this.sampleSize;
        }
        ww.writeAsync(ad, (wavFile) => {
          this.postRecordingMultipart(wavFile, rf.uuid, rf.session, rf._startedAsDateObj, recUrl);
          this.processingRecording = false;
          this.updateWakeLock();
          this.changeDetectorRef.detectChanges();
        });
      }
    }
    this.status = Status.IDLE;
    this.navigationDisabled = false;
    this.updateNavigationActions();
    this.updateWakeLock();
    this.changeDetectorRef.detectChanges();
  }



  postRecordingMultipart(wavFile: Uint8Array, uuid:string|null,sessionId:string|number|null,startedDate:Date|null|undefined,recUrl: string) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});

    let fd=new FormData();
    if(uuid) {
      fd.set('uuid', uuid);
    }
    if(sessionId!==null) {
      fd.set('sessionId', sessionId.toString());
    }
    if(startedDate){
      fd.set('startedDate',startedDate.toJSON());
    }
    fd.set('audio',wavBlob);
    let ul = new Upload(fd, recUrl);
    this.uploader.queueUpload(ul);
  }

  postChunkAudioBuffer(audioBuffer: AudioBuffer, chunkIdx: number): void {
    this.processingRecording = true;
    let ww = new WavWriter();
    if(this.sampleSize){
      ww.sampleSize=this.sampleSize;
    }
    //new REST API URL
    let apiEndPoint = '';
    if (this.config && this.config.apiEndPoint) {
      apiEndPoint = this.config.apiEndPoint;
    }
    if (apiEndPoint !== '') {
      apiEndPoint = apiEndPoint + '/'
    }
    let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
    let recUrl: string = sessionsUrl + '/' + this.session?.sessionId + '/' + RECFILE_API_CTX + '/' + this.rfUuid+'/'+chunkIdx;
    ww.writeAsync(audioBuffer, (wavFile) => {
      this.postRecording(wavFile, recUrl);
      this.processingRecording = false;
    });
  }

  stop() {
    if(this.ac) {
      this.ac.close();
    }
  }

  private updateControlPlaybackPosition() {
    if (this._controlAudioPlayer.playPositionFrames) {
      this.recorderCombiPane.audioDisplay.playFramePosition = this._controlAudioPlayer.playPositionFrames;
      this.liveLevelDisplay.playFramePosition = this._controlAudioPlayer.playPositionFrames;
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

  }`]

})
export class AudioRecorderComponent extends RecorderComponent  implements OnInit,OnDestroy,AfterViewInit,ReadyStateProvider {

  mode!:Mode;
  controlAudioPlayer!:AudioPlayer;
  audio:any;

  _project:Project|undefined;
  sessionId!: string;
  session!:Session;

  @ViewChild(AudioRecorder, { static: true }) ar!:AudioRecorder;

  constructor(protected injector:Injector,private route: ActivatedRoute,
              private router: Router,
              private changeDetectorRef: ChangeDetectorRef,
              private sessionService:SessionService,
              private projectService:ProjectService,
              protected uploader:SpeechRecorderUploader
  ) {
    super(uploader);
  }

  ngOnInit() {
    //super.ngOnInit();
    let audioContext = AudioContextProvider.audioContextInstance();
    if(audioContext) {
      this.controlAudioPlayer = new AudioPlayer(audioContext,this.ar);
    }
    this.ar.controlAudioPlayer=this.controlAudioPlayer;

    //TODO Duplicate code in SpeechRecorderComponent
    window.addEventListener('beforeunload', (e) => {
      console.debug("Before page unload event");

      if (this.ready()) {
        return;
      } else {
        // all this attempts to customize the message do not work anymore (for security reasons)!!
        var message = "Please do not leave the page, until all recordings are uploaded!";
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
    this.uploader.listener = (ue) => {
      this.uploadUpdate(ue);
    }
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
              this.ar.statusMsg=reason;
              this.ar.statusAlertType='error';
              this.ar.statusWaiting=false;
              console.error("Error fetching project config: "+reason)
            }});

          } else {
            console.info("Session has no associated project. Using default configuration.")
          }
        },
        error:(reason) => {
          this.ar.statusMsg = reason;
          this.ar.statusAlertType = 'error';
          this.ar.statusWaiting=false;
          console.error("Error fetching session " + reason)
        }});
    }
  }

  uploadUpdate(ue: UploaderStatusChangeEvent) {
    let upStatus = ue.status;
    this.dataSaved = (UploaderStatus.DONE === upStatus);
    let percentUpl = ue.percentDone();
    if (UploaderStatus.ERR === upStatus) {
      this.ar.uploadStatus = 'warn'
    } else {
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
