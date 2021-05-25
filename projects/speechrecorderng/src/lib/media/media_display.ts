import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, OnInit, ElementRef,
} from '@angular/core'

import {AudioClip, Selection} from '../audio/persistor'
import {ActivatedRoute} from "@angular/router";
import {Action} from "../action/action";
import {AudioDisplayScrollPane} from "../audio/ui/audio_display_scroll_pane";
import {MIMEType} from "../net/mimetype";
import {VideoPlayer} from "./video_player";
import {MediaPlaybackControls} from "./mediaplayback";

@Component({

  selector: 'mediadisplay',

  template: `
      <div class="mediaview">
          <videoplayer [hidden]="hideVideo || !hasVideo()" [selection]="audioClip?.selection"></videoplayer>
          <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
      </div>
    <audio-display-control [audioClip]="audioClip"
                             [playStartAction]="playStartAction"
                             [playSelectionAction]="playSelectionAction"
                            [playStopAction]="playStopAction"
    [autoPlayOnSelectToggleAction]="autoPlayOnSelectToggleAction"
    [zoomInAction]="zoomInAction"
    [zoomOutAction]="zoomOutAction"
    [zoomSelectedAction]="zoomSelectedAction"
    [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control>
  `,
  styles: [
      `:host {
      display: flex;
      flex-direction: column;
      position: absolute;
      bottom: 0px;
      height: 100%;
      width: 100%;
      overflow: hidden;
      padding: 20px;
      z-index: 5;
      box-sizing: border-box;
      background-color: rgba(230, 230, 230, 1.0)
    }`,`
          legend{
              margin-left: 1em; padding: 0.2em 0.8em;font-size: 0.8em;
      }`,`
        fieldset{
            border: 1px darkgray solid
      }
      `, `.mediaview {
          display: flex;
          flex-direction: row;
          flex: 3;
      }`,`audio-display-scroll-pane{
            flex: 3;
        }`,`videoplayer{
            flex: 0;
            min-width: 30%;
            object-fit: contain;
        }
        `]

})
export class MediaDisplay implements OnInit,AfterViewInit , MediaPlaybackControls{

  parentE: HTMLElement;

    //@ViewChild('videoEl') videoElRef: ElementRef;
    //protected videoEl: HTMLVideoElement;
    @ViewChild(VideoPlayer) videoPlayer!: VideoPlayer;

    get startAction():Action<void>{
        return this.videoPlayer.startAction
    }
    get startSelectionAction():Action<void>{
        return this.videoPlayer.startSelectionAction;
    }
    get stopAction():Action<void>{
        return this.videoPlayer.stopAction
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

    //private mediaSelectionListener:(audioClip:AudioClip)=>void=null;
    //private videoEndTime: number = null;

    protected mimeType:MIMEType|null=null;


    //private _mediaBlob:Blob;
  private _audioClip:AudioClip|null=null;

  @Input()
  playStartAction: Action<void>|undefined;
  @Input()
  playStopAction: Action<void>|undefined;
  @Input()
  playSelectionAction:Action<void>|undefined;

  private _autoPlayOnSelectToggleAction:Action<boolean>|undefined;
    get autoPlayOnSelectToggleAction(): Action<boolean>|undefined {
        return this._autoPlayOnSelectToggleAction;
    }
    @Input()
    set autoPlayOnSelectToggleAction(value: Action<boolean>|undefined) {
        this._autoPlayOnSelectToggleAction = value;
        if(this.videoPlayer && this._autoPlayOnSelectToggleAction) {
            this.videoPlayer.autoPlayOnSelectToggleAction = this._autoPlayOnSelectToggleAction;
        }
    }


    @Input()
    hideVideo:boolean=false;

    zoomFitToPanelAction:Action<void>|undefined;
    zoomSelectedAction:Action<void>|undefined;
    zoomInAction:Action<void>|undefined;
    zoomOutAction:Action<void>|undefined;

    clearSelectionAction:Action<void>|undefined;

  status: string;

  audio: any;
    updateTimerId: any;

  @ViewChild(AudioDisplayScrollPane, { static: true })
  audioDisplayScrollPane!: AudioDisplayScrollPane;

  constructor(private route: ActivatedRoute, private ref: ChangeDetectorRef,private eRef:ElementRef) {
    //console.log("constructor: "+this.ac);
      this.parentE=this.eRef.nativeElement;
    this.playStartAction = new Action("Start");
    this.playSelectionAction=new Action("Play selected");
    this.playStopAction = new Action("Stop");
    this.status="Player created.";

  }

  ngOnInit(){
    this.zoomSelectedAction=this.audioDisplayScrollPane.zoomSelectedAction
    this.zoomFitToPanelAction=this.audioDisplayScrollPane.zoomFitToPanelAction
    this.zoomOutAction=this.audioDisplayScrollPane.zoomOutAction
    this.zoomInAction=this.audioDisplayScrollPane.zoomInAction
  }

  ngAfterViewInit() {
      this.autoPlayOnSelectToggleAction=this.videoPlayer.autoPlayOnSelectToggleAction;
      this.layout();
      let heightListener=new MutationObserver((mrs:Array<MutationRecord>,mo:MutationObserver)=>{
          mrs.forEach((mr:MutationRecord)=>{
              if('attributes'===mr.type && ('class'===mr.attributeName || 'style'===mr.attributeName)){
                  this.layout();
              }
          })
      });
      heightListener.observe(this.parentE,{attributes: true,childList: true, characterData: true});

  }


  layout(){
    this.audioDisplayScrollPane.layout();
  }

    hasVideo():boolean {
        return(this.mimeType!==null && this.mimeType.isVideo());
    }

  started() {
    console.log("Play started");
    this.status = 'Playing...';
  }

    get mediaBlob(): Blob|null {
        return this.videoPlayer.mediaBlob;
    }

    @Input()
    set mediaBlob(value: Blob|null) {
      if(value) {
          this.mimeType = MIMEType.parse(value.type);
      }else{
          this.mimeType=null;
      }
      if(this.videoPlayer) {
          this.videoPlayer.mediaBlob = value;
      }
    }

  @Input()
  set audioData(audioBuffer: AudioBuffer){
      this.audioDisplayScrollPane.audioData = audioBuffer;
      if(this.playStartAction) {
          this.playStartAction.disabled = (audioBuffer == null);
      }
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {

    let audioData:AudioBuffer|null=null;

    if(audioClip){
      audioData=audioClip.buffer;
      }
    this._audioClip=audioClip
      if(this._audioClip){
          this._audioClip.addSelectionObserver((ac)=>{
              this.startSelectionAction.disabled = this.startAction.disabled || ! this._audioClip?.selection;
              if (this.mediaBlob && !this.startSelectionAction.disabled && this.autoPlayOnSelectToggleAction?.value) {
                  this.videoPlayer.startSelected();
              }
          });
      }
    this.audioDisplayScrollPane.audioClip = audioClip;
    //this.playStartAction.disabled = (audioData!==null)
  }

  get audioClip():AudioClip|null{
    return this._audioClip
  }


    set playFramePosition(playFramePosition:number){
      this.audioDisplayScrollPane.playFramePosition = playFramePosition
  }

    set playTimePosition(time:number){
     this.audioDisplayScrollPane.playTimePosition=time;
    }

  error() {
    this.status = 'ERROR';
  }

}

