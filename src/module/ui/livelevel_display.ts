import {
    ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output,
    ViewChild
} from "@angular/core"
import {MatTooltip} from "@angular/material"
import {LevelInfo, LevelInfos, LevelListener} from "../audio/dsp/level_measure";
import {LevelBar} from "../audio/ui/livelevel";
import {AudioPlayer, AudioPlayerEvent, AudioPlayerListener, EventType} from "../audio/playback/player";


export const MIN_DB_LEVEL=-40.0;

@Component({
    selector: 'spr-recordingitemdisplay',
    template: `
        <audio-levelbar [streamingMode]="streamingMode" [displayLevelInfos]="_displayLevelInfos"></audio-levelbar>
        <button matTooltip="Start playback" (click)="controlAudioPlayer.start()" [disabled]="controlAudioPlayer?.startAction.disabled" [style.color]="controlAudioPlayer?.startAction.disabled ? 'grey' : 'green'"><mat-icon>play_arrow</mat-icon></button>
        <button matTooltip="Stop playback" (click)="controlAudioPlayer.stop()" [disabled]="controlAudioPlayer?.stopAction.disabled" [style.color]="controlAudioPlayer?.stopAction.disabled ? 'grey' : 'yellow'"><mat-icon>stop</mat-icon></button>
        <button matTooltip="Toggle detailed audio display" [disabled]="displayAudioBuffer==null" (click)="showRecordingDetails()"><mat-icon>{{(audioSignalCollapsed)?"expand_less":"expand_more"}}</mat-icon></button><button matTooltip="Download current recording" *ngIf="enableDownload" [disabled]="displayAudioBuffer==null" (click)="downloadRecording()"><mat-icon>file_download</mat-icon></button>
        <span matTooltip="Peak level">Peak: {{peakDbLvl | number:'1.1-1'}} dB </span>
    `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: darkgray;
        padding:4px;
        box-sizing:border-box;
      height: 100px;
      min-height: 100px;
        display: flex; /* flex container: left level bar, right decimal peak level value */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`,`audio-levelbar{
       flex: 1;
        box-sizing:border-box;
    }`,`span{
       flex: 0;
       font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing:border-box;
    }`]

})
export class LevelBarDisplay implements LevelListener,AudioPlayerListener,OnDestroy{

    ce:HTMLDivElement;
    @ViewChild(LevelBar) liveLevel: LevelBar;
    @Input() streamingMode:boolean;
    @Input() audioSignalCollapsed:boolean;
    private _displayAudioBuffer:AudioBuffer|  null;
    @Input() enableDownload:boolean;
    peakDbLevelStr="-___ dB";
    peakDbLvl=MIN_DB_LEVEL;

    _displayLevelInfos:LevelInfos| null;

    @Output() onShowRecordingDetails:EventEmitter<void>=new EventEmitter<void>();
    @Output() onDownloadRecording:EventEmitter<void>=new EventEmitter<void>();

   @Input() controlAudioPlayer: AudioPlayer;
   playStartEnabled=false;
    playStopEnabled=false;
    private updateTimerId:number;

    private destroyed=false;

    constructor(private ref: ElementRef,private changeDetectorRef: ChangeDetectorRef) {

    }

    ngOnDestroy(){
        this.destroyed=true;
    }


    @Input()
    set displayAudioBuffer(displayAudioBuffer:AudioBuffer|null){
        this._displayAudioBuffer=displayAudioBuffer;
        if(this.controlAudioPlayer) {
            this.controlAudioPlayer.audioBuffer = this.displayAudioBuffer;
        }
    }


    get displayAudioBuffer(){
        return  this._displayAudioBuffer;
    }

    showRecordingDetails(){
        this.onShowRecordingDetails.emit();
    }
    downloadRecording(){
        this.onDownloadRecording.emit();
    }

    ngAfterViewInit() {
        this.ce=this.ref.nativeElement;
        this.controlAudioPlayer.listener=this;
    }

    @Input()
    set displayLevelInfos(levelInfos:LevelInfos| null){
        this._displayLevelInfos=levelInfos;
    }

    set channelCount(channelCount:number){
       this.reset();
       this.liveLevel.channelCount=channelCount;
    }

  update(levelInfo:LevelInfo, peakLevelInfo:LevelInfo){
    let peakDBVal=levelInfo.powerLevelDB();
    if(this.peakDbLvl<peakDBVal){
      this.peakDbLvl=peakDBVal;
      // the event comes from outside of an Angular zone
      this.changeDetectorRef.detectChanges();
    }
    this.liveLevel.update(levelInfo);
  }

    updatePlayPosition() {
        if(this.controlAudioPlayer.playPositionFrames) {
           // this.ac.playFramePosition = this.ap.playPositionFrames;
        }
    }

    audioPlayerUpdate(e:AudioPlayerEvent){
        if(EventType.READY===e.type) {
            //this.status = 'Ready';
            this.playStartEnabled = true;
            this.playStopEnabled = false;
        }else if(EventType.STARTED===e.type){
            //this.status = 'Playback...';
            this.updateTimerId = window.setInterval(e=>this.updatePlayPosition(), 50);
            this.playStartEnabled=false;
            this.playStopEnabled=true;
        }else if(EventType.ENDED===e.type){
            //.status='Ready.';
            window.clearInterval(this.updateTimerId);
            this.playStartEnabled=true;
            this.playStopEnabled=false;
        }

        if(!this.destroyed) {
            this.changeDetectorRef.detectChanges();
        }

    }
    error(){
       // this.status = 'ERROR';
    }

  streamFinished(){
    this.liveLevel.streamFinished();

  }



    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;


    }



}
