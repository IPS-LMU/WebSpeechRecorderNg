import {Action} from '../../action/action'
import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'

import {RecordingFile} from '../recording'

import {
  Component, ViewChild, ChangeDetectorRef, Inject,
  AfterViewInit, HostListener, OnDestroy, Input, Renderer2
} from "@angular/core";
import {SessionService} from "./session.service";

import { MatDialog } from "@angular/material/dialog";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {AudioDevice, AutoGainControlConfig, Project, ProjectUtil} from "../project/project";

import {LevelInfos, LevelMeasure, StreamLevelMeasure} from "../../audio/dsp/level_measure";

import {SequenceAudioFloat32ChunkerOutStream} from "../../audio/io/stream";
import {TransportActions} from "./controlpanel";
import {MessageDialog} from "../../ui/message_dialog";
import {RecordingService} from "../recordings/recordings.service";
import {Subscription} from "rxjs";
import {AudioContextProvider} from "../../audio/context";
import {AudioClip} from "../../audio/persistor";
import {RecordingList} from "./recording_list";
import {Upload, UploaderStatus, UploaderStatusChangeEvent} from "../../net/uploader";
import {ActivatedRoute, Params} from "@angular/router";
import {ProjectService} from "../project/project.service";
import {UUID} from "../../utils/utils";
import {MIN_DB_LEVEL, RecordingItemDisplay} from "../../ui/recordingitem_display";
import {LevelBar} from "../../audio/ui/livelevel";
import {RecorderCombiPane} from "./recorder_combi_pane";


export const RECFILE_API_CTX = 'recfile';


const MAX_RECORDING_TIME_MS = 1000 * 60 * 60 * 60; // 1 hour


const LEVEL_BAR_INTERVALL_SECONDS = 0.1;  // 100ms
export const enum Mode {SERVER_BOUND, STAND_ALONE}

export const enum Status {
  BLOCKED, IDLE, RECORDING,  STOPPING_STOP, ERROR
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

// TODO enum not possible in template language , use string for now
//export enum StatusAlertType {INFO,WARN,ERROR};

@Component({

  selector: 'app-audiorecorder',
  providers: [SessionService],
  template: `
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

    <div fxLayout="row" fxLayout.xs="column" [ngStyle]="{'height.px':100,'min-height.px': 100}" [ngStyle.xs]="{'height.px':125,'min-height.px': 125}">
      <audio-levelbar fxFlex="1 0 1" [streamingMode]="isRecording()" [displayLevelInfos]="displayLevelInfos"></audio-levelbar>
      <div fxLayout="row">
        <spr-recordingitemcontrols fxFlex="10 0 1"
                                   [audioLoaded]="displayAudioClip?.buffer!==null"
                                   [playStartAction]="controlAudioPlayer?.startAction"
                                   [playStopAction]="controlAudioPlayer?.stopAction"
                                   [peakDbLvl]="peakLevelInDb"
                                   [agc]="this.ac?.agcStatus"
                                   (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed">
        </spr-recordingitemcontrols>
        <app-uploadstatus class="ricontrols dark" fxHide fxShow.xs  fxFlex="0 0 0" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-readystateindicator class="ricontrols dark"  fxHide fxShow.xs fxFlex="0 0 0" [ready]="dataSaved && !isActive()"></app-readystateindicator>
      </div>
    </div>
    <div #controlpanel class="controlpanel">
      <app-sprstatusdisplay fxHide.xs  fxFlex="30% 1 30%" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"
                            class="hidden-xs"></app-sprstatusdisplay>
      <app-sprtransport fxFlex="100% 0 30%" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="false" [pausingEnabled]="false"></app-sprtransport>
      <div fxFlex="30% 1 30%">
        <div fxFlex="1 1 auto"></div>
        <app-uploadstatus class="ricontrols" fxHide.xs  fxFlex="0 0 0" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-readystateindicator class="ricontrols" fxHide.xs [ready]="dataSaved && !isActive()"></app-readystateindicator>
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
  }` ]
})
export class AudioRecorder implements AfterViewInit,OnDestroy, AudioCaptureListener {

