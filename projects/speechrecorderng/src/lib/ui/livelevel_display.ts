import {
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {Action} from "../action/action";


export const MIN_DB_LEVEL = -40.0;
export const DEFAULT_WARN_DB_LEVEL = -2;

@Component({
    selector: 'spr-recordingitemdisplay',
    template: `
        <audio-levelbar [streamingMode]="streamingMode" [displayLevelInfos]="_displayLevelInfos"></audio-levelbar>
        <button matTooltip="Start playback" (click)="playStartAction?.perform()"
                [disabled]="playStartAction?.disabled"
                [style.color]="playStartAction?.disabled ? 'grey' : 'green'">
            <mat-icon>play_arrow</mat-icon>
        </button>
        <button matTooltip="Stop playback" (click)="playStopAction?.perform()"
                [disabled]="playStopAction?.disabled"
                [style.color]="playStopAction?.disabled ? 'grey' : 'yellow'">
            <mat-icon>stop</mat-icon>
        </button>
        <button matTooltip="Toggle detailed audio display" [disabled]="displayAudioBuffer==null"
                (click)="showRecordingDetails()">
            <mat-icon>{{(audioSignalCollapsed) ? "expand_less" : "expand_more"}}</mat-icon>
        </button>
        <button matTooltip="Download current recording" *ngIf="enableDownload" [disabled]="displayAudioBuffer==null"
                (click)="downloadRecording()">
            <mat-icon>file_download</mat-icon>
        </button>
        <div style="min-width: 14ch;padding:2px"><table border="0"><tr><td>Peak:</td><td><span matTooltip="Peak level"
                                                                        [style.color]="(peakDbLvl > warnDbLevel)?'red':'black'">{{peakDbLvl | number:'1.1-1'}} dB </span></td></tr></table></div>
    `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: darkgray;
        padding: 4px;
        box-sizing: border-box;
        height: 100px;
        min-height: 100px;
        display: flex; /* flex container: left level bar, right decimal peak level value */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`, `audio-levelbar {
        flex: 1;
        box-sizing: border-box;
    }`, `span {
        flex: 0;
        font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing: border-box;
    }`]

})
export class LevelBarDisplay implements LevelListener, OnDestroy {

    ce: HTMLDivElement;
    @ViewChild(LevelBar, { static: true }) liveLevel: LevelBar;
    @Input() streamingMode: boolean;
    @Input() audioSignalCollapsed: boolean;
    private _displayAudioBuffer: AudioBuffer | null;
    @Input() enableDownload: boolean;
    peakDbLevelStr = "-___ dB";
    peakDbLvl = MIN_DB_LEVEL;

    _displayLevelInfos: LevelInfos | null;

    @Output() onShowRecordingDetails: EventEmitter<void> = new EventEmitter<void>();
    @Output() onDownloadRecording: EventEmitter<void> = new EventEmitter<void>();

    //@Input() controlAudioPlayer: AudioPlayer;
    @Input() playStartAction:Action;
    @Input() playStopAction:Action;
    playStartEnabled = false;
    playStopEnabled = false;
    private updateTimerId: number;

    private destroyed = false;

    warnDbLevel = DEFAULT_WARN_DB_LEVEL;

    constructor(private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
        this.destroyed = true;
    }


    @Input()
    set displayAudioBuffer(displayAudioBuffer: AudioBuffer | null) {
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
            // the event comes from outside of an Angular zone
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


    }


}
