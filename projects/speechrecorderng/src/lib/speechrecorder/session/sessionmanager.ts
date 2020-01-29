import {Action} from '../../action/action'
import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'
import {Script, Section, Group,PromptItem, Mediaitem} from '../script/script';
import {RecordingFile, RecordingFileDescriptor} from '../recording'
import {Upload} from '../../net/uploader';
import {
  Component, ViewChild, ChangeDetectorRef, Inject,
  AfterViewInit, HostListener, OnDestroy, Input
} from "@angular/core";
import {SessionService} from "./session.service";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {Status as SessionStatus} from "./session";
import { MatDialog } from "@angular/material/dialog";
import { MatProgressBar } from "@angular/material/progress-bar";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {AudioDevice} from "../project/project";
import {LevelBarDisplay} from "../../ui/livelevel_display";
import {LevelInfos, LevelMeasure, StreamLevelMeasure} from "../../audio/dsp/level_measure";
import {Prompting} from "./prompting";
import {SequenceAudioFloat32ChunkerOutStream} from "../../audio/io/stream";
import {TransportActions} from "./controlpanel";
import {SessionFinishedDialog} from "./session_finished_dialog";
import {MessageDialog} from "../../ui/message_dialog";
import {AudioClipUIContainer} from "../../audio/ui/container";
import {RecordingService} from "../recordings/recordings.service";
import {Observable, Subscription} from "rxjs";
import {AudioContextProvider} from "../../audio/context";


export const RECFILE_API_CTX = 'recfile';


const MAX_RECORDING_TIME_MS = 1000 * 60 * 60 * 60; // 1 hour

const LEVEL_BAR_INTERVALL_SECONDS = 0.1;  // 100ms
export const enum Mode {SERVER_BOUND, STAND_ALONE}

export const enum Status {
  BLOCKED, IDLE, PRE_RECORDING, RECORDING, POST_REC_STOP, POST_REC_PAUSE, STOPPING_STOP, STOPPING_PAUSE, ERROR
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

  selector: 'app-sprrecordingsession',
  providers: [SessionService],
  template: `
    <app-warningbar [show]="isTestSession()" warningText="Test recording only!"></app-warningbar>
    <app-warningbar [show]="isDefaultAudioTestSession()" warningText="This test uses default audio device! Regular sessions may require a particular audio device (microphone)!"></app-warningbar>
      <app-sprprompting [projectName]="projectName"
                        [startStopSignalState]="startStopSignalState" [promptItem]="promptItem" [showPrompt]="showPrompt"
                        [items]="items"
                        [transportActions]="transportActions"
                        [selectedItemIdx]="promptIndex" (onItemSelect)="itemSelect($event)" (onNextItem)="nextItem()" (onPrevItem)="prevItem()"
                        [audioSignalCollapsed]="audioSignalCollapsed" [displayAudioBuffer]="displayAudioBuffer"
                        [playStartAction]="controlAudioPlayer?.startAction"
                        [playStopAction]="controlAudioPlayer?.stopAction">

    </app-sprprompting>
    <mat-progress-bar [value]="promptIndex*100/(items?.length-1)" fxShow="false" fxShow.xs="true" ></mat-progress-bar>

    <spr-recordingitemdisplay #levelbardisplay
                              [playStartAction]="controlAudioPlayer?.startAction"
                              [playStopAction]="controlAudioPlayer?.stopAction"
                              [streamingMode]="isRecording()"
                              [displayLevelInfos]="displayLevelInfos"
                              [displayAudioBuffer]="displayAudioBuffer" [audioSignalCollapsed]="audioSignalCollapsed"
                              (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed"
                              (onDownloadRecording)="downloadRecording()" (onStartPlayback)="startControlPlayback()"
                              [enableDownload]="enableDownloadRecordings"></spr-recordingitemdisplay>
    <app-sprcontrolpanel [enableUploadRecordings]="enableUploadRecordings" [readonly]="readonly" [currentRecording]="displayAudioBuffer"
                         [transportActions]="transportActions" [statusMsg]="statusMsg"
                         [statusAlertType]="statusAlertType" [uploadProgress]="uploadProgress"
                         [uploadStatus]="uploadStatus" [ready]="dataSaved && !isActive()" [processing]="processingRecording"></app-sprcontrolpanel>

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
  }` ]
})
export class SessionManager implements AfterViewInit,OnDestroy, AudioCaptureListener {