  _project:Project|null=null;
  @Input() projectName:string|null=null;
  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status = Status.BLOCKED;

  ac: AudioCapture|null=null;
  private _channelCount = 2; //TODO define constant for default format
  private _selectedDeviceId:string|undefined;

  @ViewChild(RecorderCombiPane, { static: true }) recorderCombiPane!: RecorderCombiPane;
  @ViewChild(LevelBar, { static: true }) liveLevelDisplay!: LevelBar;

  @Input() dataSaved=true

  // Property audioDevices from project config: list of names of allowed audio devices.
  private _audioDevices: Array<AudioDevice> | null | undefined;
  private selCaptureDeviceId: ConstrainDOMString | null;
  private _autoGainControlConfigs: Array<AutoGainControlConfig> | null| undefined;

  private maxRecTimerId: number|null=null;
  private maxRecTimerRunning: boolean=false;
  private updateTimerId: any;

  transportActions: TransportActions;
  //dnlLnk: HTMLAnchorElement;
  playStartAction: Action<void>;
  audio: any;

  _session: Session|null=null;

  private _promptIndex:number|null=null;

  //items: Array<Item>|null=null;
  //selectedItemIdx: number;
  private _displayRecFile: RecordingFile | null=null;
  private displayRecFileVersion: number=0;
  displayAudioClip: AudioClip | null=null;

  displayLevelInfos: LevelInfos | null=null;

  peakLevelInDb:number=MIN_DB_LEVEL;

  readonly=false

  statusMsg: string='';
  statusAlertType!: string;
  statusWaiting: boolean=false;

  processingRecording=false

  uploadProgress: number = 100;
  uploadStatus: string = 'ok'
  audioSignalCollapsed = true;

  private streamLevelMeasure: StreamLevelMeasure;
  private levelMeasure: LevelMeasure;
  private _controlAudioPlayer!: AudioPlayer;

  private audioFetchSubscription:Subscription|null=null;

  private destroyed=false;

  private navigationDisabled=true;

  constructor(private changeDetectorRef: ChangeDetectorRef,
              private route: ActivatedRoute,
              private renderer: Renderer2,
              public dialog: MatDialog,
              private projectService:ProjectService,
              private sessionService:SessionService,
              private recFileService:RecordingService,
              private uploader: SpeechRecorderUploader,
              @Inject(SPEECHRECORDER_CONFIG) public config?: SpeechRecorderConfig) {
    this.status = Status.IDLE;
    this.transportActions = new TransportActions();
    this.playStartAction = new Action('Play');
    this.audio = document.getElementById('audio');
    this.selCaptureDeviceId = null;
    this.levelMeasure = new LevelMeasure();
    this.streamLevelMeasure = new StreamLevelMeasure();
    if (this.config && this.config.enableUploadRecordings != null) {
      this.enableUploadRecordings = this.config.enableUploadRecordings;
    }
    if (this.config && this.config.enableDownloadRecordings != null) {
      this.enableDownloadRecordings = this.config.enableDownloadRecordings;
    }
    this.init();
  }

  ngAfterViewInit() {
    this.route.queryParams.subscribe((params: Params) => {
      if (params['sessionId']) {
        this.fetchSession(params['sessionId']);
      }
    });
    this.streamLevelMeasure.levelListener = this.liveLevelDisplay;
    this.streamLevelMeasure.peakLevelListener=(peakLvlInDb)=>{
      this.peakLevelInDb=peakLvlInDb;
      this.changeDetectorRef.detectChanges();
    }
  }
    ngOnDestroy() {
       this.destroyed=true;
       // TODO stop capture /playback
    }

