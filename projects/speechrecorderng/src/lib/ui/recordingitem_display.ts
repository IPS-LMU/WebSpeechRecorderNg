import {
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {Action} from "../action/action";
import {ResponsiveComponent} from "./responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";
import {SprTranslator} from "../i18n/translate";


export const MIN_DB_LEVEL = -40.0;
export const DEFAULT_WARN_DB_LEVEL = -2;

@Component({
    selector: 'spr-recordingitemcontrols',
    template: `
        <button [matTooltip]="i18n.t('spr.audio.startPlayback')" [attr.aria-label]="i18n.t('spr.audio.startPlayback')" class="spr-play" (click)="playStartAction?.perform()"
          [disabled]="playStartAction?playStartAction.disabled:true">
          <mat-icon>play_arrow</mat-icon>
        </button>
        <button [matTooltip]="i18n.t('spr.audio.stopPlayback')" [attr.aria-label]="i18n.t('spr.audio.stopPlayback')" class="spr-stop" (click)="playStopAction?.perform()"
          [disabled]="playStopAction?.disabled">
          <mat-icon>stop</mat-icon>
        </button>
        @if (!screenXs) {
          <button [matTooltip]="i18n.t('spr.audio.toggleDetails')" [attr.aria-label]="i18n.t('spr.audio.toggleDetails')" [disabled]="disableAudioDetails || !audioLoaded"
            (click)="showRecordingDetails()">
            <mat-icon>{{(audioSignalCollapsed) ? "expand_less" : "expand_more"}}</mat-icon>
          </button>
        }
        @if (enableDownload) {
          <button [matTooltip]="i18n.t('spr.audio.downloadRecording')" [attr.aria-label]="i18n.t('spr.audio.downloadRecording')" [disabled]="disableAudioDetails || !audioLoaded"
            (click)="downloadRecording()">
            <mat-icon>file_download</mat-icon>
          </button>
        }
        <div class="spr-peak-panel"><table style="border-style: none"><tr><td>{{i18n.t('spr.audio.peak')}}</td><td><span class="spr-peak"
        [class.spr-peak-over]="peakDbLvl > warnDbLevel" [matTooltip]="i18n.t('spr.audio.peakLevel')">{{peakDbLvl | number:'1.1-1'}} dB </span></td></tr>
        @if (_agc) {
          <tr><td>{{i18n.t('spr.audio.agc')}}</td><td><span [matTooltip]="i18n.t('spr.audio.agcTooltip')">{{agcString}}</span></td></tr>
        }</table></div>
        `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: transparent;
        color: var(--spr-canvas-ink, #FFFFFF);
        padding: 4px;
        box-sizing: border-box;
        height: 100%;

        display: flex; /* flex container: left level bar, right decimal peak level value */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`, `span {
        flex: 0;
        font-weight: 700;
        display: inline-block;
        white-space: nowrap;
        box-sizing: border-box;
    }`, `

    /* The strip sits on the dark canvas surface: ink on it is white, and the
       complement colours carry the state (green = playable, gold = stoppable). */
    button {
      display: inline-grid;
      place-items: center;
      min-width: 40px;
      width: 40px;
      height: 100%;
      padding: 0;
      border: none;
      border-radius: var(--spr-r-md, 12px);
      background: transparent;
      color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
      font-family: inherit;
      font-size: var(--spr-type-caption, 13.6px);
      cursor: pointer;
    }

    button:hover:not([disabled]) {
      background: var(--spr-chrome-tint, rgba(255, 255, 255, 0.14));
    }

    button[disabled] {
      cursor: default;
    }

    button.spr-play:not([disabled]) {
      color: var(--spr-ok, #73A790);
    }

    button.spr-stop:not([disabled]) {
      color: var(--spr-caution, #D7B17C);
    }

    .spr-peak-panel {
      min-width: 14ch;
      padding: 2px;
      color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
      font-size: var(--spr-type-caption, 13.6px);
      line-height: 1.5;
    }

    .spr-peak {
      display: inline-block;
      padding: 0 6px;
      border-radius: var(--spr-r-sm, 6px);
      background: var(--spr-stage, #F1EFE4);
      color: var(--spr-stage-ink, #000000);
      font-variant-numeric: tabular-nums;
    }

    .spr-peak.spr-peak-over {
      background: var(--spr-alert, #EABAB9);
      color: var(--spr-alert-ink, #000000);
    }
    `, `
     button {
       touch-action: manipulation;
     }`],
    standalone: false
})
export class RecordingItemControls extends ResponsiveComponent implements OnDestroy {

  ce: HTMLDivElement|null=null;
  @Input() audioSignalCollapsed: boolean=true;
  private _displayAudioBuffer: AudioBuffer | null|undefined;
  @Input() enableDownload: boolean=false;

  @Input() peakDbLvl = MIN_DB_LEVEL;

  _displayLevelInfos: LevelInfos | null=null;

  _agc:boolean|null|undefined=undefined;
  agcString='n/a';

  @Input() set agc(agc:boolean|null|undefined){
    this._agc=agc;
    if(this._agc===undefined || this._agc===null){
      this.agcString='n/a';
    }else{
      if(this._agc===true){
        this.agcString='On';
      }else{
        this.agcString='Off';
      }
    }
  }

  @Output() onShowRecordingDetails: EventEmitter<void> = new EventEmitter<void>();
  @Output() onDownloadRecording: EventEmitter<void> = new EventEmitter<void>();

  @Input() disableAudioDetails=true;
  @Input() audioLoaded=false;
  //@Input() controlAudioPlayer: AudioPlayer;
  @Input() playStartAction:Action<void>|undefined;
  @Input() playStopAction:Action<void>|undefined;
  playStartEnabled = false;
  playStopEnabled = false;
  private updateTimerId: number|null=null;

  private destroyed = false;

  warnDbLevel = DEFAULT_WARN_DB_LEVEL;

  constructor(protected bpo:BreakpointObserver,private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef, public readonly i18n: SprTranslator) {
    super(bpo);
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  showRecordingDetails() {
    this.onShowRecordingDetails.emit();
  }

  downloadRecording() {
    this.onDownloadRecording.emit();
  }

  ngAfterViewInit() {
    this.ce = this.ref.nativeElement;
  }

  @Input()
  set displayLevelInfos(levelInfos: LevelInfos | null) {
    this._displayLevelInfos = levelInfos;
  }

  error() {
    // this.status = 'ERROR';
  }

}


@Component({
    selector: 'spr-recordingitemdisplay',
    template: `
      <div [class]="{audioStatusDisplay:!screenXs,audioStatusDisplayXs:screenXs}">
        <audio-levelbar style="flex:1 0 1%" [streamingMode]="streamingMode" [displayLevelInfos]="_displayLevelInfos"></audio-levelbar>
        <spr-recordingitemcontrols style="flex:0 0 0px" [audioLoaded]="displayAudioBuffer!==null" [playStartAction]="playStartAction" [playStopAction]="playStopAction" [peakDbLvl]="peakDbLvl" [agc]="_agc" (onShowRecordingDetails)="onShowRecordingDetails.emit()"></spr-recordingitemcontrols>
      </div>
    `,
    styles: [`div {
        width: 100%;
        background: var(--spr-canvas, #0E1A26);
        color: var(--spr-canvas-ink, #FFFFFF);
        padding: 4px;
        box-sizing: border-box;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`, `audio-levelbar {
        box-sizing: border-box;
    }`, `.audioStatusDisplay{
    display:flex;
    flex-direction: row;
    height:100px;
    min-height: 100px;
  }`, `.audioStatusDisplayXs{
    display:flex;
    flex-direction: column;
    height:125px;
    min-height: 125px;
  }`],
    standalone: false
})
export class RecordingItemDisplay extends ResponsiveComponent implements LevelListener, OnDestroy {

    ce: HTMLDivElement|null=null;
    @ViewChild(LevelBar, { static: true }) liveLevel!: LevelBar;
    @Input() streamingMode: boolean=false;
    @Input() audioSignalCollapsed: boolean=true;
    private _displayAudioBuffer: AudioBuffer | null|undefined;
    @Input() enableDownload: boolean=false;

    peakDbLvl = MIN_DB_LEVEL;

    _displayLevelInfos: LevelInfos | null=null;

    _agc:boolean|null|undefined=undefined;
    agcString='n/a';

    @Input() set agc(agc:boolean|null|undefined){
      this._agc=agc;
    }

    @Output() onShowRecordingDetails: EventEmitter<void> = new EventEmitter<void>();
    @Output() onDownloadRecording: EventEmitter<void> = new EventEmitter<void>();

    //@Input() controlAudioPlayer: AudioPlayer;
    @Input() playStartAction:Action<void>|undefined;
    @Input() playStopAction:Action<void>|undefined;
    playStartEnabled = false;
    playStopEnabled = false;
    private updateTimerId: number|null=null;

    private destroyed = false;

    warnDbLevel = DEFAULT_WARN_DB_LEVEL;

    constructor(protected bpo:BreakpointObserver,private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {
        super(bpo);
    }

    ngOnDestroy() {
        this.destroyed = true;
    }


    @Input()
    set displayAudioBuffer(displayAudioBuffer: AudioBuffer | null| undefined) {
        this._displayAudioBuffer = displayAudioBuffer;
    }

    get displayAudioBuffer() {
        return this._displayAudioBuffer;
    }

    showRecordingDetails() {
        this.onShowRecordingDetails.emit();
    }

    downloadRecording() {
        this.onDownloadRecording.emit();
    }

    ngAfterViewInit() {
        this.ce = this.ref.nativeElement;
        //this.controlAudioPlayer.listener=this;
    }

    @Input()
    set displayLevelInfos(levelInfos: LevelInfos | null) {
        this._displayLevelInfos = levelInfos;
    }

    set channelCount(channelCount: number) {
        this.reset();
        this.liveLevel.channelCount = channelCount;
    }

  set playFramePosition(playFramePosition: number) {
    this.liveLevel.playFramePosition=playFramePosition;
  }

    update(levelInfo: LevelInfo, peakLevelInfo: LevelInfo) {
        let peakDBVal = levelInfo.powerLevelDB();
        if (this.peakDbLvl < peakDBVal) {
            this.peakDbLvl = peakDBVal;
            // the event comes from outside an Angular zone
            this.changeDetectorRef.detectChanges();
        }
        this.liveLevel.update(levelInfo);
    }

    error() {
        // this.status = 'ERROR';
    }

    streamFinished() {
        this.liveLevel.streamFinished();
    }

    reset() {
        this.peakDbLvl = MIN_DB_LEVEL;
        this.changeDetectorRef.detectChanges();
    }


}