  @Input() projectName:string|null;
  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status = Status.BLOCKED;

  ac: AudioCapture;
  private _channelCount = 2; //TODO define constant for default format
  private _selectedDeviceId:string|null=null;
  @ViewChild(Prompting, { static: true }) prompting: Prompting;
  @ViewChild(LevelBarDisplay, { static: true }) liveLevelDisplay: LevelBarDisplay;

  @Input() dataSaved=true


  startStopSignalState: StartStopSignalState;
  // Property audioDevices from project config: list of names of allowed audio devices.
  private _audioDevices: Array<AudioDevice> | null | undefined;
  private selCaptureDeviceId: ConstrainDOMString | null;

  private updateTimerId: any;
  private preRecTimerId: number;
  private preRecTimerRunning: boolean;
  private postRecTimerId: number;
  private postRecTimerRunning: boolean;
  private maxRecTimerId: number;
  private maxRecTimerRunning: boolean;

  transportActions: TransportActions;
  dnlLnk: HTMLAnchorElement;
  playStartAction: Action;
  audio: any;

  _session: Session;
  _script: Script;

  private _promptIndex:number;
  private section: Section;
  group: Group;
  promptItem:PromptItem;
  showPrompt: boolean;

  // index of current section
  sectIdx: number;
  // index of current group in section
  groupIdxInSection: number;
  // index of current prompt item in group
  promptItemIdxInGroup: number;

  private autorecording: boolean;

  items: Array<Item>;
  //selectedItemIdx: number;
  private _displayRecFile: RecordingFile | null;
  private displayRecFileVersion: number;
  displayAudioBuffer: AudioBuffer | null;
  displayLevelInfos: LevelInfos | null;

  promptItemCount: number;

  readonly=false

  statusMsg: string;
  statusAlertType: string;

  processingRecording=false

  uploadProgress: number = 100;
  uploadStatus: string = 'ok'
  audioSignalCollapsed = true;

  private streamLevelMeasure: StreamLevelMeasure;
  private levelMeasure: LevelMeasure;
  private _controlAudioPlayer: AudioPlayer;

  private audioFetchSubscription:Subscription|null;

  private destroyed=false;

  constructor(private changeDetectorRef: ChangeDetectorRef,
              public dialog: MatDialog,
              private sessionService:SessionService,
              private recFileService:RecordingService,
              private uploader: SpeechRecorderUploader,
              @Inject(SPEECHRECORDER_CONFIG) public config?: SpeechRecorderConfig) {
    this.status = Status.IDLE;
    this.transportActions = new TransportActions();
    let playStartBtn = <HTMLInputElement>(document.getElementById('playStartBtn'));
    this.playStartAction = new Action('Play');
    this.playStartAction.addControl(playStartBtn, 'click');
    this.dnlLnk = <HTMLAnchorElement>document.getElementById('rfDownloadLnk');
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

    this.streamLevelMeasure.levelListener = this.liveLevelDisplay;
  }
    ngOnDestroy() {
       this.destroyed=true;
       // TODO stop capture /playback
    }

