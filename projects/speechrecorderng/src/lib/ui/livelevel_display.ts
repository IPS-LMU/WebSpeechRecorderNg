import {
    AfterViewInit,
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {Action} from "../action/action";
import {MediaPlaybackControls} from "../media/mediaplayback";



export const MIN_DB_LEVEL = -40.0;
export const DEFAULT_WARN_DB_LEVEL = -2;

export class HTMLVideoElementPlaybackControls implements MediaPlaybackControls{

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
        <video #videoEl [hidden]="displayMediaBlob==null"></video>   
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
    }`, `video {
        flex: 1;
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
export class LevelBarDisplay implements LevelListener, AfterViewInit,OnDestroy {
    get videoPlayPauseAction(): Action<void> {
        return this._videoPlayPauseAction;
    }
    get videoPlayStopAction(): Action<void> {
        return this._videoPlayStopAction;
    }
    get videoPlayStartAction(): Action<void> {
        return this._videoPlayStartAction;
    }

    ce: HTMLDivElement;
    @ViewChild('videoEl') videoElRef: ElementRef;
    private videoEl:HTMLVideoElement;
    private mediaPlayerControls:HTMLVideoElementPlaybackControls;
    @ViewChild(LevelBar, { static: true }) liveLevel: LevelBar;
    @Input() streamingMode: boolean;
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
    private _videoPlayStartAction:Action<void>=new Action('Play');
    private _videoPlayPauseAction:Action<void>=new Action('Pause');
    private _videoPlayStopAction:Action<void>=new Action('Stop');

    playStartEnabled = false;
    playStopEnabled = false;
    private updateTimerId: number;

    private destroyed = false;

    warnDbLevel = DEFAULT_WARN_DB_LEVEL;

    constructor(private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {


    }

    ngAfterViewInit() {
        this.ce = this.ref.nativeElement;
        this.videoEl=this.videoElRef.nativeElement;
        this.mediaPlayerControls=new HTMLVideoElementPlaybackControls(this.videoEl);

        this._videoPlayStartAction.disabled=true;
        this._videoPlayStartAction.onAction=()=>{
            this.videoEl.play();
        }
        this.videoEl.oncanplay=()=>{
            this._videoPlayStartAction.disabled=false;
            this._videoPlayPauseAction.disabled=true;
            this._videoPlayStopAction.disabled=true;
        }
        this.videoEl.onplaying=()=>{
            this._videoPlayStartAction.disabled=true;
            this._videoPlayPauseAction.disabled=false;
            this._videoPlayStopAction.disabled=false;
        }
        this.videoEl.onpause=()=>{
            this._videoPlayStartAction.disabled=false;
            this._videoPlayPauseAction.disabled=true;
            this._videoPlayStopAction.disabled=false;
        }
        this.videoEl.onended=()=>{
            this._videoPlayStartAction.disabled=false;
            this._videoPlayPauseAction.disabled=true;
            this._videoPlayStopAction.disabled=true;
        }
        this.videoEl.onerror=()=>{
            this._videoPlayStartAction.disabled=true;
            this._videoPlayPauseAction.disabled=true;
            this._videoPlayStopAction.disabled=true;
        }
        this._videoPlayStopAction.disabled=true;
        this._videoPlayStopAction.onAction=()=>{
            this.videoEl.pause();
            this.videoEl.currentTime=0;
        }
    }

    ngOnDestroy() {
        this.destroyed = true;
    }

    @Input()
    set displayAudioBuffer(displayAudioBuffer: AudioBuffer | null) {
        this._displayAudioBuffer = displayAudioBuffer;
        this._displayMediaBlob=null;
        this._videoPlayStartAction.disabled=true;
        this._videoPlayStopAction.disabled=true;
        this._videoPlayPauseAction.disabled=true;
    }

    get displayAudioBuffer() {
        return this._displayAudioBuffer;
    }

    @Input()
    set displayMediaBlob(displayMediaBlob: Blob | null) {
        this._displayAudioBuffer =null;
        this._displayMediaBlob=displayMediaBlob;
        if(this.displayMediaBlob){

            //this.videoElRef.nativeElement.srcObject =this.displayMediaBlob;
            let mbUrl=URL.createObjectURL(this._displayMediaBlob);
            this.videoElRef.nativeElement.src =mbUrl;
            //this._videoPlayStartAction.disabled=false;
            //this._videoPlayStopAction.disabled=false;
            //this._videoPlayPauseAction.disabled=false;
        }else{
            //this._videoPlayStartAction.disabled=true;
            //this._videoPlayStopAction.disabled=true;
            //this._videoPlayPauseAction.disabled=true;
        }
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
