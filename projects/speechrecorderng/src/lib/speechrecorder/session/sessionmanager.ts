import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter} from '../../audio/impl/wavwriter'
import {Group, PromptItem, PromptitemUtil, Script, Section} from '../script/script';
import {SprRecordingFile, RecordingFileDescriptorImpl, RecordingFile} from '../recording'
import {Upload} from '../../net/uploader';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  Renderer2,
  ViewChild
} from "@angular/core";
import {SessionService} from "./session.service";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {MatDialog} from "@angular/material/dialog";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Prompting} from "./prompting";
import {SessionFinishedDialog} from "./session_finished_dialog";
import {MessageDialog} from "../../ui/message_dialog";
import {RecordingService} from "../recordings/recordings.service";
import {AudioContextProvider} from "../../audio/context";
import {AudioClip} from "../../audio/persistor";
import {Item} from "./item";
import {LevelBar} from "../../audio/ui/livelevel";
import {
  BasicRecorder,
  ChunkAudioBufferReceiver,
  MAX_RECORDING_TIME_MS,
  RECFILE_API_CTX
} from "./basicrecorder";
import {ArrayAudioBuffer} from "../../audio/array_audio_buffer";
import {AudioDataHolder} from "../../audio/audio_data_holder";
import {SprItemsCache} from "./recording_file_cache";
import {State as LiveLevelState} from "../../audio/ui/livelevel"
import {IndexedDbAudioBuffer, PersistentAudioStorageTarget} from "../../audio/inddb_audio_buffer";

const DEFAULT_PRE_REC_DELAY=1000;
const DEFAULT_POST_REC_DELAY=500;

export const enum Status {
  BLOCKED, IDLE, STARTING, PRE_RECORDING, RECORDING, POST_REC_STOP, POST_REC_PAUSE, STOPPING_STOP, STOPPING_PAUSE, ERROR
}

@Component({
  selector: 'app-sprrecordingsession',
  providers: [SessionService],
  template: `
    <app-warningbar [show]="isTestSession()" warningText="Test recording only!"></app-warningbar>
    <app-warningbar [show]="isDefaultAudioTestSession()" warningText="This test uses default audio device! Regular sessions may require a particular audio device (microphone)!"></app-warningbar>
      <app-sprprompting [projectName]="projectName"
                        [startStopSignalState]="startStopSignalState" [promptItem]="promptItem" [showPrompt]="showPrompt"
                        [items]="items?.items"
                        [transportActions]="transportActions"
                        [selectedItemIdx]="promptIndex" (onItemSelect)="itemSelect($event)" (onNextItem)="nextItem()" (onPrevItem)="prevItem()"
                        [audioSignalCollapsed]="audioSignalCollapsed" [displayAudioClip]="displayAudioClip"
                        [playStartAction]="controlAudioPlayer?.startAction"
                        [playSelectionAction]="controlAudioPlayer?.startSelectionAction"
                        [autoPlayOnSelectToggleAction]="controlAudioPlayer?.autoPlayOnSelectToggleAction"
                        [playStopAction]="controlAudioPlayer?.stopAction">

    </app-sprprompting>
    <mat-progress-bar [value]="progressPercentValue()" fxShow="false" fxShow.xs="true" ></mat-progress-bar>


    <div fxLayout="row" fxLayout.xs="column" [ngStyle]="{'height.px':100,'min-height.px': 100}" [ngStyle.xs]="{'height.px':125,'min-height.px': 125}">
      <audio-levelbar fxFlex="1 0 1" [streamingMode]="isRecording()" [displayLevelInfos]="displayAudioClip?.levelInfos"  [state]="liveLevelDisplayState"></audio-levelbar>
      <div fxLayout="row">
        <spr-recordingitemcontrols fxFlex="10 0 1"
                                   [audioLoaded]="displayAudioClip?.audioDataHolder!==null"
                                   [playStartAction]="controlAudioPlayer?.startAction"
                                   [playStopAction]="controlAudioPlayer?.stopAction"
                                   [peakDbLvl]="peakLevelInDb"
                                   [agc]="this.ac?.agcStatus"
                                   (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed">
        </spr-recordingitemcontrols>

        <app-uploadstatus class="ricontrols dark" fxHide fxShow.xs  fxFlex="0 0 0" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-wakelockindicator class="ricontrols dark" fxHide fxShow.xs fxFlex="0 0 0" [screenLocked]="screenLocked"></app-wakelockindicator>
        <app-readystateindicator class="ricontrols dark" fxHide fxShow.xs fxFlex="0 0 0" [ready]="dataSaved && !isActive()"></app-readystateindicator>
      </div>
    </div>
    <div #controlpanel class="controlpanel" fxLayout="row">
      <div fxFlex="1 1 30%" fxLayoutAlign="start center">
        <app-sprstatusdisplay fxHide.xs [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"></app-sprstatusdisplay>
      </div>
      <app-sprtransport fxFlex="10 0 30%" fxLayoutAlign="center center" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="!items || items.length()>1"></app-sprtransport>
      <div fxFlex="1 1 30%" fxLayoutAlign="end center" fxLayout="row">
        <app-uploadstatus class="ricontrols" fxHide.xs fxLayoutAlign="end center" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                          [status]="uploadStatus" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        <app-wakelockindicator class="ricontrols" fxLayoutAlign="end center" fxHide.xs [screenLocked]="screenLocked"></app-wakelockindicator>
        <app-readystateindicator class="ricontrols" fxLayoutAlign="end center" fxHide.xs [ready]="dataSaved && !isActive()"></app-readystateindicator>
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
  }`]
})
export class SessionManager extends BasicRecorder implements AfterViewInit,OnDestroy, AudioCaptureListener,ChunkAudioBufferReceiver {
  get persistentAudioStorageTarget(): PersistentAudioStorageTarget | null {
    return this._persistentAudioStorageTarget;
  }