  private init() {
    this.sectIdx = 0;
    this.groupIdxInSection = 0;
    this.promptItemIdxInGroup = 0;
    this.autorecording = false;
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

    console.info("State of audio context: " + context.state)

    if (!navigator.mediaDevices) {
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
      this.transportActions.pauseAction.onAction = () => this.pauseItem();
      this.transportActions.fwdAction.onAction = () => this.nextItem();
      this.transportActions.bwdAction.onAction = () => this.prevItem();
      this.playStartAction.onAction = () => this.controlAudioPlayer.start();

    }

    this.startStopSignalState = StartStopSignalState.OFF;

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

  isTestSession():boolean {
    return (this._session && (this._session.type === 'TEST' || this._session.type==='TEST_DEF_A' || this._session.type === 'SINUS_TEST'))
  }

  isDefaultAudioTestSession():boolean {
    return (this._session && (this._session.type==='TEST_DEF_A'))
  }

  isDefaultAudioTestSessionOverwriteingProjectRequirements():boolean {
    return (this._session && (this._session.type==='TEST_DEF_A') && this.audioDevices && this._audioDevices.length>0)
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

  set script(script: any) {
    this._script = script;
    this.loadScript();
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
      this.updateTimerId = window.setInterval(e => {
        //this.audioSignal.playFramePosition = this.ap.playPositionFrames;
      }, 50);
    } else if (e.type == EventType.STOPPED || e.type == EventType.ENDED) {
      window.clearInterval(this.updateTimerId);
      // this.audioSignal.playFramePosition = this.ap.playPositionFrames;
      this.playStartAction.disabled = (!(this.displayRecFile));

    }
  }

  get promptIndex():number{
    return this._promptIndex;
  }

  set promptIndex(promptIndex:number){
    if(promptIndex<0 || promptIndex>=this.promptItemCount){
      throw new Error("Prompt index out of range")
    }
    let i = 0;
    let sections=this._script.sections;
    let found=false;
    for (let si = 0; si < sections.length && !found; si++) {
      let section = sections[si];
      let gs = section.groups;
      for (let gi = 0; gi < gs.length; gi++) {
        let pis=gs[gi].promptItems;

        let pisSize = pis.length;
        if (promptIndex < i + pisSize) {
          this.sectIdx = si;
          this.groupIdxInSection=gi;
          this.promptItemIdxInGroup = promptIndex - i;
          found=true;
          break;
        } else {
          i += pisSize;
        }
      }
    }
    if(found){
      this._promptIndex=promptIndex;
    }else{
      throw new Error("Internal error: Prompt index not found")
    }
    this.applyItem();
  }

  itemSelect(itemIdx: number) {
    if (this.status === Status.IDLE) {
      this.promptIndex=itemIdx;
    }

  }



  startItem() {
    this.transportActions.startAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    if(this.readonly){
      return
    }
    this.transportActions.fwdAction.disabled = true
    this.transportActions.bwdAction.disabled = true
    this.displayRecFile = null;
    this.displayRecFileVersion = 0;
    this.displayAudioBuffer = null;
    this.showRecording();
    if (this.section.mode === 'AUTORECORDING') {
      this.autorecording = true;
    }

    if(!this.ac.opened) {
      if(this._selectedDeviceId){
        console.log("Open session with audio device Id: \'" + this._selectedDeviceId + "\' for "+this._channelCount+" channels");
      }else{
        console.log("Open session with default audio device for " + this._channelCount + " channels");
      }
      this.ac.open(this._channelCount,this._selectedDeviceId);
    }else {
      this.ac.start();
    }
  }


  private loadScript() {
    this.promptItemCount = 0;

    this.items = new Array<Item>();
    let ln = 0;

    //TODO randomize not supported
    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let gs = section.groups;
      for(let gi=0;gi<gs.length;gi++) {

          let pis = gs[gi].promptItems;

          let pisLen = pis.length;
          this.promptItemCount += pisLen;
          for (let piSectIdx = 0; piSectIdx < pisLen; piSectIdx++) {
            let pi = pis[piSectIdx];
            let promptAsStr = '';
            if (pi.mediaitems && pi.mediaitems.length > 0) {
              promptAsStr = pi.mediaitems[0].text;
            }

            let it = new Item(promptAsStr, section.training);
            this.items.push(it);
            ln++;
          }
      }
    }
  }

