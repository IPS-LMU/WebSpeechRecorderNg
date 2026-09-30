import {AudioCapture, AudioCaptureListener} from '../../audio/capture/capture';
import {AudioPlayer, AudioPlayerEvent, EventType} from '../../audio/playback/player'
import {WavWriter, SampleSize} from '../../audio/impl/wavwriter'
import {Group, Mediaitem, PromptItem, PromptitemUtil, Script, Section} from '../script/script';
import {RecordingFileDescriptorImpl, SprRecordingFile} from '../recording'
import {Upload, UploadHolder} from '../../net/uploader';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  Renderer2,
  ViewChild,
  inject
} from "@angular/core";
import {SessionService} from "./session.service";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {KEY, collidingBinding, isEditableTarget, keyLabel} from "./keybindings";
import {PromptAudioResult, PromptAudioService} from "../../audio/prompt_audio";
import {buildRespondentSnapshot} from "../respondent/respondent-snapshot";
import {SCHEME_ATTRIBUTE} from "../../theme/theme";
import {MatDialog} from "@angular/material/dialog";
import {SpeechRecorderUploader} from "../spruploader";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig, SprLogo} from "../../spr.config";
import {Prompting} from "./prompting";
import {SessionFinishedDialog, SessionFinishedDialogData} from "./session_finished_dialog";
import {SessionExportEncoding, SessionExportService} from "./session_export";
import {MessageDialog} from "../../ui/message_dialog";
import {RecordingService} from "../recordings/recordings.service";
import {AudioClip} from "../../audio/persistor";
import {Item} from "./item";
import {LevelBar, State as LiveLevelState} from "../../audio/ui/livelevel";
import {BasicRecorder, ChunkAudioBufferReceiver, MAX_RECORDING_TIME_MS, RECFILE_API_CTX} from "./basicrecorder";
import {ArrayAudioBuffer} from "../../audio/array_audio_buffer";
import {SprTranslator} from "../../i18n/translate";
import {AudioBufferSource, AudioDataHolder, AudioSource} from "../../audio/audio_data_holder";
import {SprItemsCache} from "./recording_file_cache";
import {IndexedDbAudioBuffer, PersistentAudioStorageTarget} from "../../audio/inddb_audio_buffer";
import {AudioStorageFormatEncoding, AudioStorageType} from "../project/project";
import {NetAudioBuffer} from "../../audio/net_audio_buffer";
import {BreakpointObserver} from "@angular/cdk/layout";
import {SprLogger} from "../../utils/logger";

const DEFAULT_PRE_REC_DELAY=1000;
const DEFAULT_POST_REC_DELAY=500;

export const enum Status {
  BLOCKED, IDLE, STARTING, PRE_RECORDING, RECORDING, POST_REC_STOP, POST_REC_PAUSE, STOPPING_STOP, STOPPING_PAUSE, NON_RECORDING_WAIT,ERROR
}

