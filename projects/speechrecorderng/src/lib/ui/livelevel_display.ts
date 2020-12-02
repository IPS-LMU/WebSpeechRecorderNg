import {
    AfterViewInit,
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {Action} from "../action/action";
import {MediaPlaybackControls} from "../media/mediaplayback";
import {VideoPlayer} from "../media/video_player";



export const MIN_DB_LEVEL = -40.0;
export const DEFAULT_WARN_DB_LEVEL = -2;

export class HTMLVideoElementPlaybackControls {

    constructor(private _videoElement:HTMLVideoElement){}

    public start(){
        this._videoElement.play();
    }
    public pause(){
        this._videoElement.pause();
    }
    public stop(){
        this._videoElement.pause();
        this._videoElement.currentTime=0;
    }
}

@Component({
    selector: 'spr-recordingitemdisplay',
    template: `
        <videoplayer [hidden]="(displayMediaBlob==null && mediaStream==null) || hideVideo" [mediaStream]="mediaStream" [mediaBlob]="displayMediaBlob"></videoplayer>
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
        <button matTooltip="Toggle detailed audio display" [disabled]="displayAudioBuffer==null && displayMediaBlob==null"
                (click)="showRecordingDetails()">
            <mat-icon>{{(audioSignalCollapsed) ? "expand_less" : "expand_more"}}</mat-icon>
        </button>
        <button matTooltip="Download current recording" *ngIf="enableDownload" [disabled]="displayAudioBuffer==null && displayMediaBlob==null"
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
    }`, `videoplayer {
        flex:0;
        height:100px;
        max-height:100px;
        width: 200px;
        min-width: 200px;
        box-sizing: border-box;
    }`,`audio-levelbar {
        flex: 4;
        box-sizing: border-box;
    }`, `span {
        flex: 0;
        font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing: border-box;
    }`]

})
export class LevelBarDisplay implements MediaPlaybackControls,LevelListener, AfterViewInit,OnDestroy {

    get startAction(): Action<void> {
        return this.videoPlayer.startAction;
    }

    get startSelectionAction():Action<void>{
        return this.videoPlayer.startSelectionAction;
    }

    get stopAction(): Action<void> {
        return this.videoPlayer.stopAction;
    }

    get autoPlayOnSelectToggleAction(){
        return this.videoPlayer.autoPlayOnSelectToggleAction;
    }

    get videoPlayPauseAction(): Action<void> {
        return this.videoPlayer.videoPlayPauseAction;
    }

    isPlaying(): boolean {
        if(this.videoPlayer){
            return this.videoPlayer.isPlaying();
        }
        return false;
    }

    get currentTime(){
        return this.videoPlayer.currentTime;
    }

    set currentTime(currentTime:number){
        this.videoPlayer.currentTime=currentTime;
    }

    ce: HTMLDivElement;
    @ViewChild(VideoPlayer) videoPlayer: VideoPlayer;

    private mediaPlayerControls:HTMLVideoElementPlaybackControls;
    @ViewChild(LevelBar, { static: true }) liveLevel: LevelBar;
    @Input() streamingMode: boolean;
    @Input() mediaStream:MediaStream;
    @Input() hideVideo: boolean=false;
    @Input() audioSignalCollapsed: boolean;
    private _displayAudioBuffer: AudioBuffer=null;
    private _displayMediaBlob: Blob=null;
    @Input() enableDownload: boolean;
    peakDbLevelStr = "-___ dB";
    peakDbLvl = MIN_DB_LEVEL;

    _displayLevelInfos: LevelInfos | null;

    @Output() onShowRecordingDetails: EventEmitter<void> = new EventEmitter<void>();
    @Output() onDownloadRecording: EventEmitter<void> = new EventEmitter<void>();

    //@Input() controlAudioPlayer: AudioPlayer;
    @Input() playStartAction:Action<void>;
    @Input() playStopAction:Action<void>;

    playStartEnabled = false;
    playStopEnabled = false;
    private updateTimerId: number;

    private destroyed = false;

    warnDbLevel = DEFAULT_WARN_DB_LEVEL;

    constructor(private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {
        this.ce = this.ref.nativeElement;

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

    @Input()
    set displayMediaBlob(displayMediaBlob: Blob | null) {
        this._displayMediaBlob=displayMediaBlob;
    }

    get displayMediaBlob(){
        return this._displayMediaBlob;
    }

    showRecordingDetails() {
        this.onShowRecordingDetails.emit();
    }

    downloadRecording() {
        this.onDownloadRecording.emit();
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
    set playTimePosition(time:number){
        if(this.displayAudioBuffer) {
            let sr = this.displayAudioBuffer.sampleRate
            this.playFramePosition = time * sr;
        }
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