  promptIndexByItemcode(itemcode:string):number {
    let pix = 0;

    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let gs = section.groups;
      for(let gi=0;gi<gs.length;gi++) {
        let pis=gs[gi].promptItems;
        let pisLen = pis.length;
        for (let piSectIdx = 0; piSectIdx < pisLen; piSectIdx++) {
          let pi = pis[piSectIdx];
          let ic=pi.itemcode;
          if(ic === itemcode){
            return pix;
          }
          pix++;
        }
      }
    }
    return null;
  }

  clearPrompt() {
    //this.prompting.promptContainer.prompter.promptText='';
    //this.mediaitem = null;
    this.showPrompt = false;
    this.changeDetectorRef.detectChanges()
  }

  applyPrompt() {
    //this.prompting.promptContainer.prompter.promptText=this.promptUnit.mediaitems[0].text;
    //this.promptText = this.promptUnit.mediaitems[0].text;
    //this.mediaitem=this.promptUnit.mediaitems[0];
    this.showPrompt = true;
    this.changeDetectorRef.detectChanges()
  }

  downloadRecording() {
    if (this.displayRecFile) {
      let ab: AudioBuffer = this.displayRecFile.audioBuffer;
      let ww = new WavWriter();
      let wavFile = ww.writeAsync(ab, (wavFile) => {
        let blob = new Blob([wavFile], {type: 'audio/wav'});
        let rfUrl = URL.createObjectURL(blob);

        // TODO Angular compatible ??
        let dataDnlLnk = document.createElement("a");

        dataDnlLnk.name = 'Recording';
        dataDnlLnk.href = rfUrl;

        document.body.appendChild(dataDnlLnk);

        // download property not yet in TS def
        if (this.displayRecFile) {
          let fn = this.displayRecFile.filenameString();
          fn += '_' + this.displayRecFileVersion;
          fn += '.wav';
          dataDnlLnk.setAttribute('download', fn);
          dataDnlLnk.click();
        }
        document.body.removeChild(dataDnlLnk);
        //window.open(rfUrl);
      });
    }
  }

  set displayRecFile(displayRecFile: RecordingFile | null) {
    this._displayRecFile = displayRecFile;
    if (this._displayRecFile) {
      let ab: AudioBuffer = this._displayRecFile.audioBuffer;
      if(ab) {
        this.displayAudioBuffer = ab;
        this.controlAudioPlayer.audioBuffer = ab;
      }else{
        // clear for now ...
        this.displayAudioBuffer = null;
        this.controlAudioPlayer.audioBuffer = null;
        //... and try to fetch from server
        this.audioFetchSubscription=this.recFileService.fetchAndApplyRecordingFile(this._controlAudioPlayer.context,this._session.project,this._displayRecFile).subscribe((rf)=>{
          let fab=null;
          if(rf) {
            fab=this._displayRecFile.audioBuffer;
          }else{
            this.statusMsg='Recording file could not be loaded.'
            this.statusAlertType='error'
          }
            this.displayAudioBuffer = fab;
            this.controlAudioPlayer.audioBuffer = fab;
          this.showRecording();

        },err=>{
          console.error("Could not load recording file from server: "+err)
          this.statusMsg='Recording file could not be loaded: '+err
          this.statusAlertType='error'
        })
      }

    } else {
      this.displayAudioBuffer = null;
      this.controlAudioPlayer.audioBuffer = null;
    }
  }

  get displayRecFile(): RecordingFile | null {
    return this._displayRecFile;
  }

  showRecording() {
    this.controlAudioPlayer.stop();

    if (this.displayAudioBuffer) {

      this.levelMeasure.calcBufferLevelInfos(this.displayAudioBuffer, LEVEL_BAR_INTERVALL_SECONDS).then((levelInfos) => {
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


  isRecordingItem():boolean{
    return(this.promptItem!=null && this.promptItem.type!=='nonrecording')
  }

  updateStartActionDisableState(){
    this.transportActions.startAction.disabled=!(this.ac  && this.isRecordingItem());
  }

  applyItem(temporary=false) {

    this.section = this._script.sections[this.sectIdx]
    this.group = this.section.groups[this.groupIdxInSection];
    this.promptItem = this.group.promptItems[this.promptItemIdxInGroup];

    //this.selectedItemIdx = this.promptIndex;

    if(this.audioFetchSubscription){
      this.audioFetchSubscription.unsubscribe()
    }

    this.clearPrompt();

    let isNonrecording=(this.promptItem.type==='nonrecording')

    if (isNonrecording || !this.section.promptphase || this.section.promptphase === 'IDLE') {
      this.applyPrompt();
    }

    if(isNonrecording){
      this.startStopSignalState = StartStopSignalState.OFF;
    }else {
      let it = this.items[this.promptIndex];
      if (!it.recs) {
        it.recs = new Array<RecordingFile>();
      }

      let recentRecFile: RecordingFile | null = null;
      let availRecfiles: number = it.recs.length;
      if (availRecfiles > 0) {
        let rfVers: number = availRecfiles - 1;
        recentRecFile = it.recs[rfVers];
        this.displayRecFile = recentRecFile;
        this.displayRecFileVersion = rfVers;

      } else {
        this.displayRecFile = null;
        this.displayRecFileVersion = 0;
      }
      if (!temporary) {
        this.showRecording();
      }
      if(!this.readonly) {
        this.startStopSignalState = StartStopSignalState.IDLE;
      }
    }
    this.updateStartActionDisableState()

  }


  start() {

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
      if (this._session.status === "CREATED") {
        this._session.status = "LOADED";
        if (!this._session.loadedDate) {
          this._session.loadedDate = new Date();
        }
      } else {
        this._session.restartedDate = new Date();
      }
      this.sessionService.putSessionObserver(this._session).subscribe()
    }
    //console.log("Session ID: "+this._session.sessionId+ " status: "+this._session.status)
    this._selectedDeviceId=null;

    if (!this.readonly && this.ac) {
      this.statusMsg = 'Requesting audio permissions...';
      this.statusAlertType = 'info';

      this.ac.deviceInfos((mdis) => {
        let audioCaptureDeviceAvail: boolean = false;
        let audioPlayDeviceAvail: boolean = false;
        if (mdis) {
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

          if (this._session.type !== 'TEST_DEF_A' && this._audioDevices && this._audioDevices.length > 0) {
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
              console.log("Set selected audio device: \'" + fdi.label + "\' Id: \'" + fdi.deviceId + "\'");
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
    if(this.promptItemCount>0) {
      this.promptIndex = 0;
    }
    this.enableNavigation()
  }

  isRecording(): boolean {
    return (this.status === Status.PRE_RECORDING || this.status === Status.RECORDING);
  }

  isActive(): boolean{
    return (!(this.status === Status.BLOCKED || this.status=== Status.IDLE || this.status===Status.ERROR) || this.processingRecording || this.sessionService.uploadCount>0)
  }

    prevItem() {
       let newPrIdx=this._promptIndex;
       newPrIdx--;
       if(newPrIdx<0){
         newPrIdx=this.promptItemCount-1;
       }
       this.promptIndex=newPrIdx;
    }


  nextItem() {
    let newPrIdx=this._promptIndex;
    newPrIdx++;
    if(newPrIdx>=this.promptItemCount){
      newPrIdx=0;
    }
    this.promptIndex=newPrIdx;
  }


  enableStartUserGesture() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Ready.';
    //this.updateStartActionDisableState()
    this.transportActions.startAction.disabled=!(this.ac && this.isRecordingItem());

  }

  enableNavigation(){
    this.transportActions.fwdAction.disabled = false
    this.transportActions.bwdAction.disabled = false
  }

  opened() {
    // this.statusAlertType = 'info';
    // this.statusMsg = 'Ready.';
    // this.updateStartActionDisableState()
    // this.transportActions.fwdAction.disabled = false
    // this.transportActions.bwdAction.disabled = false
    this.ac.start();
  }

  started() {
    this.status = Status.PRE_RECORDING;
    this.transportActions.startAction.disabled = true;
    this.startStopSignalState = StartStopSignalState.PRERECORDING;
    if(this._session.status==="LOADED") {

      if (this.section.training) {
        this._session.status = "STARTED_TRAINING"
        if(!this._session.startedTrainingDate) {
          this._session.startedTrainingDate = new Date();
        }
      } else {
        this._session.status = "STARTED"
        if(!this._session.startedDate) {
          this._session.startedDate = new Date();
        }
      }
      this.sessionService.putSessionObserver(this._session).subscribe()
    }
    if (this.section.promptphase === 'PRERECORDING') {
      this.applyPrompt();
    }
    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

    let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
    if (this.promptItem.recduration) {
      maxRecordingTimeMs = this.promptItem.recduration;
    }
    this.maxRecTimerId = window.setTimeout(() => {
      this.stopRecordingMaxRec()
    }, maxRecordingTimeMs);
    this.maxRecTimerRunning = true;

    let preDelay = 1000;
    if (this.promptItem.prerecording) {
      preDelay = this.promptItem.prerecording;
    }

    this.preRecTimerId = window.setTimeout(() => {

      this.preRecTimerRunning = false;
      this.status = Status.RECORDING;
      this.startStopSignalState = StartStopSignalState.RECORDING;
      if (this.section.mode === 'AUTORECORDING') {
        this.transportActions.nextAction.disabled = false;
        this.transportActions.pauseAction.disabled = false;
      } else {
        this.transportActions.stopAction.disabled = false;
      }
      if (this.section.promptphase === 'RECORDING') {
        this.applyPrompt();
      }
    }, preDelay);
    this.preRecTimerRunning = true;
  }

  stopItem() {
    this.status = Status.POST_REC_STOP;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    let postDelay = 500;
    if (this.promptItem.postrecording) {
      postDelay = this.promptItem.postrecording;
    }
    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_STOP;
      this.stopRecording();
    }, postDelay);
    this.postRecTimerRunning = true;
  }

  pauseItem() {
    this.status = Status.POST_REC_PAUSE;
    this.transportActions.pauseAction.disabled = true;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    let postDelay = 500;
    if (this.promptItem.postrecording) {
      postDelay = this.promptItem.postrecording;
    }


    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_PAUSE;
      this.stopRecording();
    }, postDelay);
    this.postRecTimerRunning = true;
  }

  stopRecording() {
    if (this.maxRecTimerRunning) {
      window.clearTimeout(this.maxRecTimerId);
      this.maxRecTimerRunning = false;
    }
    this.ac.stop();
  }

  stopRecordingMaxRec(){
    if(this.postRecTimerRunning){
        window.clearTimeout(this.postRecTimerId);
        this.postRecTimerRunning=false;
    }
    this.maxRecTimerRunning = false;
    this.status = Status.STOPPING_STOP;
    this.ac.stop();
  }

  addRecordingFileByDescriptor(rfd:RecordingFileDescriptor){
      let prIdx=this.promptIndexByItemcode(rfd.recording.itemcode)
    if(prIdx!==null) {
      let it = this.items[prIdx];
      if (it) {
        if (!it.recs) {
          it.recs = new Array<RecordingFile>();
        }
        let rf = new RecordingFile(this._session.sessionId, rfd.recording.itemcode,rfd.version, null);
        it.recs[rfd.version]=rf;

      } else {
        console.log("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
      }
    }else{
      console.log("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
    }
  }

  addRecordingFileByPromptIndex(promptIndex:number, rf:RecordingFile){

  }


  stopped() {
    this.updateStartActionDisableState()
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = 'Recorded.';
    this.startStopSignalState = StartStopSignalState.IDLE;

    let ad = this.ac.audioBuffer();
    let ic = this.promptItem.itemcode;
    if (this._session && ic) {
      let sessId: string | number = this._session.sessionId;
      let cpIdx = this.promptIndex;
      let it = this.items[cpIdx];
      if (!it.recs) {
        it.recs = new Array<RecordingFile>();
      }
      let rf = new RecordingFile(sessId, ic,it.recs.length,ad);
      it.recs.push(rf);

      if (this.enableUploadRecordings) {
        // TODO use SpeechRecorderconfig resp. RecfileService
        //new REST API URL

        let apiEndPoint = '';

        if (this.config && this.config.apiEndPoint) {
          apiEndPoint = this.config.apiEndPoint;
        }
        if (apiEndPoint !== '') {
          apiEndPoint = apiEndPoint + '/'
        }

        let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
        let recUrl: string = sessionsUrl + '/' + rf.sessionId + '/' + RECFILE_API_CTX + '/' + rf.itemCode;



          // convert asynchronously to 16-bit integer PCM
          // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
          // TODO duplicate conversion for manual download
          //console.log("Build wav writer...");
          this.processingRecording=true
          let ww = new WavWriter();
          ww.writeAsync(ad, (wavFile) => {
            this.postRecording(wavFile, recUrl);
            this.processingRecording=false
          });
      }
    }

    // check complete session
    let complete = true;
    // search backwards, to gain faster detection of incomplete state
    for (let ri = this.items.length - 1; ri >= 0; ri--) {
      let it = this.items[ri];
      if (!it.training && (!it.recs || it.recs.length == 0)) {

        complete = false;
        break;
      }
    }

    let autoStart = (this.status === Status.STOPPING_STOP);
    this.status = Status.IDLE;
    let startNext=false;
    if (complete) {
      if(!this._session.sealed && this._session.status!=="COMPLETED") {
          this._session.status = "COMPLETED"
          if(!this._session.completedDate) {
            this._session.completedDate = new Date()
          }
         this.sessionService.putSessionObserver(this._session).subscribe()
      }
      this.statusMsg = 'Session complete!';
      let dialogRef = this.dialog.open(SessionFinishedDialog, {});
    } else {

      if (this.section.mode === 'AUTOPROGRESS' || this.section.mode === 'AUTORECORDING') {
        this.nextItem();
      }

      if (this.section.mode === 'AUTORECORDING' && this.autorecording && autoStart) {
        startNext=true;
      } else {
        this.transportActions.fwdAction.disabled = false
        this.transportActions.bwdAction.disabled = false
      }
    }
    // apply recorded item
    this.applyItem(startNext);
    if(startNext){
      this.startItem();
    }
    this.changeDetectorRef.detectChanges();
  }

  postRecording(wavFile: Uint8Array, recUrl: string) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
    let ul = new Upload(wavBlob, recUrl);
    this.uploader.queueUpload(ul);
  }

  stop() {
    this.ac.close();
  }


  startControlPlayback() {
    this.playStartAction.perform();
  }

  private updateControlPlaybackPosition() {
    if (this._controlAudioPlayer.playPositionFrames) {
      this.prompting.audioDisplay.playFramePosition = this._controlAudioPlayer.playPositionFrames;
      this.liveLevelDisplay.playFramePosition = this._controlAudioPlayer.playPositionFrames;
    }
  }

  audioPlayerUpdate(e: AudioPlayerEvent) {
    if (EventType.READY === e.type) {

    } else if (EventType.STARTED === e.type) {
      //this.status = 'Playback...';
      this.updateTimerId = window.setInterval(e => this.updateControlPlaybackPosition(), 50);

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


  error() {
    this.statusMsg = 'ERROR: Recording.';
    this.statusAlertType = 'error';
    this.dialog.open(MessageDialog, {
      data: {
        type: 'error',
        title: 'Recording error',
        msg: 'An unknown error occured during recording.',
        advice: 'Please retry.'
      }
    });
  }
}

