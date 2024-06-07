import {
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {Action} from "../action/action";
import {ResponsiveComponent} from "./responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";


export const MIN_DB_LEVEL = -40.0;
export const DEFAULT_WARN_DB_LEVEL = -2;

@Component({
  selector: 'spr-recordingitemcontrols',
  template: `
        <button matTooltip="Start playback" (click)="playStartAction?.perform()"
                [disabled]="playStartAction?playStartAction.disabled:true"
                [style.color]="playStartAction?.disabled ? 'grey' : 'green'">
            <mat-icon>play_arrow</mat-icon>
        </button>
        <button matTooltip="Stop playback" (click)="playStopAction?.perform()"
                [disabled]="playStopAction?.disabled"
                [style.color]="playStopAction?.disabled ? 'grey' : 'yellow'">
            <mat-icon>stop</mat-icon>
        </button>
        <button *ngIf="!screenXs" matTooltip="Toggle detailed audio display" [disabled]="disableAudioDetails || !audioLoaded"
                (click)="showRecordingDetails()">
            <mat-icon>{{(audioSignalCollapsed) ? "expand_less" : "expand_more"}}</mat-icon>
        </button>
        <button matTooltip="Download current recording" *ngIf="enableDownload" [disabled]="disableAudioDetails || !audioLoaded"
                (click)="downloadRecording()">
            <mat-icon>file_download</mat-icon>
        </button>
        <div style="min-width: 14ch;padding:2px"><table style="border-style: none"><tr><td>Peak:</td><td><span matTooltip="Peak level"
                                                                        [style.color]="(peakDbLvl > warnDbLevel)?'red':'black'">{{peakDbLvl | number:'1.1-1'}} dB </span></td></tr>
          <tr *ngIf="_agc"><td>AGC:</td><td><span matTooltip="Auto gain control">{{agcString}}</span></td></tr>
          <tr *ngIf="_ns"><td>NS:</td><td><span matTooltip="Noise suppression">{{nsString}}</span></td></tr>
          <tr *ngIf="_ec"><td>EC:</td><td><span matTooltip="Echo cancellation">{{ecString}}</span></td></tr>
          <tr *ngIf="_gainDb"><td>Gain:</td><td><span matTooltip="Audio capture gain">{{gainDbString}}</span></td></tr>
        </table></div>
    `,
  styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: darkgray;
        padding: 4px;
        box-sizing: border-box;
        height: 100%;

        display: flex; /* flex container: left level bar, right decimal peak level value */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`, `span {
        flex: 0;
        font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing: border-box;
    }`,`
     button {
       touch-action: manipulation;
     }`]

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

  _ns:boolean|null|undefined=undefined;
  nsString='n/a';

  _ec:boolean|null|undefined=undefined;
  ecString='n/a';

  _gainDb:number|null|undefined=undefined;
  gainDbString='n/a';

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

  @Input() set noiseSuppression(ns:boolean|null|undefined){
    this._ns=ns;
    if(this._ns===undefined || this._ns===null){
      this.nsString='n/a';
    }else{
      if(this._ns===true){
        this.nsString='On';
      }else{
        this.nsString='Off';
      }
    }
  }

  @Input() set echoCancellation(ec:boolean|null|undefined){
    this._ec=ec;
    if(this._ec===undefined || this._agc===null){
      this.ecString='n/a';
    }else{
      if(this._ec===true){
        this.ecString='On';
      }else{
        this.ecString='Off';
      }
    }
  }

  @Input() set gainDb(gainDb:number|null|undefined){
    this._gainDb=gainDb;
    if(this._gainDb===undefined || this._gainDb===null){
      this.gainDbString='0 dB';
    }else{
      this.gainDbString=this._gainDb.toString()+' dB';
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

  constructor(protected bpo:BreakpointObserver,private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {
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

  //protected readonly undefined = undefined;
  //protected readonly undefined = undefined;
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
        background: darkgray;
        padding: 4px;
        box-sizing: border-box;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`, `audio-levelbar {
        box-sizing: border-box;
    }`,`.audioStatusDisplay{
    display:flex;
    flex-direction: row;
    height:100px;
    min-height: 100px;
  }`,`.audioStatusDisplayXs{
    display:flex;
    flex-direction: column;
    height:125px;
    min-height: 125px;
  }`]

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