  set persistentAudioStorageTarget(value: PersistentAudioStorageTarget | null) {
    this._persistentAudioStorageTarget = value;
    if(this.ac) {
      this.ac.persistentAudioStorageTarget = this.persistentAudioStorageTarget;
    }
  }

  @Input() projectName:string|undefined;
  enableUploadRecordings: boolean = true;
  enableDownloadRecordings: boolean = false;
  status: Status = Status.BLOCKED;

  @ViewChild(Prompting, { static: true }) prompting!: Prompting;
  @ViewChild(LevelBar, { static: true }) liveLevelDisplay!: LevelBar;

  @Input() dataSaved=true

  startStopSignalState!: StartStopSignalState;

  private updateTimerId: any;
  private preRecTimerId: number|null=null;
  private preRecTimerRunning: boolean|null=null;
  private postDelay:number=DEFAULT_POST_REC_DELAY;
  private postRecTimerId: number|null=null;
  private postRecTimerRunning: boolean|null=null;
  private maxRecTimerId: number|null=null;
  private maxRecTimerRunning: boolean|null=null;

  dnlLnk!: HTMLAnchorElement;

  audio: any;
  _script!: Script;
  private _promptIndex=0;
  private section!: Section;
  group!: Group;
  promptItem!:PromptItem;
  showPrompt!: boolean;

  // index of current section
  sectIdx!: number;
  // index of current group in section
  groupIdxInSection!: number;
  // index of current prompt item in group
  promptItemIdxInGroup!: number;

  private autorecording!: boolean;

  items: SprItemsCache|null=null;
  //selectedItemIdx: number;
  private _displayRecFile: SprRecordingFile | null=null;
  private displayRecFileVersion!: number;

  promptItemCount!: number;

  constructor(changeDetectorRef: ChangeDetectorRef,
              private renderer: Renderer2,
              dialog: MatDialog,
              sessionService:SessionService,
              private recFileService:RecordingService,
              uploader: SpeechRecorderUploader,
              @Inject(SPEECHRECORDER_CONFIG) config?: SpeechRecorderConfig) {
    super(changeDetectorRef,dialog,sessionService,uploader,config);
    this.status = Status.IDLE;
    this.audio = document.getElementById('audio');
    if (this.config && this.config.enableUploadRecordings !== undefined) {
      this.enableUploadRecordings = this.config.enableUploadRecordings;
    }
    if (this.config && this.config.enableDownloadRecordings !== undefined) {
      this.enableDownloadRecordings = this.config.enableDownloadRecordings;
    }
    this.init();
  }



