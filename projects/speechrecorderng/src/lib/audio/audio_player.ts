import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, AfterContentInit, OnInit, AfterContentChecked, AfterViewChecked, ElementRef,
} from '@angular/core'

import {AudioClip, Selection} from './persistor'
import {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from './playback/player'
import {AudioClipUIContainer} from './ui/container'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../action/action";
import {AudioDisplayScrollPane} from "./ui/audio_display_scroll_pane";
import {AudioContextProvider} from "./context";

@Component({

  selector: 'app-audiodisplayplayer',

  template: `
   
    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>

    <audio-display-control [audioClip]="audioClip"
                             [playStartAction]="playStartAction"
                             [playSelectionAction]="playSelectionAction"
                             [playStopAction]="playStopAction"
                             [autoPlayOnSelectToggleAction]="ap?.autoPlayOnSelectToggleAction"
                             [zoomInAction]="zoomInAction"
                             [zoomOutAction]="zoomOutAction"
                             [zoomSelectedAction]="zoomSelectedAction"
                             [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control><p>{{status}}
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
          background-color: rgba(230, 230, 230, 0.75)
    }`]

})
export class AudioDisplayPlayer implements AudioPlayerListener, OnInit,AfterContentInit,AfterContentChecked,AfterViewInit,AfterViewChecked {
  private _audioUrl: string;

  parentE: HTMLElement;

  @Input()
  playStartAction: Action<void>;
  @Input()
  playStopAction: Action<void>;
  @Input()
  playSelectionAction:Action<void>
  @Input()
  autoPlayOnSelectToggleAction:Action<boolean>

  zoomFitToPanelAction:Action<void>;
  zoomSelectedAction:Action<void>
  zoomInAction:Action<void>;
  zoomOutAction:Action<void>;


  aCtx: AudioContext;
  private _audioClip:AudioClip=null;
  ap: AudioPlayer;
  status: string;

  currentLoader: XMLHttpRequest | null;

  audio: any;
  updateTimerId: any;


  @ViewChild(AudioDisplayScrollPane)
  private audioDisplayScrollPane: AudioDisplayScrollPane;

  constructor(protected route: ActivatedRoute, protected ref: ChangeDetectorRef,protected eRef:ElementRef) {
    //console.log("constructor: "+this.ac);
      this.parentE=this.eRef.nativeElement;
    this.playStartAction = new Action("Start");
    this.playSelectionAction=new Action("Play selected");
    this.playStopAction = new Action("Stop");
    this.status="Player created.";

  }

  ngOnInit(){
    //console.log("OnInit: "+this.ac);
    this.zoomSelectedAction=this.audioDisplayScrollPane.zoomSelectedAction
      this.zoomFitToPanelAction=this.audioDisplayScrollPane.zoomFitToPanelAction;
    this.zoomOutAction=this.audioDisplayScrollPane.zoomOutAction;
    this.zoomInAction=this.audioDisplayScrollPane.zoomInAction;
     try {
       this.aCtx = AudioContextProvider.audioContextInstance();
       this.ap = new AudioPlayer(this.aCtx, this);
     }catch(err){
          this.status = err.message;
      }
  }

  ngAfterContentInit(){
    //console.log("AfterContentInit: "+this.ac);
  }

  ngAfterContentChecked(){
    //console.log("AfterContentChecked: "+this.ac);
  }

  ngAfterViewInit() {
      if (this.aCtx && this.ap) {
          this.playStartAction.onAction = () => this.ap.start();
        this.playSelectionAction.onAction = () => this.ap.startSelected();
          this.playStopAction.onAction = () => this.ap.stop();
      }
      this.layout();
      let heightListener=new MutationObserver((mrs:Array<MutationRecord>,mo:MutationObserver)=>{
          mrs.forEach((mr:MutationRecord)=>{
              if('attributes'===mr.type && ('class'===mr.attributeName || 'style'===mr.attributeName)){
                  this.layout();
              }
          })
      });
      heightListener.observe(this.parentE,{attributes: true,childList: true, characterData: true});
    this.route.queryParams.subscribe((params: Params) => {
      if (params['url']) {
        this.audioUrl = params['url'];
      }
    });
  }