@Component({
    selector: 'app-sprrecordingsession',
    providers: [SessionService],
    template: `
    <app-warningbar [show]="isTestSession()" [warningText]="i18n.t('spr.warning.testRecording')"></app-warningbar>
    <app-warningbar [show]="isDefaultAudioTestSession()" severity="caution" [warningText]="i18n.t('spr.warning.defaultDevice')"></app-warningbar>
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
    @if (screenXs) {
      <mat-progress-bar [value]="progressPercentValue()" ></mat-progress-bar>
    }


    <div [class]="{audioStatusDisplay:!screenXs,audioStatusDisplayXs:screenXs}">
      <audio-levelbar style="flex:1 0 1%" [streamingMode]="isRecording() || keepLiveLevel" [displayLevelInfos]="displayAudioClip?.levelInfos"  [state]="liveLevelDisplayState"></audio-levelbar>
      <div style="display:flex;flex-direction: row">
        <spr-recordingitemcontrols style="display:flex;flex:10 0 1px"
          [audioLoaded]="audioLoaded"
          [disableAudioDetails]="disableAudioDetails"
          [playStartAction]="controlAudioPlayer?.startAction"
          [playStopAction]="controlAudioPlayer?.stopAction"
          [peakDbLvl]="peakLevelInDb"
          [agc]="this.ac?.agcStatus"
          (onShowRecordingDetails)="audioSignalCollapsed=!audioSignalCollapsed">
        </spr-recordingitemcontrols>

        @if (screenXs && enableUploadRecordings) {
          <app-uploadstatus class="ricontrols dark"  style="flex:0 0 0" [value]="uploadProgress"
          [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        }
        @if (screenXs) {
          <app-wakelockindicator class="ricontrols dark" style="flex:0 0 0" [screenLocked]="screenLocked"></app-wakelockindicator>
        }
        @if (screenXs) {
          <app-readystateindicator class="ricontrols dark" style="flex:0 0 0" [ready]="dataSaved && !isActive()"></app-readystateindicator>
        }
      </div>
    </div>
    <div #controlpanel class="controlpanel">
      <div style="flex:1 1 30%;justify-content: flex-start;align-items: center; align-content: center">
        @if (leadingLogos) {
          <spr-logos class="spr-leading" [logos]="leadingLogos" [height]="26"></spr-logos>
        }
        @if (!screenXs) {
          <app-sprstatusdisplay [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"></app-sprstatusdisplay>
        }
      </div>
      <app-sprtransport style="display:flex;flex:10 0 30%;justify-content: center;align-items: center; align-content: center" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="!items || items.length()>1" [respondentKey]="respondentKeyLabel()"></app-sprtransport>
      <div style="display:flex;flex:1 1 30%;flex-direction:row;justify-content: flex-end;align-items: center; align-content: center">
        @if (controlLogos) {
          <spr-logos class="spr-separator" [logos]="controlLogos" [height]="26"></spr-logos>
        }
        @if (!screenXs && enableUploadRecordings) {
          <app-uploadstatus  class="ricontrols"  [value]="uploadProgress"
          [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processingRecording"></app-uploadstatus>
        }
        @if (!screenXs) {
          <app-wakelockindicator class="ricontrols" [screenLocked]="screenLocked"></app-wakelockindicator>
        }
        @if (!screenXs) {
          <app-readystateindicator class="ricontrols" [ready]="dataSaved && !isActive()"></app-readystateindicator>
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
    min-height: 0px;

      /* Prevents horizontal scroll bar on swipe right */
      overflow: hidden;
  }`, `
    /* The XS progress bar sits on the page, not on a surface: its indicator follows the
       ink, or it would be a navy bar on a near-black page in the dark scheme. */
    mat-progress-bar {
      --mat-progress-bar-active-indicator-color: var(--spr-ink, #1F3044);
      --mat-progress-bar-track-color: var(--spr-surface-3, #EDF2F8);
    }
  `, `.ricontrols {
        display:flex;
        padding: 4px;
        box-sizing: border-box;
        height: 100%;
        flex-direction: row;
        justify-content: flex-end;align-items: center; align-content: center;
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
  }`, `.audioStatusDisplay{
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
export class SessionManager extends BasicRecorder implements AfterViewInit,OnDestroy, AudioCaptureListener,ChunkAudioBufferReceiver {

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


  private offlineAudioContext:OfflineAudioContext|null=null;

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

  private preRecTimerId: number|null=null;
  private preRecTimerRunning: boolean|null=null;

  private readonly promptAudio = inject(PromptAudioService);
  private readonly sessionExport = inject(SessionExportService);
  /** Invalidates a playback that a stop, a pause or a new item has overtaken. */
  private promptAudioToken = 0;
  /**
   * Set while a take waits for its prompt sound to be played to the end, holding the clocks
   * (and the traffic light) of the item the sound belongs to.
   */
  private promptAudioPending: {preDelay: number, maxRecordingTimeMs: number}|null = null;
  private postDelay:number=DEFAULT_POST_REC_DELAY;
  private postRecTimerId: number|null=null;
  private postRecTimerRunning: boolean|null=null;
  //private maxRecTimerRunning: boolean|null=null;
  private nonRecordingDurationTimerId: number|null=null;
  private nonRecordingDurationTimerRunning: boolean=false;

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

  showSessionCompleteMessage=true;

  constructor(protected bpo:BreakpointObserver,
              changeDetectorRef: ChangeDetectorRef,
              private renderer: Renderer2,
              dialog: MatDialog,
              sessionService:SessionService,
              private recFileService:RecordingService,
              uploader: SpeechRecorderUploader,
              i18n: SprTranslator,
              @Inject(SPEECHRECORDER_CONFIG) config?: SpeechRecorderConfig) {
    super(bpo,changeDetectorRef,dialog,sessionService,uploader,i18n,config);
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
    this.transportActions.stopNonrecordingAction.disabled=true;
    this.transportActions.pauseAction.disabled = true;
    this.playStartAction.disabled = true;

    // let context:AudioContext|null=null;
    // try {
    //   context = AudioContextProvider.audioContextInstance();
    // } catch (err) {
    //   this.status = Status.ERROR;
    //   let errMsg = 'Unknown error';
    //   if(err instanceof Error){
    //     errMsg=err.message;
    //   }
    //   this.statusMsg = 'ERROR: ' + errMsg;
    //   this.statusAlertType = 'error';
    //   this.dialog.open(MessageDialog, {
    //     data: {
    //       type: 'error',
    //       title: 'Error',
    //       msg: errMsg,
    //       advice: 'Please use a supported browser.',
    //     }
    //   });
    //   return;
    // }
    // if(context) {
    //   console.info("State of audio context: " + context.state)
    // }else{
    //   console.info("No audio context available!");
    // }
    // if (!context || !navigator.mediaDevices) {
    //   this.status = Status.ERROR;
    //   let errMsg = 'Browser does not support Media streams!';
    //   this.statusMsg = 'ERROR: ' + errMsg;
    //   this.statusAlertType = 'error';
    //   this.dialog.open(MessageDialog, {
    //     data: {
    //       type: 'error',
    //       title: 'Error',
    //       msg: errMsg,
    //       advice: 'Please use a supported browser.',
    //     }
    //   });
    //   return;
    // } else {
      this.ac = new AudioCapture(this.i18n);
      if (this.ac) {
        this.transportActions.startAction.onAction = () => this.startItem();
        this.ac.listener = this;

        this.configureStreamCaptureStream();

        // Don't list the devices here. If we do not have audio permissions we only get anonymized devices without labels.
        //this.ac.listDevices();
      } else {
        this.transportActions.startAction.disabled = true;
        let errMsg = this.i18n.t('spr.dialog.unsupportedBrowserMsg');
        this.statusMsg = this.i18n.t('spr.status.errorPrefix', {msg: errMsg});
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
      this.transportActions.pauseAction.onAction = () => this.pauseItem();
      this.transportActions.fwdAction.onAction = () => this.nextItem();
      this.transportActions.stopNonrecordingAction.onAction=()=>this.stopNonrecording();
      this.transportActions.fwdNextAction.onAction = () => this.nextUnrecordedItem();
      this.transportActions.bwdAction.onAction = () => this.prevItem();
      this.transportActions.respondentAction.onAction = () => this.openRespondentDisplay();
      this.transportActions.playPromptAction.onAction = () => this.playPromptAudio();
      this.playStartAction.onAction = () => {
        // Reviewing a recording is the other playback: never both at once.
        this.cancelPromptAudio();
        this.controlAudioPlayer?.start();
      };

    this.startStopSignalState = StartStopSignalState.OFF;

}

  /** Cached resolved key for the respondent display (config value or the built-in default). */
  private respondentStageKey: string|null = null;
  private lastPublishedPrompt: PromptItem|null = null;
  private resolvedRespondentKey: string|null = null;

  // The stage is republished as soon as anything the respondent sees changed. Comparing a short
  // key per change detection cycle beats hunting every mutation site and cannot miss one.
  ngDoCheck(): void {
    super.ngDoCheck();
    this.publishRespondentStage();
  }

  /** The configured key, unless it clashes with another shortcut — then the default applies. */
  respondentKey(): string {
    if (this.resolvedRespondentKey === null) {
      this.resolvedRespondentKey = this.resolveRespondentKey();
    }
    return this.resolvedRespondentKey;
  }

  /** Human-readable key for buttons and tooltips. */
  respondentKeyLabel(): string {
    return keyLabel(this.respondentKey());
  }

  /**
   * Shows the prompt stage on the respondent's screen, or brings that window to the front.
   *
   * Called from the key handler and from the transport bar. A keydown counts as a transient
   * activation, which is what the browser requires before it lets `window.open` through.
   */
  openRespondentDisplay(): void {
    const sessionId = this._session?.sessionId;
    if (sessionId === undefined || sessionId === null) {
      return;
    }
    this.publishRespondentStage(true);
    const result = this.respondentDisplay.openOrFocus(String(sessionId));
    if (result === 'blocked') {
      this.statusMsg = this.i18n.t('spr.respondent.blocked');
      this.statusAlertType = 'warn';
    } else if (result === 'unsupported') {
      this.statusMsg = this.i18n.t('spr.respondent.unsupportedStatus');
      this.statusAlertType = 'warn';
    }
  }

  private resolveRespondentKey(): string {
    const configured = this.config?.respondentDisplayKey;
    if (!configured) {
      return KEY.RESPONDENT;
    }
    const clash = collidingBinding(configured);
    if (clash) {
      SprLogger.warn("Respondent display: the configured key '" + configured + "' is already used by '"
        + clash.description + "'; keeping '" + KEY.RESPONDENT + "'.");
      return KEY.RESPONDENT;
    }
    return configured;
  }

  private publishRespondentStage(force = false): void {
    const sessionId = this._session?.sessionId;
    if (sessionId === undefined || sessionId === null) {
      return;
    }
    const prompt: PromptItem|null = this.promptItem ?? null;
    const scheme = document.documentElement.getAttribute(SCHEME_ATTRIBUTE);
    const key = [
      this._promptIndex,
      this.items?.items?.length ?? -1,
      this.showPrompt,
      this.startStopSignalState,
      this._session?.status ?? '',
      prompt === this.lastPublishedPrompt,
      prompt?.itemcode ?? '',
      prompt?.recinstructions?.recinstructions ?? '',
      prompt?.mediaitems?.length ?? -1,
      scheme ?? '',
    ].join('|');
    if (!force && key === this.respondentStageKey) {
      return;
    }
    this.respondentStageKey = key;
    this.lastPublishedPrompt = prompt;
    this.respondentDisplay.publish(buildRespondentSnapshot({
      sessionId: String(sessionId),
      projectName: this.projectName ?? null,
      itemIndex: this._promptIndex,
      itemCount: this.items?.items?.length ?? null,
      instruction: prompt?.recinstructions?.recinstructions ?? null,
      showPrompt: this.showPrompt,
      prompt,
      signal: this.startStopSignalState,
      ended: this._session?.status === 'COMPLETED',
      scheme,
    }));
  }

  @HostListener('window:keypress', ['$event'])
  onKeyPress(ke: KeyboardEvent) {
    if (ke.key == KEY.START_STOP) {
      this.transportActions.startAction.perform();
      this.transportActions.nextAction.perform();
      this.transportActions.stopNonrecordingAction.perform();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ke: KeyboardEvent) {
    if (ke.key == KEY.START_STOP) {
      this.transportActions.stopAction.perform();
    }
    if (ke.key == KEY.PAUSE) {
      this.transportActions.pauseAction.perform();
    }

    if (ke.key == KEY.STOP) {
      if(!this.audioSignalCollapsed){
        this.audioSignalCollapsed=true;
      }
      this.transportActions.stopAction.perform();
      this.transportActions.pauseAction.perform();
    }

    if (ke.key == KEY.PLAY) {
      this.playStartAction.perform();
    }
    if (ke.key === KEY.PLAY_PROMPT && !ke.repeat && !isEditableTarget(ke)) {
      this.transportActions.playPromptAction.perform();
    }
    if (ke.key === KEY.FORWARD) {
      this.transportActions.fwdAction.perform();
    }
    if (ke.key === KEY.BACKWARD) {
      this.transportActions.bwdAction.perform();
    }
    if (ke.key === this.respondentKey() && !ke.repeat && !isEditableTarget(ke)) {
      this.openRespondentDisplay();
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

  isDefaultAudioTestSessionOverwritingProjectRequirements():boolean {
    return ((this._session!=null) && (this._session.type==='TEST_DEF_A') && (this.audioDevices!=null) && this.audioDevices.length>0)
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
    this.keepLiveLevel=false;
    this.applyItem();
  }

  itemSelect(itemIdx: number) {
    if (this.status === Status.IDLE) {
      this.promptIndex=itemIdx;
    }

  }

  private clearPreRecTimer() {
    if (this.preRecTimerRunning) {
      if (this.preRecTimerId) {
        window.clearTimeout(this.preRecTimerId);
      }
      this.preRecTimerRunning = false;
    }
  }

  private clearPostRecTimer(){
    if (this.postRecTimerRunning) {
      if (this.postRecTimerId) {
        window.clearTimeout(this.postRecTimerId);
      }
      this.postRecTimerRunning = false;
    }
  }

  private clearMaxRecTimer(){
    if (this.maxRecTimerRunning) {
      if (this.maxRecTimerId) {
        window.clearTimeout(this.maxRecTimerId);
      }
      this.maxRecTimerRunning = false;
    }
  }

  private clearNonRecordingDurationTimer(){
    if (this.nonRecordingDurationTimerRunning) {
      if (this.nonRecordingDurationTimerId) {
        window.clearTimeout(this.nonRecordingDurationTimerId);
      }
      this.nonRecordingDurationTimerRunning = false;
    }
  }

  startItem() {
    this.transportActions.fwdAction.disabled = true
    this.transportActions.fwdNextAction.disabled = true
    this.transportActions.bwdAction.disabled = true
    const isNonrecording=(this.promptItem.type==='nonrecording');
    if(isNonrecording){
      this.status = Status.IDLE;

      this.updateDisplayRecFile(null);
      this.displayRecFileVersion = 0;
      this.displayAudioClip = null;
      this.liveLevelDisplay.reset(true);
      // Hide loading hint on livelevel display
      this.liveLevelDisplayState = LiveLevelState.READY;
      this.showRecording();
      if (this.section.mode === 'AUTORECORDING') {
        this.autorecording = true;
      }
      const nrDuration=this.promptItem.duration;
      if(this.autorecording && nrDuration!==undefined) {
        this.nonRecordingDurationTimerId = window.setTimeout(() => {
          this.nonRecordingDurationTimerRunning = false;
          this.transportActions.stopNonrecordingAction.disabled=true;
          this.status = Status.STOPPING_STOP;
          this.continueSession();
        }, nrDuration);
        this.nonRecordingDurationTimerRunning = true;
      }
      this.status=Status.NON_RECORDING_WAIT;
      this.transportActions.stopNonrecordingAction.disabled = false;
    }else {
      this.status = Status.STARTING;
      super.startItem();
      if (this.readonly) {
        this.status = Status.IDLE;
        return
      }

      this.updateDisplayRecFile(null);
      this.displayRecFileVersion = 0;
      this.displayAudioClip = null;
      this.liveLevelDisplay.reset(true);
      // Hide loading hint on livelevel display
      this.liveLevelDisplayState = LiveLevelState.READY;
      this.showRecording();
      if (this.section.mode === 'AUTORECORDING') {
        this.autorecording = true;
      }

      this.startCapture();
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
      let adh: AudioDataHolder | null = this.displayRecFile.audioDataHolder;
      let as: AudioSource|null=null;
      if(adh){
        as=adh.audioSource;
      }
      const ww = new WavWriter(this._clientMediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this._clientMediaStorageFormat?.audioPCMsampleSizeInBits);
      if(as instanceof AudioBufferSource) {
        ww.writeAsync(as.audioBuffer, (wavFile) => {
          const blob = new Blob([wavFile], {type: 'audio/wav'});
          const rfUrl = URL.createObjectURL(blob);

          const dataDnlLnk = this.renderer.createElement('a');
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
  }

  protected updateDisplayRecFile(displayRecFile: SprRecordingFile | null,fetchAndApplyRecordingFile:boolean=true) {
    this.liveLevelDisplay.playFramePosition =null;
    this.displayRecFile=displayRecFile;
    if (this._displayRecFile) {
      if(this.items) {
        this.items.currentRecordingFile = this._displayRecFile;
      }
      let adh: AudioDataHolder| null = this._displayRecFile.audioDataHolder;
      if(adh) {
        this.displayAudioClip = new AudioClip(adh);
        if(this._controlAudioPlayer) {
          this._controlAudioPlayer.audioClip = this.displayAudioClip;
        }
        this.showRecording();
      }else {
        // clear for now ...
        this.displayAudioClip = null;
        if(this.controlAudioPlayer) {
          this.controlAudioPlayer.audioClip = null;
        }
        if(fetchAndApplyRecordingFile) {
          if (this._controlAudioPlayer && this._session) {
            //... and try to fetch from server
            this.liveLevelDisplayState = LiveLevelState.LOADING;
            const rf = this._displayRecFile;

            let audioDownloadType = this._clientAudioStorageType;
            if (AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED === this._clientAudioStorageType || AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED === this._clientAudioStorageType) {
              // Default is network mode
              audioDownloadType = AudioStorageType.NET_CHUNKED;
              if (rf.channels && rf.frames) {
                const samples = rf.channels * rf.frames;
                if (samples <= this._maxAutoNetMemStoreSamples) {
                  // But if audio file is small, load in continuous resp. chunked mode
                  if (AudioStorageType.MEM_ENTIRE_AUTO_NET_CHUNKED === this._clientAudioStorageType) {
                    audioDownloadType = AudioStorageType.MEM_ENTIRE;
                  } else if (AudioStorageType.MEM_CHUNKED_AUTO_NET_CHUNKED === this._clientAudioStorageType) {
                    audioDownloadType = AudioStorageType.MEM_CHUNKED;
                  }
                }
              }
            }
            SprLogger.debug("Audio download type: " + audioDownloadType);
            if (AudioStorageType.DB_CHUNKED === this._clientAudioStorageType) {
              // Fetch chunked indexed db audio buffer
              let nextIab: IndexedDbAudioBuffer | null = null;
              if (!this._persistentAudioStorageTarget) {
                throw Error('Error: Persistent storage target not set.');
              } else {
                //console.debug("Fetch audio and store to indexed db...");
                this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileIndDbAudioBuffer(this._persistentAudioStorageTarget, this._session.project, rf).subscribe({
                  next: (iab) => {
                    //console.debug("Sessionmanager: Received inddb audio buffer: "+iab);
                    nextIab = iab;
                  },
                  complete: () => {
                    this.liveLevelDisplayState = LiveLevelState.READY;
                    let fabDh = null;
                    if (nextIab) {
                      if (rf && this.items) {

                        fabDh = new AudioDataHolder(nextIab);
                        this.items.setSprRecFileAudioData(rf, fabDh);
                      }
                    } else {
                      // Should actually be handled by the error resolver
                      this.statusMsg = this.i18n.t('spr.status.recordingFileLoadFailed')
                      this.statusAlertType = 'error'
                    }
                    if (fabDh) {
                      // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item, therefore there should be no risk to set to wrong item
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
                    this.statusMsg = this.i18n.t('spr.status.recordingFileLoadError', {error: err});
                    this.statusAlertType = 'error';
                    this.changeDetectorRef.detectChanges();
                  }
                });
              }
            } else if (AudioStorageType.NET_CHUNKED === audioDownloadType) {
              // Fetch chunked audio buffer from network
              let nextNetAb: NetAudioBuffer | null = null;

              //console.debug("Fetch chunked audio from network");
              this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileNetAudioBuffer( this._session.project, rf).subscribe({
                next: (netAb) => {
                  //console.debug("Sessionmanager: Received net audio buffer: "+netAb);
                  nextNetAb = netAb;
                },
                complete: () => {
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  let fabDh = null;
                  if (nextNetAb) {
                    if (rf && this.items) {
                      fabDh = new AudioDataHolder(nextNetAb);
                      this.items.setSprRecFileAudioData(rf, fabDh);
                    }
                  } else {
                    // Should actually be handled by the error resolver
                    this.statusMsg = this.i18n.t('spr.status.recordingFileLoadFailed')
                    this.statusAlertType = 'error'
                  }
                  if (fabDh) {
                    // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item, therefore there should be no risk to set to wrong item
                    //console.debug("set displayRecFile(): fetch net ab complete, set displayAudioClip.")
                    this.displayAudioClip = new AudioClip(fabDh);
                  }
                  if(this._controlAudioPlayer) {
                    this._controlAudioPlayer.audioClip = this.displayAudioClip;
                  }
                  this.showRecording();
                },
                error: err => {
                  SprLogger.error("Could not load recording file from server: " + err);
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  this.statusMsg = this.i18n.t('spr.status.recordingFileLoadError', {error: err});
                  this.statusAlertType = 'error';
                  this.changeDetectorRef.detectChanges();
                }
              });

            } else if (AudioStorageType.MEM_CHUNKED === audioDownloadType) {
              // Fetch chunked array audio buffer
              let nextAab: ArrayAudioBuffer | null = null;
              //console.debug("Fetch audio and store to (chunked) array buffer...");
              this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileArrayAudioBuffer( this._session.project, rf).subscribe({
                next: (aab) => {
                  nextAab = aab;
                },
                complete: () => {
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  let fabDh = null;
                  if (nextAab) {
                    if (rf && this.items) {
                      fabDh = new AudioDataHolder(nextAab);
                      this.items.setSprRecFileAudioData(rf, fabDh);
                    }
                  } else {
                    // Should actually be handled by the error resolver
                    this.statusMsg = this.i18n.t('spr.status.recordingFileLoadFailed')
                    this.statusAlertType = 'error'
                  }
                  if (fabDh) {
                    // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item, therefore there should be no risk to set to wrong item
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
                  this.statusMsg = this.i18n.t('spr.status.recordingFileLoadError', {error: err});
                  this.statusAlertType = 'error';
                }
              });

            } else {
              // Fetch regular audio buffer
              //console.debug("Fetch audio and store to audio buffer...");
              this.audioFetchSubscription = this.recFileService.fetchSprRecordingFileAudioBuffer( this._session.project, rf).subscribe({
                next: (ab) => {
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  let fabDh = null;
                  if (ab) {
                    if (rf && this.items) {
                      if (SessionManager.FORCE_ARRRAY_AUDIO_BUFFER) {
                        let aab = ArrayAudioBuffer.fromAudioBuffer(ab);
                        fabDh = new AudioDataHolder(aab);
                      } else {
                        fabDh = new AudioDataHolder(new AudioBufferSource(ab));
                      }
                      this.items.setSprRecFileAudioData(rf, fabDh);
                    }
                  } else {
                    // Should actually be handled by the error resolver
                    this.statusMsg = this.i18n.t('spr.status.recordingFileLoadFailed')
                    this.statusAlertType = 'error'
                  }
                  if (fabDh) {
                    // this.displayAudioClip could have been changed meanwhile, but the recorder unsubcribes before changing the item, therefore there should be no risk to set to wrong item
                    this.displayAudioClip = new AudioClip(fabDh);
                  }
                  if(this._controlAudioPlayer) {
                    this._controlAudioPlayer.audioClip = this.displayAudioClip
                  }
                  this.showRecording();
                }, error: err => {
                  SprLogger.error("Could not load recording file from server: " + err);
                  this.liveLevelDisplayState = LiveLevelState.READY;
                  this.statusMsg = this.i18n.t('spr.status.recordingFileLoadError', {error: err});
                  this.statusAlertType = 'error';
                }
              });
            }
          } else {
            this.statusMsg = this.i18n.t('spr.status.recordingFileDecodeFailed')
            this.statusAlertType = 'error'
          }
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
    this.updatePromptAudioActionState();
  }

  applyItem(temporary=false) {

    this.section = this._script.sections[this.sectIdx]
    this.group = this.section._shuffledGroups[this.groupIdxInSection];
    this.promptItem = this.group._shuffledPromptItems[this.promptItemIdxInGroup];

    //this.selectedItemIdx = this.promptIndex;

    this.cancelPromptAudio();
    this.prefetchPromptAudio();

    if(this.audioFetchSubscription){
      //console.debug("Unsubscribe from audio fetch.");
      this.audioFetchSubscription.unsubscribe();
    }
    if (!temporary) {
      this.displayAudioClip=null;
      this.showRecording();
    }
    this.liveLevelDisplayState=LiveLevelState.READY;

    this.clearPrompt();

    const isNonrecording=(this.promptItem.type==='nonrecording');

    if (isNonrecording || !this.section.promptphase || this.section.promptphase === 'IDLE') {
      this.applyPrompt();
    }

    if(isNonrecording){
      this.updateDisplayRecFile(null);
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
          this.updateDisplayRecFile(recentRecFile,!temporary);
          this.displayRecFileVersion = rfVers;

        } else {
          this.updateDisplayRecFile(null);
          this.displayRecFileVersion = 0;
        }
      }
      if(!this.readonly) {
        this.startStopSignalState = StartStopSignalState.IDLE;
      }
    }
    // console.debug("applyItem(): temporary: "+temporary);
    //if (!temporary) {
    //   console.debug("applyItem(): Call showRecording(): displayAudioClip: "+this.displayAudioClip);
      //this.showRecording();
    //}
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
    return (this.status === Status.PRE_RECORDING || this.status === Status.RECORDING || this.status === Status.POST_REC_STOP || this.status === Status.POST_REC_PAUSE || this.status===Status.STOPPING_STOP);
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
      || this.status === Status.ERROR || this.status === Status.NON_RECORDING_WAIT);
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
      while ((!it.recording || it.itemDone()) && newPrIdx < this.promptItemCount) {
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
        rf.uuid=this.rfUuid;
        //it.recs.push(rf);
        this.items.addSprRecFile(it,rf);
        this.items.currentRecordingFile=rf;
      }
    }
    this._recordingFile = rf;
    this.status = Status.PRE_RECORDING;
    super.started();

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

    const promptAudio = PromptitemUtil.autoplayAudioitem(this.promptItem);
    if (promptAudio !== null) {
      // The sound is the prompt: the item's clocks start when it has been played to the end, so
      // neither the cue lamp nor the recording lamp can come up while the respondent is listening.
      this.statusMsg = this.i18n.t('spr.status.promptAudio');
      this.startPromptAudio(promptAudio, preDelay, maxRecordingTimeMs);
    } else {
      this.beginPrerecording(preDelay, maxRecordingTimeMs);
    }
  }

  /**
   * Starts the item's clocks: the pre-recording cue (traffic light gold), then the recording
   * window (green) after `preDelay`, and the item's maximum recording time from here on.
   *
   * Called when the take starts, or after the prompt sound has ended (see `startPromptAudio`).
   */
  private beginPrerecording(preDelay: number, maxRecordingTimeMs: number) {
    this.statusMsg = this.i18n.t('spr.status.recording');
    this.startStopSignalState = StartStopSignalState.PRERECORDING;

    // `super.started()` arms a generic safety timer; the item's own window replaces it. The
    // previous one is cleared, or it would stop a take an hour later.
    this.clearMaxRecTimer();
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

  /** Plays the prompt sound of the running take and holds its clocks until the sound has ended. */
  private startPromptAudio(mediaitem: Mediaitem, preDelay: number, maxRecordingTimeMs: number) {
    const token = ++this.promptAudioToken;
    this.promptAudioPending = {preDelay: preDelay, maxRecordingTimeMs: maxRecordingTimeMs};
    this.promptAudio.play(this.projectName, mediaitem).then((result) => {
      this.finishPromptAudio(token, result);
    });
  }

  /** The prompt sound stopped playing: the take continues, with or without it. */
  private finishPromptAudio(token: number, result: PromptAudioResult) {
    if (token !== this.promptAudioToken || this.promptAudioPending === null) {
      return;   // the take was stopped, left the item, or the operator replayed the sound
    }
    const pending = this.promptAudioPending;
    this.promptAudioPending = null;
    this.updatePromptAudioActionState();
    this.beginPrerecording(pending.preDelay, pending.maxRecordingTimeMs);
    if (result === 'failed') {
      // The session must not stall on a broken or missing file; the operator sees why it was quiet.
      this.statusAlertType = 'error';
      this.statusMsg = this.i18n.t('spr.status.promptAudioError');
    }
  }

  /**
   * The operator's play action: replays the prompt sound, restarting the wait of a pending take.
   * The script decides whether an item offers it at all (`Mediaitem.replay`).
   */
  private playPromptAudio() {
    const mediaitem = PromptitemUtil.replayAudioitem(this.promptItem);
    if (mediaitem === null) {
      return;
    }
    const pending = this.promptAudioPending;
    if (pending !== null) {
      // The take is waiting for this sound: the replay restarts the sound and with it the wait,
      // with the clocks the take was started with, so it cannot shorten the recording window.
      this.startPromptAudio(mediaitem, pending.preDelay, pending.maxRecordingTimeMs);
      return;
    }
    this.promptAudio.play(this.projectName, mediaitem);
  }

  /**
   * Drops a prompt sound that is playing or awaited: the take is over, paused, or another item
   * was selected. The playback resolves as 'stopped' and is ignored by the finished callback.
   */
  private cancelPromptAudio() {
    this.promptAudioToken++;
    this.promptAudioPending = null;
    this.promptAudio.stop();
    this.updatePromptAudioActionState();
  }

  /**
   * The completion dialog's data. A deployment that lets its users keep their recordings
   * (`enableDownloadRecordings`) gets an export action: it packs every client-side recording of
   * the session into a zip and downloads it, which is how a standalone install gets its data out.
   */
  private finishedDialogData(): SessionFinishedDialogData {
    if (this.config?.enableDownloadRecordings !== true) {
      return {};
    }
    return {
      exportRecordings: async () => {
        const blob = await this.sessionExport.exportSession(this.items, this._session, this.sessionExportEncoding());
        if (blob === null) {
          return 'none';
        }
        SessionExportService.download(blob, `cavox_${this._session?.sessionId ?? 'session'}.zip`);
        return 'exported';
      }
    };
  }

  private sessionExportEncoding(): SessionExportEncoding {
    const float = this._clientMediaStorageFormat?.audioEncoding === AudioStorageFormatEncoding.PCM_FLOAT;
    return {
      float,
      sampleSize: this._clientMediaStorageFormat?.audioPCMsampleSizeInBits ?? SampleSize.INT16
    };
  }

  /** The play action only exists where the script lets the operator play the sound. */
  private updatePromptAudioActionState() {
    this.transportActions.playPromptAction.disabled = PromptitemUtil.replayAudioitem(this.promptItem) === null;
  }

  /** Warms the cache for a sound the take will play or the operator may play. */
  private prefetchPromptAudio() {
    const mediaitem = PromptitemUtil.autoplayAudioitem(this.promptItem) ?? PromptitemUtil.replayAudioitem(this.promptItem);
    if (mediaitem !== null) {
      this.promptAudio.prefetch(this.projectName, mediaitem);
    }
  }

  stopItem() {
    this.status = Status.POST_REC_STOP;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.cancelPromptAudio();
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    //this.transportActions.stopNonrecordingAction.disabled=true;
    this.clearPreRecTimer();
    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_STOP;
      this.stopRecording();
    }, this.postDelay);
    this.postRecTimerRunning = true;
  }

  stopNonrecording(){
    this.transportActions.stopNonrecordingAction.disabled=true;
    this.clearNonRecordingDurationTimer();
    this.status = Status.STOPPING_STOP;
    this.continueSession();
  }

  pauseItem() {
    this.status = Status.POST_REC_PAUSE;
    this.transportActions.pauseAction.disabled = true;
    this.startStopSignalState = StartStopSignalState.POSTRECORDING;
    this.cancelPromptAudio();
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.stopNonrecordingAction.disabled=true;
    this.transportActions.pauseAction.disabled = true;
    this.clearPreRecTimer();
    this.postRecTimerId = window.setTimeout(() => {
      this.postRecTimerRunning = false;
      this.status = Status.STOPPING_PAUSE;
      this.stopRecording();
    }, this.postDelay);
    this.postRecTimerRunning = true;
  }

  stopRecording() {
    this.clearMaxRecTimer();
    this.cancelPromptAudio();
    if(this.ac) {
      this.ac.stop();
    }
  }

  stopRecordingMaxRec(){
    this.clearPreRecTimer();
    this.clearPostRecTimer();
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
          //console.debug("addRecordingFileByDescriptor(): sr: "+rfd.samplerate+", frames: "+rfd.frames);
          if(rfd.samplerate && rfd.frames){
            rf.samplerate=rfd.samplerate;
            rf.frames=rfd.frames;
          }
          if(rfd.channels){
            rf.channels=rfd.channels;
          }
          this.items.addSprRecFile(it,rf);

        } else {
          //console.debug("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
        }
      } else {
        //console.debug("WARN: No recording item with code: \"" +rfd.recording.itemcode+ "\" found.");
      }
    }
  }

  // addRecordingFileByPromptIndex(promptIndex:number, rf:SprRecordingFile){
  //
  // }


  stopped() {
    this.clearPreRecTimer();
    this.clearPostRecTimer();
    this.clearMaxRecTimer();
    this.updateStartActionDisableState()
    this.transportActions.stopAction.disabled = true;
    this.transportActions.nextAction.disabled = true;
    this.transportActions.pauseAction.disabled = true;
    this.statusAlertType = 'info';
    this.statusMsg = this.i18n.t('spr.status.recorded');
    this.startStopSignalState = StartStopSignalState.IDLE;

      let adh:AudioDataHolder|null=null;
      let as:AudioSource|null=null;
     let ab:AudioBuffer|null=null;
      if(this.ac) {
        if (AudioStorageType.NET_CHUNKED === this.ac.audioStorageType) {
          this.playStartAction.disabled = true;
          this.keepLiveLevel=true;
          let burl:string|null=null;
          if(this._session) {
            if (this._displayRecFile) {
              // TODO is this branch ever called ?
              let rf = this._displayRecFile;
              rf.frames = this.ac.framesRecorded;
              //console.debug("stopped(): Set frames: "+rf.frames+" on rfId: "+this.displayRecFile?.recordingFileId);
              burl = this.recFileService.sprAudioFileUrl(this._session?.project, rf);
            } else if (this.session?.project && this._recordingFile && this._recordingFile instanceof SprRecordingFile) {
              burl = this.recFileService.sprAudioFileUrlByItemcode(this.session?.project, this.session?.sessionId, this._recordingFile.itemCode, this._recordingFile.version);
            }else{
              SprLogger.error("Could not create net audio buffer.");
            }
            if (burl) {
              const rUUID = this.ac.recUUID;
              const sr = this.ac.currentSampleRate;
              const chFl=sr*RecordingService.DEFAULT_CHUNKED_DOWNLOAD_SECONDS;
              //console.debug("stopped(): rfID: "+this._recordingFile?.recordingFileId+", net ab url: " + burl+", frames: "+this.ac.framesRecorded+", sample rate: "+sr);
              let netAb = new NetAudioBuffer(this.recFileService, burl, this.ac.channelCount, sr, chFl, this.ac.framesRecorded, rUUID, chFl);
              as=netAb;
              if(this.uploadSet){
                //let rp=new ReadyProvider();
                //netAb.readyProvider=rp;
                this.uploadSet.onDone=(uploadSet)=>{
                  SprLogger.debug("upload set on done: Call ready provider.ready");
                  //rp.ready();
                  netAb.ready();
                }
                this.uploadSet.onFail=(uploadSet)=>{
                  this.error(this.i18n.t('spr.dialog.uploadFailedMsg'),this.i18n.t('spr.dialog.uploadFailedAdvice'));
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
            let burl:string|null=null;
            if(this._session) {
              if (this._displayRecFile) {
                // TODO is this branch ever called ?
                let rf = this._displayRecFile;
                rf.frames = this.ac.framesRecorded;
                //console.debug("stopped(): Set frames: "+rf.frames+" on rfId: "+this.displayRecFile?.recordingFileId);
                burl = this.recFileService.sprAudioFileUrl(this._session?.project, rf);
              } else if (this.session?.project && this._recordingFile && this._recordingFile instanceof SprRecordingFile) {
                burl = this.recFileService.sprAudioFileUrlByItemcode(this.session?.project, this.session?.sessionId, this._recordingFile.itemCode, this._recordingFile.version);
              }else{
                SprLogger.error("Could not create net audio buffer.");
              }
              if (burl) {
                const rUUID = this.ac.recUUID;
                const sr = this.ac.currentSampleRate;
                const chFl=sr*RecordingService.DEFAULT_CHUNKED_DOWNLOAD_SECONDS;
                //console.debug("stopped(): rfID: "+this._recordingFile?.recordingFileId+", net ab url: " + burl+", frames: "+this.ac.framesRecorded+", sample rate: "+sr);
                const netAb = new NetAudioBuffer(this.recFileService, burl, this.ac.channelCount, sr, chFl, this.ac.framesRecorded, rUUID, chFl);
                as = netAb;
                if (this.uploadSet) {
                  this.uploadSet.onDone = (uploadSet) => {
                    SprLogger.debug("upload set on done: Call ready provider.ready");

                    netAb.ready();
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

    // Use an own reference since the writing of the wave file is asynchronous and this._recordingFile might already contain the next recording
    let rf = this._recordingFile;
    if (rf && rf instanceof SprRecordingFile) {
      this.items?.setSprRecFileAudioData(rf,adh);
      if (this.enableUploadRecordings && this._uploadChunkSizeSeconds===null && AudioStorageType.MEM_ENTIRE===this._clientAudioStorageType) {
        // TODO use SpeechRecorderconfig resp. RecfileService
        // convert asynchronously to 16-bit integer PCM
        // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
        // TODO duplicate conversion for manual download
        //console.log("Build wav writer...");
        if(ab) {
          this.processingRecording=true;
          const ww = new WavWriter(this._clientMediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this._clientMediaStorageFormat?.audioPCMsampleSizeInBits);
          //new REST API URL
          let apiEndPoint = '';
          if (this.config && this.config.apiEndPoint) {
            apiEndPoint = this.config.apiEndPoint;
          }
          if (apiEndPoint !== '') {
            apiEndPoint = apiEndPoint + '/'
          }
          let sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
          let recUrl: string = sessionsUrl + '/' + encodeURIComponent(rf.session ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(rf.itemCode);
          ww.writeAsync(ab, (wavFile) => {
            this.postRecording(wavFile, recUrl,rf);
            this.processingRecording = false
            this.updateWakeLock();
          });
        }
      }
    }
   this.continueSession();
  }


  continueSession(){
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
      this.statusMsg = this.i18n.t('spr.status.sessionComplete');
      this.updateWakeLock();
      if(this.showSessionCompleteMessage) {
        this.dialog.open(SessionFinishedDialog, {data: this.finishedDialogData()});
      }
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

  error(msg=this.i18n.t('spr.dialog.unknownError'),advice:string=this.i18n.t('spr.dialog.retryAdvice')) {
    this.status=Status.ERROR;
    super.error(msg,advice);
    this.updateNavigationActions();
    this.updateStartActionDisableState();
  }

  postChunkAudioBuffer(buffers: Array<Float32Array>, sampleRate: number, chunkIdx: number): void {
    this.processingRecording = true;

    // The upload holder is required to add the upload now to the upload set. The real upload is created async in postrecording and the upload set is already complete at that time.
    let ulh=new UploadHolder();
    if(this.uploadSet){
      this.uploadSet.add(ulh);
    }
    const chunkBaseUrl = this.sessionsBaseUrl() + '/' + encodeURIComponent(this.session?.sessionId ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(this.promptItem.itemcode ?? '')+'/'+encodeURIComponent(this.rfUuid ?? '');
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
    const ww = new WavWriter(this._clientMediaStorageFormat?.audioEncoding===AudioStorageFormatEncoding.PCM_FLOAT,this._clientMediaStorageFormat?.audioPCMsampleSizeInBits);
    let recUrl: string = this.sessionsBaseUrl() + '/' + encodeURIComponent(this.session?.sessionId ?? '') + '/' + RECFILE_API_CTX + '/' + encodeURIComponent(this.promptItem.itemcode ?? '')+'/'+encodeURIComponent(this.rfUuid ?? '')+'/'+chunkIdx;
    const channels=buffers.length;
    const frameLength=channels>0?buffers[0].length:0;
    ww.writeAsyncPlanar(channels,sampleRate,frameLength,buffers, (wavFile) => {
      this.postRecording(wavFile, recUrl,null,ulh);
      this.processingRecording = false
    });
  }


  // postRecording(wavFile: Uint8Array, recUrl: string,rf:RecordingFile|null) {
  //   let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
  //   let ul = new Upload(wavBlob, recUrl,rf);
  //   this.uploader.queueUpload(ul);
  // }

  stop() {
    if(this.ac!=null){
      this.ac.close();
    }
  }


  private updateControlPlaybackPosition() {
    if(this._controlAudioPlayer) {
      const ppFrames=this._controlAudioPlayer.playPositionFrames;
      if (ppFrames!==null) {
        if(this.prompting.audioDisplay) {
          this.prompting.audioDisplay.playFramePosition = ppFrames;
        }
        this.liveLevelDisplay.playFramePosition = ppFrames;
      }
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

