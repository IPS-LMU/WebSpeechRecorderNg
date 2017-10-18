import {Action} from '../../action/action'
import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'
import {Script, Section, PromptUnit, Mediaitem} from '../script/script';
import {RecordingFile} from '../recording'
import {Upload} from '../../net/uploader';
import {
  Component, ViewChild, ChangeDetectorRef, Inject,
  AfterViewInit, HostListener
} from "@angular/core";
import {SESSION_API_CTX, SessionService} from "./session.service";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {MatDialog} from "@angular/material";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";
import {Session} from "./session";
import {AudioDevice} from "../project/project";
import {LevelBarDisplay} from "../../ui/livelevel_display";
import {LevelInfos, LevelMeasure, StreamLevelMeasure} from "../../audio/dsp/level_measure";
import {Prompting} from "./prompting";
import {SequenceAudioFloat32ChunkerOutStream} from "../../audio/io/stream";
import {TransportActions} from "./controlpanel";
import {SessionFinishedDialog} from "./session_finished_dialog";
import {MessageDialog} from "../../ui/message_dialog";

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

    <app-sprprompting [startStopSignalState]="startStopSignalState" [promptUnit]="promptUnit" [showPrompt]="showPrompt"
                      [items]="items"
                      [selectedItemIdx]="selectedItemIdx" (onItemSelect)="itemSelect($event)"></app-sprprompting>
    <div #asCt [class.active]="!audioSignalCollapsed">
      <app-audio #audioSignalContainer [class.active]="!audioSignalCollapsed"
                 [audioData]="displayAudioBuffer"></app-audio>
    </div>
    <spr-recordingitemdisplay #levelbardisplay
                              [controlAudioPlayer]="controlAudioPlayer"
                              [streamingMode]="isRecording()"
                              [displayLevelInfos]="displayLevelInfos"
                              [displayAudioBuffer]="displayAudioBuffer" [audioSignalCollapsed]="audioSignalCollapsed"
                              (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed"
                              (onDownloadRecording)="downloadRecording()" (onStartPlayback)="startControlPlayback()"
                              [enableDownload]="enableDownloadRecordings"></spr-recordingitemdisplay>
    <app-sprcontrolpanel [enableUploadRecordings]="enableUploadRecordings" [currentRecording]="displayAudioBuffer"
                         [transportActions]="transportActions" [statusMsg]="statusMsg"
                         [statusAlertType]="statusAlertType" [uploadProgress]="uploadProgress"
                         [uploadStatus]="uploadStatus"></app-sprcontrolpanel>

  `,
  styles: [`:host {
    flex: 2;
    background: lightgrey;
    display: flex; /* Vertical flex container: Bottom transport panel, above prompting panel */
    flex-direction: column;
    margin: 0;
    padding: 0;
    min-height: 0px;
  }`,`
  div{
     flex: 0;
    overflow: hidden;
      
  }`,`
  div.active {
    flex: 2;
      display: flex;
    
    overflow: hidden;  
   
      margin: 20px;
      /* border: 20px; */
      z-index: 5;
  }`,`
  app-audio.active{
      
  }
  `]
})
export class SessionManager implements AfterViewInit, AudioCaptureListener {

  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status=Status.BLOCKED;
  mode: Mode;
  ac: AudioCapture;
  private _channelCount = 2; //TODO define constant for default format
  @ViewChild(Prompting) prompting: Prompting;
  @ViewChild(LevelBarDisplay) liveLevelDisplay: LevelBarDisplay;

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

  private section: Section;
  promptUnit: PromptUnit;
  showPrompt:boolean;

  sectIdx: number;
  prmptIdx: number;
  private autorecording: boolean;

  items: Array<Item>;
  selectedItemIdx: number;
  private displayRecFile: RecordingFile | null;
  private displayRecFileVersion: number;
  displayAudioBuffer: AudioBuffer | null;
  displayLevelInfos: LevelInfos | null;

  promptItemCount: number;

  statusMsg: string;
  statusAlertType: string;

  uploadProgress: number = 100;
  uploadStatus: string = 'ok'
  audioSignalCollapsed = true;

  private streamLevelMeasure: StreamLevelMeasure;
  private levelMeasure: LevelMeasure;
  controlAudioPlayer: AudioPlayer;



  constructor(private changeDetectorRef: ChangeDetectorRef,
              public dialog: MatDialog,
              private uploader: SpeechRecorderUploader,
              @Inject(SPEECHRECORDER_CONFIG) public config?: SpeechRecorderConfig) {
    this.status = Status.IDLE;
    this.mode = Mode.SERVER_BOUND;

    //this._startStopSignal = startStopSignal;

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

  init() {
    this.sectIdx = 0;
    this.prmptIdx = 0;
    this.autorecording = false;
    this.transportActions.startAction.disabled = true;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.playStartAction.disabled = true;

    let w = <any>window;
    let n = <any>navigator;

    w.AudioContext = w.AudioContext || w.webkitAudioContext;
    let debugFail = false;
    if (!w.AudioContext || typeof w.AudioContext !== 'function' || debugFail) {
      this.status = Status.ERROR;
      let errMsg='Browser does not support Web Audio API!';
      this.statusMsg = 'ERROR: '+errMsg;
      this.statusAlertType = 'error';
      this.dialog.open(MessageDialog,{data:{type:'error',title:'Error',msg:errMsg,advise:'Please use a supported browser.',}});
      return;
    } else {
      let context = new w.AudioContext();

      if (!navigator.mediaDevices) {
        this.status = Status.ERROR;
        let errMsg='Browser does not support Media streams!';
        this.statusMsg = 'ERROR: '+errMsg;
        this.statusAlertType = 'error';
        this.dialog.open(MessageDialog,{data:{type:'error',title:'Error',msg:errMsg,advise:'Please use a supported browser.',}});
        return;
      } else {
        this.ac = new AudioCapture(context);
        if (this.ac) {
          this.transportActions.startAction.onAction = () => this.startItem();
          this.ac.listener = this;
          this.ac.audioOutStream = new SequenceAudioFloat32ChunkerOutStream(this.streamLevelMeasure, LEVEL_BAR_INTERVALL_SECONDS);
        } else {
          this.transportActions.startAction.disabled = true;
          let errMsg = 'Browser does not support Media/Audio API!';
          this.statusMsg = 'ERROR: '+errMsg;
          this.statusAlertType = 'error';
          this.dialog.open(MessageDialog,{data:{type:'error',title:'Error',msg:errMsg,advise:'Please use a supported browser.',}});
          return;
        }
        this.transportActions.stopAction.onAction = () => this.stopItem();
        this.transportActions.nextAction.onAction = () => this.stopItem();
        this.transportActions.pauseAction.onAction = () => this.pauseItem();
        this.transportActions.fwdAction.onAction = () => this.nextItem();
        this.transportActions.bwdAction.onAction = () => this.prevItem();
        this.playStartAction.onAction = () => this.controlAudioPlayer.start();

      }
      this.ac.listDevices();
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

  set session(session: Session) {
    this._session = session;
  }

  set script(script: any) {
    this._script = script;
    this.loadScript();

    this.sectIdx = 0;
    this.prmptIdx = 0;

    this.applyItem();

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

  itemSelect(itemIdx: number) {
    if (this.status !== Status.IDLE) {
      return;
    }
    let i = 0;
    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let pis = section.promptUnits;
      let sLen = pis.length;
      if (itemIdx < i + sLen) {
        this.sectIdx = si;
        this.prmptIdx = itemIdx - i;
        break;
      } else {
        i += pis.length;
      }
    }

    this.applyItem();
  }

  startItem() {
    this.transportActions.startAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.transportActions.fwdAction.disabled = true
    this.transportActions.bwdAction.disabled = true
    this.displayRecFile = null;
    this.displayRecFileVersion = 0;
    this.displayAudioBuffer = null;
    this.showRecording();
    if (this.section.mode === 'AUTORECORDING') {
      this.autorecording = true;
    }
    this.ac.start();

  }


  loadScript() {
    this.promptItemCount = 0;

    this.items = new Array<Item>();
    let ln = 0;

    //TODO randomize not supported
    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let pis = section.promptUnits;

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

  currPromptIndex() {
    let idx = 0;
    for (let si = 0; si < this.sectIdx; si++) {
      let section = this._script.sections[si];
      let pis = section.promptUnits;
      idx += pis.length;
    }
    idx += this.prmptIdx;
    return idx;
  }


  clearPrompt() {
    //this.prompting.promptContainer.prompter.promptText='';
    //this.mediaitem = null;
    this.showPrompt=false;
    this.changeDetectorRef.detectChanges()
  }

  applyPrompt() {
    //this.prompting.promptContainer.prompter.promptText=this.promptUnit.mediaitems[0].text;
    //this.promptText = this.promptUnit.mediaitems[0].text;
    //this.mediaitem=this.promptUnit.mediaitems[0];
    this.showPrompt=true;
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

  showRecording() {
    this.controlAudioPlayer.stop();

    if (this.displayRecFile) {
      let ab: AudioBuffer = this.displayRecFile.audioBuffer;
      this.displayAudioBuffer = ab;
      this.levelMeasure.calcBufferLevelInfos(this.displayAudioBuffer, LEVEL_BAR_INTERVALL_SECONDS).then((levelInfos) => {
        this.displayLevelInfos = levelInfos;
        this.changeDetectorRef.detectChanges();
      });
      this.playStartAction.disabled = false;
      this.controlAudioPlayer.audioBuffer = ab;
    } else {
      this.displayAudioBuffer = null;
      // TODO
        // Setting to null does not trigger a change if it was  null before (happens after nextitem() in AUTOPROGRESS mode)
        // The level bar display does not clear, it shows the last captured stream
      this.displayLevelInfos = null;
      this.controlAudioPlayer.audioBuffer = null;
      this.playStartAction.disabled = true;

      // Collapse audio signal display if open
      if(!this.audioSignalCollapsed){
        this.audioSignalCollapsed=true;
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  applyItem() {

    this.section = this._script.sections[this.sectIdx]
    this.promptUnit = this.section.promptUnits[this.prmptIdx];

    this.clearPrompt();
    if (this.section.promptphase === 'IDLE') {
      this.applyPrompt();
    }

    this.selectedItemIdx = this.currPromptIndex();
    let it = this.items[this.selectedItemIdx];
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
    this.showRecording();
    this.startStopSignalState = StartStopSignalState.IDLE;

  }


  start() {

    if (this.ac) {
      this.statusMsg = 'Requesting audio permissions...';
      this.statusAlertType = 'info';

      if (this._audioDevices) {
        let fdi: MediaDeviceInfo | null = null;

        this.ac.deviceInfos((mdis) => {
          if (mdis && this._audioDevices) {
            for (let adI = 0; adI < this._audioDevices.length; adI++) {
              let ad = this._audioDevices[adI];
              if (ad.playback) {
                // project audio device config for playback device
                // not used for now
                continue;
              }
              for (let mdii = 0; mdii < mdis.length; mdii++) {
                let mdi = mdis[mdii];
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
          }

          if (fdi) {
            // matching device found
            console.log("Open session with audio device \'" + fdi.label + "\' Id: \'" + fdi.deviceId + "\'");
            this.ac.open(this._channelCount, fdi.deviceId);
          } else {
            // device not found
            this.statusMsg = 'ERROR: Required audio device not available!';
            this.statusAlertType = 'error';

            this.dialog.open(MessageDialog,{data:{type:'error',
              title:'Required audio device',
              msg:"Required audio device not found",
              advice:"Please connect a suitable audio device for this project and retry."},
            })
          }
        });
      } else {
        console.log("Open session with default audio device");
        this.ac.open(this._channelCount);
      }


    }
  }

  isRecording():boolean{
    return (this.status===Status.PRE_RECORDING || this.status===Status.RECORDING);
  }

  prevItem() {
    let scriptLength = this._script.sections.length;

    this.prmptIdx--;
    if (this.prmptIdx < 0) {
      this.sectIdx--;
      if (this.sectIdx < 0) {
        this.sectIdx = scriptLength - 1;
      }
      let currSectLength = this._script.sections[this.sectIdx].promptUnits.length;
      this.prmptIdx = currSectLength - 1;

    }
    this.applyItem();
  }

  nextItem() {
    let scriptLength = this._script.sections.length;
    let currSectLength = this._script.sections[this.sectIdx].promptUnits.length;
    this.prmptIdx++;
    if (this.prmptIdx >= currSectLength) {
      this.sectIdx++;
      this.prmptIdx = 0;
      if (this.sectIdx >= scriptLength) {
        this.sectIdx = 0;
      }
    }
    this.applyItem();
  }


  opened() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Ready.';
    this.transportActions.startAction.disabled = false;
    this.transportActions.fwdAction.disabled = false
    this.transportActions.bwdAction.disabled = false
  }

  started() {
    this.status = Status.PRE_RECORDING;
    this.transportActions.startAction.disabled = true;
    this.startStopSignalState = StartStopSignalState.PRERECORDING;

    if (this.section.promptphase === 'PRERECORDING') {
      this.applyPrompt();
    }
    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

    let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
    if (this.promptUnit.recduration) {
      maxRecordingTimeMs = this.promptUnit.recduration;
    }
    this.maxRecTimerId = window.setTimeout(() => {
      this.maxRecTimerRunning = false;
      this.status = Status.STOPPING_STOP;
      this.ac.stop();
    }, maxRecordingTimeMs);
    this.maxRecTimerRunning = true;

    let preDelay = 1000;
    if (this.promptUnit.prerecording) {
      preDelay = this.promptUnit.prerecording;
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
    if (this.promptUnit.postrecording) {
      postDelay = this.promptUnit.postrecording;
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
    if (this.promptUnit.postrecording) {
      postDelay = this.promptUnit.postrecording;
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

  stopped() {
    this.transportActions.startAction.disabled = false;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = 'Recorded.';
    this.startStopSignalState = StartStopSignalState.IDLE;

    let ad = this.ac.audioBuffer();
    let ic = this._script.sections[this.sectIdx].promptUnits[this.prmptIdx].itemcode;
    if (this._session && ic) {
      let sessId: string | number = this._session.sessionId;
      let rf = new RecordingFile(sessId, ic, ad);
      let cpIdx = this.currPromptIndex();
      let it = this.items[cpIdx];
      if (!it.recs) {
        it.recs = new Array<RecordingFile>();
      }
      it.recs.push(rf);



      if (this.mode === Mode.SERVER_BOUND) {
        // TODO use SpeechRecorderconfig resp. RecfileService
        //new REST API URL

        let apiEndPoint = '';

        if (this.config && this.config.apiEndPoint) {
          apiEndPoint = this.config.apiEndPoint;
        }
        if (apiEndPoint !== '') {
          apiEndPoint = apiEndPoint + '/'
        }

        let sessionsUrl = apiEndPoint + SESSION_API_CTX;
        let recUrl: string = sessionsUrl + '/' + rf.sessionId + '/' + RECFILE_API_CTX + '/' + rf.itemCode;


        if (this.config && this.config.enableUploadRecordings) {
          // convert asynchronously to 16-bit integer PCM
          // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
          // TODO duplicate conversion for manual download
          //console.log("Build wav writer...");
          let ww = new WavWriter();
          ww.writeAsync(ad, (wavFile) => {
            this.postRecording(wavFile, recUrl);
          });
        }
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

    let autoStart=(this.status === Status.STOPPING_STOP);
    this.status=Status.IDLE;
    if (complete) {
      this.statusMsg = 'Session complete!';
      let dialogRef = this.dialog.open(SessionFinishedDialog, {});
    } else {

      if (this.section.mode === 'AUTOPROGRESS' || this.section.mode === 'AUTORECORDING') {
        this.nextItem();
      }

      if (this.section.mode === 'AUTORECORDING' && this.autorecording && autoStart) {
        this.startItem();
      } else {
        this.transportActions.fwdAction.disabled = false
        this.transportActions.bwdAction.disabled = false
      }
    }
      // apply recorded item
      this.applyItem();
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


  startControlPlayback(){
    this.playStartAction.perform();
  }

  closed() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Session closed.';
  }


  error() {
    this.statusMsg = 'ERROR: Recording.';
    this.statusAlertType = 'error';
    this.dialog.open(MessageDialog,{
      data:{
        type:'error',
        title:'Recording error',
        msg:'An unknown error occured during recording.',
        advice:'Please retry.'
      }
    });
  }
}