  ngAfterViewInit() {
    this.streamLevelMeasure.levelListener = this.liveLevelDisplay;
    this.streamLevelMeasure.peakLevelListener=(peakLvlInDb)=>{
      this.peakLevelInDb=peakLvlInDb;
      this.changeDetectorRef.detectChanges();
    }
  }
    ngOnDestroy() {
      //console.debug("Com destroy, disable wake lock.")
      this.disableWakeLockCond();
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
      this.transportActions.pauseAction.onAction = () => this.pauseItem();
      this.transportActions.fwdAction.onAction = () => this.nextItem();
      this.transportActions.fwdNextAction.onAction = () => this.nextUnrecordedItem();
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
    if (ke.key == ' ') {
      this.transportActions.stopAction.perform();
    }
    if (ke.key == 'p') {
      this.transportActions.pauseAction.perform();
    }

    if (ke.key == 'Escape') {
      if(!this.audioSignalCollapsed){
        this.audioSignalCollapsed=true;
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

  updateWakeLock(dataSaved:boolean=this.dataSaved){
    //console.debug("Update wake lock: dataSaved: "+dataSaved+", not active: "+! this.isActive())
    if(dataSaved && ! this.isActive()){
      this.disableWakeLockCond();
    }
  }

  progressPercentValue():number {
    let v=100;
    if(this.items) {
      v=this.promptIndex * 100 / (this.items.length() - 1);
    }
    return v;
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

  set controlAudioPlayer(controlAudioPlayer: AudioPlayer) {
    this._controlAudioPlayer=controlAudioPlayer;
    if (this._controlAudioPlayer) {
      this._controlAudioPlayer.listener = this;
    }
  }

  get controlAudioPlayer(): AudioPlayer {
    return this._controlAudioPlayer;
  }

  set script(script: any) {
    this._script = script;
    this.loadScript();
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
      let gs = section._shuffledGroups;
      for (let gi = 0; gi < gs.length; gi++) {
        let pis=gs[gi]._shuffledPromptItems;

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
    if (this.section.mode === 'AUTORECORDING') {
      this.autorecording = true;
    }

    if(this.ac!=null) {
      // Hide loading hint on livelevel display
      this.liveLevelDisplayState=LiveLevelState.READY;
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


  private loadScript() {
    this.promptItemCount = 0;

    this.items = new SprItemsCache();
    let ln = 0;

    //TODO randomize not supported
    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let gs = section._shuffledGroups;
      for(let gi=0;gi<gs.length;gi++) {

          let pis = gs[gi]._shuffledPromptItems;

          let pisLen = pis.length;
          this.promptItemCount += pisLen;
          for (let piSectIdx = 0; piSectIdx < pisLen; piSectIdx++) {
            let pi = pis[piSectIdx];
            let promptAsStr = PromptitemUtil.toPlainTextString(pi);

            let it = new Item(promptAsStr, section.training,(!pi.type || pi.type==='recording'));
            this.items.addItem(it);
            ln++;
          }
      }
    }
  }

  promptIndexByItemcode(itemcode:string):number|null{
    let pix = 0;

    for (let si = 0; si < this._script.sections.length; si++) {
      let section = this._script.sections[si];
      let gs = section._shuffledGroups;
      for(let gi=0;gi<gs.length;gi++) {
        let pis=gs[gi]._shuffledPromptItems;
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
      let ab: AudioDataHolder | null = this.displayRecFile.audioDataHolder;
      let ww = new WavWriter();
      if(ab?.buffer) {
        let wavFile = ww.writeAsync(ab.buffer, (wavFile) => {
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

  set displayRecFile(displayRecFile: SprRecordingFile | null) {
    this._displayRecFile = displayRecFile;

    if (this._displayRecFile) {
      if(this.items) {
        this.items.currentRecordingFile = this._displayRecFile;
      }
      let ab: AudioDataHolder| null = this._displayRecFile.audioDataHolder;
      if(ab) {
        this.displayAudioClip = new AudioClip(ab);
        this.controlAudioPlayer.audioClip = this.displayAudioClip;
      }else {
        // clear for now ...
        this.displayAudioClip = null;
        if(this.controlAudioPlayer) {
          this.controlAudioPlayer.audioClip = null;
        }
        if (this._controlAudioPlayer && this._session) {
          //... and try to fetch from server
          this.liveLevelDisplayState=LiveLevelState.LOADING;
          let rf=this._displayRecFile;
          if(this.uploadChunkSizeSeconds) {

            if(this._persistentAudioStorageTarget){
              // Fetch chunked indexed db audio buffer
              let nextIab: IndexedDbAudioBuffer | null = null;

              this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileIndDbAudioBuffer(this._controlAudioPlayer.context,this._persistentAudioStorageTarget, this._session.project, rf).subscribe({
                next: (iab) => {
                  //console.debug("Sessionmanager: Received inddb audio buffer: "+iab);
                  nextIab = iab;
                },
                complete: () => {
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  let fabDh = null;
                  if (nextIab) {
                    if (rf && this.items) {
                      fabDh = new AudioDataHolder(null, null,nextIab);
                      this.items.setSprRecFileAudioData(rf, fabDh);
                    }
                  } else {
                    // Should actually be handled by the error resolver
                    this.statusMsg = 'Recording file could not be loaded.'
                    this.statusAlertType = 'error'
                  }
                  if (fabDh) {
                    // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore there should be no risk to set to wrong item
                    this.displayAudioClip = new AudioClip(fabDh);
                  }
                  this.controlAudioPlayer.audioClip = this.displayAudioClip
                  this.showRecording();
                },
                error: err => {
                  console.error("Could not load recording file from server: " + err);
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  this.statusMsg = 'Recording file could not be loaded: ' + err;
                  this.statusAlertType = 'error';
                }
              });

            }else{
            // Fetch chunked array audio buffer
            let nextAab: ArrayAudioBuffer | null = null;

            this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileArrayAudioBuffer(this._controlAudioPlayer.context, this._session.project, rf).subscribe({
              next: (aab) => {
                nextAab = aab;
              },
              complete: () => {
                this.liveLevelDisplayState = LiveLevelState.READY;
                let fabDh = null;
                if (nextAab) {
                  if (rf && this.items) {
                    fabDh = new AudioDataHolder(null, nextAab);
                    this.items.setSprRecFileAudioData(rf, fabDh);
                  }
                } else {
                  // Should actually be handled by the error resolver
                  this.statusMsg = 'Recording file could not be loaded.'
                  this.statusAlertType = 'error'
                }
                if (fabDh) {
                  // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore there should be no risk to set to wrong item
                  this.displayAudioClip = new AudioClip(fabDh);
                }
                this.controlAudioPlayer.audioClip = this.displayAudioClip
                this.showRecording();
              },
              error: err => {
                console.error("Could not load recording file from server: " + err);
                this.liveLevelDisplayState = LiveLevelState.READY;
                this.statusMsg = 'Recording file could not be loaded: ' + err;
                this.statusAlertType = 'error';
              }
            });

          }
          }else {
            // Fetch regular audio buffer
            this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileAudioBuffer(this._controlAudioPlayer.context, this._session.project, rf).subscribe({
              next: (ab) => {
                this.liveLevelDisplayState = LiveLevelState.READY;
                let fabDh = null;
                if (ab) {
                  if (rf && this.items) {
                    if (SessionManager.FORCE_ARRRAY_AUDIO_BUFFER) {
                      let aab = ArrayAudioBuffer.fromAudioBuffer(ab);
                      fabDh = new AudioDataHolder(null, aab);
                    } else {
                      fabDh = new AudioDataHolder(ab);
                    }
                    this.items.setSprRecFileAudioData(rf, fabDh);
                  }
                } else {
                  // Should actually be handled by the error resolver
                  this.statusMsg = 'Recording file could not be loaded.'
                  this.statusAlertType = 'error'
                }
                if (fabDh) {
                  // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item. Therefore there should be no risk to set to wrong item
                  this.displayAudioClip = new AudioClip(fabDh);
                }
                this.controlAudioPlayer.audioClip = this.displayAudioClip
                this.showRecording();
              }, error: err => {
                console.error("Could not load recording file from server: " + err);
                this.liveLevelDisplayState = LiveLevelState.READY;
                this.statusMsg = 'Recording file could not be loaded: ' + err;
                this.statusAlertType = 'error';
              }
            });
          }
        }else{
          this.statusMsg = 'Recording file could not be decoded. Audio context unavailable.'
          this.statusAlertType = 'error'
        }
      }

    } else {
      this.displayAudioClip = null;
      if(this.controlAudioPlayer) {
        this.controlAudioPlayer.audioClip = null;
      }
    }
  }

  get displayRecFile(): SprRecordingFile | null {
    return this._displayRecFile;
  }

  isRecordingItem():boolean{
    return(this.promptItem!=null && this.promptItem.type!=='nonrecording')
  }

  updateStartActionDisableState(){
    this.transportActions.startAction.disabled=!(this.ac  && this.isRecordingItem());
  }

  applyItem(temporary=false) {

    this.section = this._script.sections[this.sectIdx]
    this.group = this.section._shuffledGroups[this.groupIdxInSection];
    this.promptItem = this.group._shuffledPromptItems[this.promptItemIdxInGroup];

    //this.selectedItemIdx = this.promptIndex;

    if(this.audioFetchSubscription){
      console.debug("Unsubscribe from audio fetch.");
      this.audioFetchSubscription.unsubscribe();
    }
    this.liveLevelDisplayState=LiveLevelState.READY;

    this.clearPrompt();

    let isNonrecording=(this.promptItem.type==='nonrecording')

    if (isNonrecording || !this.section.promptphase || this.section.promptphase === 'IDLE') {
      this.applyPrompt();
    }

    if(isNonrecording){
      this.displayRecFile = null;
      this.displayRecFileVersion = 0;
      this.startStopSignalState = StartStopSignalState.OFF;
    }else {
      if (this.items) {
        let it = this.items.getItem(this.promptIndex);
        if (!it.recs) {
          it.recs = new Array<SprRecordingFile>();
        }

        let recentRecFile: SprRecordingFile | null = null;
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
      }
      if(!this.readonly) {
        this.startStopSignalState = StartStopSignalState.IDLE;
      }
    }
    if (!temporary) {
      this.showRecording();
    }
    this.updateStartActionDisableState()
    this.updateNavigationActions()
  }


  start() {
    super.start();
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
      //this.updateNavigationActions()
    }


  nextItem() {
    let newPrIdx=this._promptIndex;
    newPrIdx++;
    if(newPrIdx>=this.promptItemCount){
      newPrIdx=0;
    }
    this.promptIndex=newPrIdx;
    //this.updateNavigationActions();
  }

  private updateNavigationActions(){
    let fwdNxtActionDisabled=true;
    if(this.items){
      let currRecs=this.items.getItem(this._promptIndex).recs;
      fwdNxtActionDisabled= ! (currRecs!=null && currRecs.length>0);
    }
    this.transportActions.fwdNextAction.disabled = this.navigationDisabled || fwdNxtActionDisabled;
    this.transportActions.fwdAction.disabled = this.navigationDisabled;
    this.transportActions.bwdAction.disabled = this.navigationDisabled;
  }

  nextUnrecordedItem() {
    let newPrIdx = this._promptIndex;
    newPrIdx++;
    if (newPrIdx >= this.promptItemCount) {
      newPrIdx = 0;
    }
    if(this.items!=null) {
      let it=this.items.getItem(newPrIdx);
      while (it.itemDone() && newPrIdx < this.promptItemCount) {
        newPrIdx++;
        it=this.items.getItem(newPrIdx);
      }
      if (!it.itemDone()) {
        this.promptIndex = newPrIdx;
      }
    }
  }

  enableStartUserGesture() {
    super.enableStartUserGesture();
    this.transportActions.startAction.disabled=!(this.ac && this.isRecordingItem());
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
    let ic = this.promptItem.itemcode;
    let rf=null;
    if (this._session && ic) {
      let sessId: string | number = this._session.sessionId;
      let cpIdx = this.promptIndex;
      if (this.items) {
        let it = this.items.getItem(cpIdx);
        if (!it.recs) {
          it.recs = new Array<SprRecordingFile>();
        }
        rf = new SprRecordingFile(sessId, ic, it.recs.length,null);

        //it.recs.push(rf);
        this.items.addSprRecFile(it,rf);
        this.items.currentRecordingFile=rf;
      }
    }
    this._recordingFile = rf;
    this.status = Status.PRE_RECORDING;
    super.started();
    this.startStopSignalState = StartStopSignalState.PRERECORDING;
    if(this._session) {
      if (this._session.status === "LOADED") {
        let body: any = {};
        if (this.section.training) {
          this._session.status = "STARTED_TRAINING"
          body.status = this._session.status;
          if (!this._session.startedTrainingDate) {
            this._session.startedTrainingDate = new Date();
            body.startedTrainingDate = this._session.startedTrainingDate;
          }
        } else {
          this._session.status = "STARTED"
          body.status = this._session.status;
          if (!this._session.startedDate) {
            this._session.startedDate = new Date();
            body.startedDate = this._session.startedDate;
          }
        }
        this.sessionService.patchSessionObserver(this._session, body).subscribe()
      }
    }
    if (this.section.promptphase === 'PRERECORDING' || this.section.promptphase === 'PRERECORDINGONLY') {
      this.applyPrompt();
    }
    this.statusAlertType = 'info';
    this.statusMsg = 'Recording...';

    let preDelay = DEFAULT_PRE_REC_DELAY;
    if (this.promptItem.prerecdelay!=null) {
      preDelay = this.promptItem.prerecdelay;
    }else if (this.promptItem.prerecording!=null) {
      preDelay = this.promptItem.prerecording;
    }

    this.postDelay=DEFAULT_POST_REC_DELAY;
    if(this.promptItem.postrecdelay!=null){
      this.postDelay=this.promptItem.postrecdelay;
    }else if(this.promptItem.postrecording!=null){
      this.postDelay=this.promptItem.postrecording;
    }

    let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
    if (this.promptItem.recduration!==null && this.promptItem.recduration!==undefined) {
      maxRecordingTimeMs = preDelay+this.promptItem.recduration+this.postDelay;
    }
    this.maxRecTimerId = window.setTimeout(() => {
      this.stopRecordingMaxRec()
    }, maxRecordingTimeMs);
    this.maxRecTimerRunning = true;



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
      if (this.section.promptphase === 'PRERECORDINGONLY'){
        this.clearPrompt();
      }

    }, preDelay);
    this.preRecTimerRunning = true;
  }

  stopItem() {
    this.status = Status.POST_REC_STOP;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;

    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_STOP;
      this.stopRecording();
    }, this.postDelay);
    this.postRecTimerRunning = true;
  }

  pauseItem() {
    this.status = Status.POST_REC_PAUSE;
    this.transportActions.pauseAction.disabled = true;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;

    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_PAUSE;
      this.stopRecording();
    }, this.postDelay);
    this.postRecTimerRunning = true;
  }

  stopRecording() {
    if (this.maxRecTimerRunning) {
      if(this.maxRecTimerId) {
        window.clearTimeout(this.maxRecTimerId);
      }
      this.maxRecTimerRunning = false;
    }
    if(this.ac) {
      this.ac.stop();
    }
  }

  stopRecordingMaxRec(){
    if(this.postRecTimerRunning){
      if(this.postRecTimerId) {
        window.clearTimeout(this.postRecTimerId);
      }
      this.postRecTimerRunning=false;
    }
    this.maxRecTimerRunning = false;
    this.status = Status.STOPPING_STOP;
    if(this.ac) {
      this.ac.stop();
    }
  }

  addRecordingFileByDescriptor(rfd:RecordingFileDescriptorImpl){
    if(rfd.recording && rfd.recording.itemcode) {
      let prIdx = this.promptIndexByItemcode(rfd.recording.itemcode);
      if (this.items!=null && prIdx !== null) {
        let it = this.items.getItem(prIdx);
        if (it && this._session) {
          // if (!it.recs) {
          //   it.recs = new Array<SprRecordingFile>();
          // }
          let rf = new SprRecordingFile(this._session.sessionId, rfd.recording.itemcode, rfd.version, null);
          rf.serverPersisted=true;
          this.items.addSprRecFile(it,rf);

        } else {
          //console.debug("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
        }
      } else {
        //console.debug("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
      }
    }
  }

  addRecordingFileByPromptIndex(promptIndex:number, rf:SprRecordingFile){

  }


  stopped() {
    this.updateStartActionDisableState()
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = 'Recorded.';
    this.startStopSignalState = StartStopSignalState.IDLE;

    let ad:AudioBuffer|null = null;
    let ada:ArrayAudioBuffer|null=null;
    let iab:IndexedDbAudioBuffer|null=null;
    let adh:AudioDataHolder|null=null;
    let frameLen:number=0;

    if(this.ac!=null){
      if(this.ac.persistentAudioStorageTarget) {
        iab = this.ac.inddbAudioBufferArray();
        if (iab) {
          frameLen = iab.frameLen;
        }
      }else if(this.uploadChunkSizeSeconds || SessionManager.FORCE_ARRRAY_AUDIO_BUFFER){
        ada = this.ac.audioBufferArray();
        frameLen = ada.frameLen;
      }else{
        ad=this.ac.audioBuffer();
        frameLen=ad.length;
      }
      adh=new AudioDataHolder(ad,ada,iab);
    }
    // Use an own reference since the writing of the wave file is asynchronous and this._recordingFile might already contain the next recording
    let rf = this._recordingFile;
    if (rf && rf instanceof SprRecordingFile) {
      this.items?.setSprRecFileAudioData(rf,adh);
      if (this.enableUploadRecordings && !this.uploadChunkSizeSeconds) {
        // TODO use SpeechRecorderconfig resp. RecfileService
        // convert asynchronously to 16-bit integer PCM
        // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
        // TODO duplicate conversion for manual download
        //console.log("Build wav writer...");
        this.processingRecording=true
        if(ad) {
          let ww = new WavWriter();
          //new REST API URL
          let apiEndPoint = '';
          if (this.config && this.config.apiEndPoint) {
            apiEndPoint = this.config.apiEndPoint;
          }
          if (apiEndPoint !== '') {
            apiEndPoint = apiEndPoint + '/'
          }
          let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
          let recUrl: string = sessionsUrl + '/' + rf.session + '/' + RECFILE_API_CTX + '/' + rf.itemCode;
          ww.writeAsync(ad, (wavFile) => {
            this.postRecording(wavFile, recUrl,rf);
            this.processingRecording = false
            this.updateWakeLock();
          });
        }
      }
    }

    // check complete session
    let complete = true;
    if(this.items) {
      // search backwards, to gain faster detection of incomplete state
      for (let ri = this.items.length() - 1; ri >= 0; ri--) {
        let it = this.items.getItem(ri);
        if (it.recording && !it.training && !it.itemDone()) {
          complete = false;
          break;
        }
      }
    }

    let autoStart = (this.status === Status.STOPPING_STOP);
    this.status = Status.IDLE;
    let startNext=false;
    if (complete) {
      if(this._session!=null) {
        if (!this._session.sealed && this._session.status !== "COMPLETED") {
          let body: any = {}
          this._session.status = "COMPLETED";
          body.status = this._session.status;
          if (!this._session.completedDate) {
            this._session.completedDate = new Date();
            body.completedDate = this._session.completedDate;
          }
          this.sessionService.patchSessionObserver(this._session, body).subscribe()
        }
      }
      this.statusMsg = 'Session complete!';
      this.updateWakeLock();
      let dialogRef = this.dialog.open(SessionFinishedDialog, {});

      // enable navigation
      this.transportActions.fwdAction.disabled = false
      this.transportActions.bwdAction.disabled = false

    } else {

      if (this.section.mode === 'AUTOPROGRESS' || this.section.mode === 'AUTORECORDING') {
        this.nextItem();
      }

      if (this.section.mode === 'AUTORECORDING' && this.autorecording && autoStart) {
        startNext=true;
      } else {
        this.navigationDisabled = false;
        this.updateNavigationActions();
        this.updateWakeLock();
      }
    }
    // apply recorded item
    this.applyItem(startNext);
    if(startNext){
      this.startItem();
    }
    this.changeDetectorRef.detectChanges();
  }

  postChunkAudioBuffer(audioBuffer: AudioBuffer, chunkIdx: number): void {
    this.processingRecording = true;
    let ww = new WavWriter();
    //new REST API URL
    let apiEndPoint = '';
    if (this.config && this.config.apiEndPoint) {
      apiEndPoint = this.config.apiEndPoint;
    }
    if (apiEndPoint !== '') {
      apiEndPoint = apiEndPoint + '/'
    }
    let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
    let recUrl: string = sessionsUrl + '/' + this.session?.sessionId + '/' + RECFILE_API_CTX + '/' + this.promptItem.itemcode+'/'+this.rfUuid+'/'+chunkIdx;
    ww.writeAsync(audioBuffer, (wavFile) => {
      this.postRecording(wavFile, recUrl,null);
      this.processingRecording = false
    });
  }


  postRecording(wavFile: Uint8Array, recUrl: string,rf:RecordingFile|null) {
    let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
    let ul = new Upload(wavBlob, recUrl,rf);
    this.uploader.queueUpload(ul);
  }

  stop() {
    if(this.ac!=null){
      this.ac.close();
    }
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