  private init() {

    this.transportActions.startAction.disabled = true;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.playStartAction.disabled = true;

    let context=null;
    try {
      context = AudioContextProvider.audioContextInstance()
    } catch (err) {
      this.status = Status.ERROR;
      let errMsg = err.message;
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
      this.controlAudioPlayer = new AudioPlayer(context, this);
      this.ac = new AudioCapture(context);
      if (this.ac) {
        this.transportActions.startAction.onAction = () => this.startItem();
        this.ac.listener = this;
        this.ac.audioOutStream = new SequenceAudioFloat32ChunkerOutStream(this.streamLevelMeasure, LEVEL_BAR_INTERVALL_SECONDS);
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
      this.transportActions.startAction.perform();
      this.transportActions.nextAction.perform();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ke: KeyboardEvent) {
    if (ke.key == ' ' || ke.key == 'Escape') {
      this.transportActions.stopAction.perform();
    }
    if (ke.key == 'p' || ke.key == 'Escape') {
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

  fetchSession(sessionId:string){


    //Error: ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value: 'statusMsg: Player initialized.'. Current value: 'statusMsg: Fetching session info...'.
    // params.subscribe seems not to be asynchronous

    // this.sm.statusAlertType='info';
    // this.sm.statusMsg = 'Fetching session info...';
    // this.sm.statusWaiting=true;
    let sessObs= this.sessionService.sessionObserver(sessionId);

    if(sessObs) {
      sessObs.subscribe(sess => {
          //this.setSession(sess);
          this.statusAlertType='info';
          this.statusMsg = 'Received session info.';
          this.statusWaiting=false;
          this.session=sess;
          if (sess.project) {
            //console.debug("Session associated project: "+sess.project)
            this.projectService.projectObservable(sess.project).subscribe(project=>{
              this.project=project;
              this.start();
            },reason =>{
              this.statusMsg=reason;
              this.statusAlertType='error';
              this.statusWaiting=false;
              console.error("Error fetching project config: "+reason)
            });

          } else {
            console.info("Session has no associated project. Using default configuration.")
          }
        },
        (reason) => {
          this.statusMsg = reason;
          this.statusAlertType = 'error';
          this.statusWaiting=false;
          console.error("Error fetching session " + reason)
        });
    }
  }

  set project(project: Project|null) {
    this._project = project;
    let chCnt = ProjectUtil.DEFAULT_AUDIO_CHANNEL_COUNT;

    if (project) {
      console.info("Project name: " + project.name)
      this.audioDevices = project.audioDevices;
      chCnt = ProjectUtil.audioChannelCount(project);
      console.info("Project requested recording channel count: " + chCnt);
      this.autoGainControlConfigs=project.autoGainControlConfigs;
    } else {
      console.error("Empty project configuration!")
    }
    this.channelCount = chCnt;

  }

  set autoGainControlConfigs(autoGainControlConfigs: Array<AutoGainControlConfig>|null|undefined){
    this._autoGainControlConfigs=autoGainControlConfigs;
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

  set session(session: Session) {
    this._session = session;
  }

  set channelCount(channelCount: number) {
    this._channelCount = channelCount;
  }

  set audioDevices(audioDevices: Array<AudioDevice> | null | undefined) {
    this._audioDevices = audioDevices;
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


  startItem() {
    this.transportActions.startAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    if (this.readonly) {
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
        this.ac.open(this._channelCount, this._selectedDeviceId,this._autoGainControlConfigs);
      } else {
        this.ac.start();
      }
    }
  }


  downloadRecording() {
    if (this.displayRecFile) {
      let ab: AudioBuffer | null = this.displayRecFile.audioBuffer;
      let ww = new WavWriter();
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
        if (this._controlAudioPlayer) {

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
            advise: 'Please ask your experimenter what to do (e.g start a new session).',
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
    //console.log("Session ID: "+this._session.session+ " status: "+this._session.status)
    this._selectedDeviceId=undefined;

    if (!this.readonly && this.ac) {
      this.statusMsg = 'Requesting audio permissions...';
      this.statusAlertType = 'info';

      this.ac.deviceInfos((mdis) => {
        let audioCaptureDeviceAvail: boolean = false;
        let audioPlayDeviceAvail: boolean = false;
        if (mdis && this.ac) {
          this.ac.printDevices(mdis)
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
              if (!audioPlayDeviceAvail) {
                  // Firefox does not enumerate audiooutput devices
                  // Do not show this warning, because it would always appear on Firefox
                  // When https://bugzilla.mozilla.org/show_bug.cgi?id=1498512 is fixed the warning can be enabled for Firefox as well

                  // It is already implemneted but kept behind a preference setting https://bugzilla.mozilla.org/show_bug.cgi?id=1152401


                  // Output devices are listed if about:config media.setsinkid.enabled=true
                  // but default setting is false
                  if (!navigator.userAgent.match(".*Firefox.*")) {
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

    this.enableNavigation()
  }

  isRecording(): boolean {
    return (this.status === Status.RECORDING);
  }

  isActive(): boolean{
    return (!(this.status === Status.BLOCKED || this.status=== Status.IDLE || this.status===Status.ERROR) || this.processingRecording || this.sessionService.uploadCount>0)
  }

  private updateNavigationActions(){

    this.transportActions.fwdAction.disabled = this.navigationDisabled;
    this.transportActions.bwdAction.disabled = this.navigationDisabled;
  }


  enableStartUserGesture() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Ready.';
    //this.updateStartActionDisableState()
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
    this.transportActions.startAction.disabled = true;

    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

    let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
    this.maxRecTimerId = window.setTimeout(() => {
      this.stopRecordingMaxRec()
    }, maxRecordingTimeMs);
    this.maxRecTimerRunning = true;

    this.status = Status.RECORDING;
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

  // addRecordingFileByDescriptor(rfd:RecordingFileDescriptorImpl){
  //    let prIdx=0;
  //    if(this.items) {
  //      let it = this.items[prIdx];
  //      if (it) {
  //        if (!it.recs) {
  //          it.recs = new Array<SprRecordingFile>();
  //        }
  //
  //      } else {
  //        //console.debug("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
  //      }
  //    }
  // }
  //
  // addRecordingFileByPromptIndex(promptIndex:number, rf:SprRecordingFile){
  //
  // }


  stopped() {
    this.updateStartActionDisableState()
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = 'Recorded.';
    //this.startStopSignalState = StartStopSignalState.IDLE;
    let ad:AudioBuffer;
    if(this.ac) {
      ad = this.ac.audioBuffer();
    //}
    //if (this._session && this._promptIndex ) {
      let sessId: string | number = 0;
      if(this._session){
        sessId=this._session.sessionId;
      }
      // let cpIdx = this._promptIndex;
      // let it = this.items[cpIdx];
      // if (!it.recs) {
      //   it.recs = new Array<RecordingFile>();
      // }

      let rf = new RecordingFile(UUID.generate(),sessId,ad);
      // it.recs.push(rf);
      //
      // if (this.enableUploadRecordings) {
      //   // TODO use SpeechRecorderconfig resp. RecfileService
      //   //new REST API URL
      //
        let apiEndPoint = '';

        if (this.config && this.config.apiEndPoint) {
          apiEndPoint = this.config.apiEndPoint;
        }
        if (apiEndPoint !== '') {
          apiEndPoint = apiEndPoint + '/'
        }

          let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
           let recUrl: string = sessionsUrl + '/' + rf.session + '/' + RECFILE_API_CTX + '/' + rf.uuid;
      //
      //
      //
      //     // convert asynchronously to 16-bit integer PCM
      //     // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
      //     // TODO duplicate conversion for manual download
      //     //console.log("Build wav writer...");
          this.processingRecording=true
          let ww = new WavWriter();
          ww.writeAsync(ad, (wavFile) => {
            //this.postRecording(wavFile, recUrl);
            //rf._dateAsDateObj=new Date();
            rf.frames=ad.length;
            this.displayRecFile=rf;
            //this.recordingListComp.recordingList.push(rf);
            this.recorderCombiPane.push(rf);
            this.postRecording(wavFile, recUrl);
            this.processingRecording=false;
            this.changeDetectorRef.detectChanges();
          });
      // }
    }

    // check complete session
    let complete = true;

    let autoStart = (this.status === Status.STOPPING_STOP);
    this.status = Status.IDLE;
    let startNext=false;

        this.navigationDisabled = false;
        this.updateNavigationActions();

    this.changeDetectorRef.detectChanges();
  }

  postRecording(wavFile: Uint8Array, recUrl: string) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
    let ul = new Upload(wavBlob, recUrl);
    this.uploader.queueUpload(ul);
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

  closed() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Session closed.';
  }


  error(msg='An unknown error occured during recording.',advice:string='Please retry.') {
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