  ngAfterViewChecked(){
    //console.log("AfterViewChecked: "+this.ac);
  }


  init() {


  }

  layout(){
    this.audioDisplayScrollPane.layout();
  }

  get audioUrl(): string {
    return this._audioUrl;
  }

  set audioUrl(value: string) {
    this.ap.stop();
    this._audioUrl = value;
    this.load();
  }


  started() {
    console.log("Play started");
    this.status = 'Playing...';
  }

  private load() {

    if (this.currentLoader) {
      this.currentLoader.abort();
      this.currentLoader = null;
    }
    //this.statusMsg.innerHTML = 'Connecting...';
    this.currentLoader = new XMLHttpRequest();
    this.currentLoader.open("GET", this._audioUrl, true);
    this.currentLoader.responseType = "arraybuffer";
    this.currentLoader.onload = (e) => {
      if (this.currentLoader) {

        var data = this.currentLoader.response; // not responseText
        console.log("Received data ", data.byteLength);
        this.currentLoader = null;
        this.loaded(data);
      }
    }
    this.currentLoader.onerror = (e) => {
      console.log("Error downloading ...");
      //this.statusMsg.innerHTML = 'Error loading audio file!';
      this.currentLoader = null;
    }
    //this.statusMsg.innerHTML = 'Loading...';

    this.currentLoader.send();

  }

  private loaded(data: ArrayBuffer) {

    console.log("Loaded");
    this.status = 'Audio file loaded.';
    console.log("Received data ", data.byteLength);

    var audioBuffer = this.aCtx.decodeAudioData(data, (audioBuffer) => {
      console.log("Samplerate: ", audioBuffer.sampleRate)
      this.audioClip=new AudioClip(audioBuffer)
    });
  }

  @Input()
  set audioData(audioBuffer: AudioBuffer){
      this.audioDisplayScrollPane.audioData = audioBuffer;
      if(audioBuffer) {
          let clip = new AudioClip(audioBuffer);
          if (this.ap){
              this.ap.audioClip = clip;
                this.playStartAction.disabled = false
            }
      }else{
          this.playStartAction.disabled = true
          if (this.ap){
              this.ap.audioClip = null;
          }
      }
    this.playSelectionAction.disabled=true
  }

  startSelectionDisabled(){
    return !(this._audioClip && this.ap!=null && !this.playStartAction.disabled && this._audioClip.selection )
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {
    this._audioClip=audioClip
    let audioData:AudioBuffer=null;
    let sel:Selection=null;
    if(audioClip){
      audioData=audioClip.buffer;
      sel=audioClip.selection;
      this._audioClip.addSelectionObserver((ac)=>{

          this.playSelectionAction.disabled = this.startSelectionDisabled()
          // if(this.ap && ac.selection && this.autoplaySelectedCheckbox.checked){
          //   this.ap.startSelected()
          // }

      })
    }
    if(audioData) {
      this.playStartAction.disabled =(!this.ap)
      this.playSelectionAction.disabled=this.startSelectionDisabled()
    }else{
      this.playStartAction.disabled = true
      this.playSelectionAction.disabled=true
    }

    this.audioDisplayScrollPane.audioClip=audioClip
    this.ap.audioClip=audioClip
  }

  get audioClip():AudioClip|null{
    return this._audioClip
  }

  updatePlayPosition() {

    if (this.ap && this.ap.playPositionFrames) {
      this.audioDisplayScrollPane.playFramePosition = this.ap.playPositionFrames;
    }
  }

  audioPlayerUpdate(e: AudioPlayerEvent) {
    if (EventType.STARTED === e.type) {
      this.status = 'Playback...';
      this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
      this.playStartAction.disabled = true;
      this.playSelectionAction.disabled=true
      this.playStopAction.disabled = false;
    } else if (EventType.ENDED === e.type) {
      this.status = 'Ready.';
      window.clearInterval(this.updateTimerId);
      this.playStartAction.disabled = false;
      this.playSelectionAction.disabled=this.startSelectionDisabled()
      this.playStopAction.disabled = true;
    }

    this.ref.detectChanges();

  }

  error() {
    this.status = 'ERROR';
  }

}

