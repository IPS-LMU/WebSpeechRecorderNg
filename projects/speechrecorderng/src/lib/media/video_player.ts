import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, AfterContentInit, OnInit, AfterContentChecked, AfterViewChecked, ElementRef,
} from '@angular/core'

import {Selection} from '../audio/persistor'
import {Action} from "../action/action";
import {MediaPlaybackControls} from "./mediaplayback";

@Component({

    selector: 'videoplayer',

    template: `
        <video #videoEl class="videoView" [hidden]="false"></video>
    `,
    styles: [`:host {
        min-width: 50px;
        min-height: 50px;
    }
    `,`.videoView{
            width: 95%;
        height:95%;
        max-height:95%;
            min-height: 0px;
            object-fit: contain;
        }
        `]

})
export class VideoPlayer implements AfterViewInit, MediaPlaybackControls {
    get videoEndTime(): number|null {
        return this._videoEndTime;
    }
    get startAction(): Action<void> {
        return this._videoPlayStartAction;
    }

    get startSelectionAction(): Action<void> {
        return this._videoPlaySelectionAction;
    }

    get videoPlayPauseAction(): Action<void> {
        return this._videoPlayPauseAction;
    }

    get stopAction(): Action<void> {
        return this._videoPlayStopAction;
    }

    autoPlayOnSelectToggleAction: Action<boolean>=new Action<boolean>('Autoplay on select',false);

    @ViewChild('videoEl') videoElRef!: ElementRef;
    protected videoEl!: HTMLVideoElement;

    onplaying:((ev:Event)=>void)|null=null;
    onpause:((ev:Event)=>void)|null=null;
    onerror:((ev:string|Event)=>void)|null=null;
    onended:((ev:Event)=>void)|null=null;

    private _videoEndTime: number|null = null;

    private _videoPlayStartAction: Action<void> = new Action('Play');
    private _videoPlaySelectionAction: Action<void> = new Action('Play selection');
    private _videoPlayPauseAction: Action<void> = new Action('Pause');
    private _videoPlayStopAction: Action<void> = new Action('Stop');
    //private _autoPlayOnSelectToggleAction: Action<boolean>=new Action('Autoplay on select',false);


    private _selection:Selection|null|undefined;
    @Input()
    set selection(selection:Selection|null|undefined){

        this._selection=selection;
        this.startSelectionAction.disabled = this.startSelectionDisabled();
        if (!this.startSelectionDisabled() && this.autoPlayOnSelectToggleAction.value) {
            this.startSelected()
        }
    }

    constructor() {}

    ngAfterViewInit() {
        this.videoEl = this.videoElRef.nativeElement;
        this._videoPlayStartAction.disabled = true;
        this._videoPlayStartAction.onAction = () => {
            this.videoEl.currentTime = 0;
            this._videoEndTime=null;
            this.videoEl.play();
        }
        this._videoPlaySelectionAction.onAction = () => {
           this.startSelected();
        }
        this.videoEl.oncanplay = () => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            this._videoPlaySelectionAction.disabled=this.startSelectionDisabled();
        }
        this.videoEl.onplaying = (ev) => {
            this._videoPlayStartAction.disabled = true;
            this._videoPlayPauseAction.disabled = false;
            this._videoPlayStopAction.disabled = false;
            this._videoPlaySelectionAction.disabled=true;
            if(this.onplaying){
                this.onplaying(ev);
            }
            //this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
        }
        this.videoEl.onpause = (ev:Event) => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            this._videoPlaySelectionAction.disabled=this.startSelectionDisabled();
            //window.clearInterval(this.updateTimerId);
            if(this.onpause){
                this.onpause(ev);
            }
        }
        this.videoEl.onended = (ev:Event) => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            this._videoPlaySelectionAction.disabled=this.startSelectionDisabled();
            //window.clearInterval(this.updateTimerId);
            if(this.onended){
                this.onended(ev);
            }
        }
        this.videoEl.onerror = (ev:string|Event) => {
            this._videoPlayStartAction.disabled = true;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            this._videoPlaySelectionAction.disabled=true;
            //window.clearInterval(this.updateTimerId);
            if(this.onerror){
                this.onerror(ev);
            }
        }
        this._videoPlayStopAction.disabled = true;
        this._videoPlayStopAction.onAction = () => {
            this.videoEl.pause();
            this.videoEl.currentTime = 0;
        }
    }

    play(){
        this.videoEl.play();
    }

    pause(){
        this.videoEl.pause();
    }

    set currentTime(currentTime:number){
        this.videoEl.currentTime=currentTime
    }
    get currentTime():number {
        return this.videoEl.currentTime;
    }

    isPlaying(): boolean {
        return ! this.videoEl.paused;
    }

    startSelected() {
        if (this._selection) {
            let sr = this._selection.sampleRate;
            let startTime = this._selection.leftFrame / sr;
            this._videoEndTime = this._selection.rightFrame / sr;
            this.videoEl.currentTime = startTime;
            this.videoEl.play();
        }
    }

    @Input()
    set mediaStream(mediaStream:MediaStream|null){
      if(this.videoEl){
          this.videoEl.muted=true;
        this.videoEl.srcObject=mediaStream;
        if(mediaStream) {
            this.videoEl.play();
        }
      }
    }

    @Input()
    set mediaBlob(mediaBlob: Blob|null) {
        if(this.videoEl) {
            if (mediaBlob == null) {
                this.videoEl.srcObject = null;
                this.videoEl.src = '';
            } else {
                let mbUrl = URL.createObjectURL(mediaBlob);
                this.videoEl.src = mbUrl;
                this.videoEl.muted=false;
            }
        }
    }

    startSelectionDisabled() {
        return !(!this.startAction.disabled && this._selection)
    }

    //
    // updatePlayPosition() {
    //
    //         let mediaTime = this.videoEl.currentTime;
    //         if (this.videoEndTime) {
    //             if (this.videoEndTime <= mediaTime) {
    //                 this.videoEl.pause();
    //             }
    //         }
    //
    // }

    // audioPlayerUpdate(e: AudioPlayerEvent) {
    //     if (EventType.STARTED === e.type) {
    //         this.status = 'Playback...';
    //         //this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
    //     } else if (EventType.ENDED === e.type) {
    //         this.status = 'Ready.';
    //        // window.clearInterval(this.updateTimerId);
    //     }
    //     this.ref.detectChanges();
    // }

    // error() {
    //     this.status = 'ERROR';
    // }

}

