import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, AfterContentInit, OnInit, AfterContentChecked, AfterViewChecked, ElementRef,
} from '@angular/core'

import {AudioClip} from './persistor'
import {AudioPlayerListener, AudioPlayerEvent, EventType} from './playback/player'
import {AudioClipUIContainer} from './ui/container'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../action/action";
import {AudioDisplayScrollPane} from "./ui/audio_display_scroll_pane";

@Component({

  selector: 'app-audiodisplay',

  template: `
   
    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
  
    <div #controlPanel>
    <button (click)="playStartAction?.perform()" [disabled]="playStartAction?.disabled" [style.color]="playStartAction?.disabled ? 'grey' : 'green'"><mat-icon>play_arrow</mat-icon></button> <button (click)="playStopAction?.perform()" [disabled]="playStopAction?.disabled" [style.color]="playStopAction?.disabled ? 'grey' : 'yellow'"><mat-icon>stop</mat-icon></button>
    Zoom:<button (click)="zoomFitToPanelAction?.perform()" [disabled]="zoomFitToPanelAction?.disabled">{{zoomFitToPanelAction?.name}}</button> <button (click)="zoomOutAction?.perform()" [disabled]="zoomOutAction?.disabled">{{zoomOutAction?.name}}</button>
    <button (click)="zoomInAction?.perform()" [disabled]="zoomInAction?.disabled">{{zoomInAction?.name}}</button>
    </div><p>{{status}}
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
export class AudioDisplay implements OnInit,AfterContentInit,AfterContentChecked,AfterViewInit,AfterViewChecked {
  private _audioUrl: string;

  parentE: HTMLElement;

  @Input()
  playStartAction: Action;
  @Input()
  playStopAction: Action;

  zoomFitToPanelAction:Action;
  zoomInAction:Action;
  zoomOutAction:Action;

  status: string;

  audio: any;
  updateTimerId: any;

  @ViewChild(AudioDisplayScrollPane, { static: true })
  private audioDisplayScrollPane: AudioDisplayScrollPane;

  constructor(private route: ActivatedRoute, private ref: ChangeDetectorRef,private eRef:ElementRef) {
    //console.log("constructor: "+this.ac);
      this.parentE=this.eRef.nativeElement;
    this.playStartAction = new Action("Start");
    this.playStopAction = new Action("Stop");
    this.status="Player created.";

  }

  ngOnInit(){
    //console.log("OnInit: "+this.ac);
      this.zoomFitToPanelAction=this.audioDisplayScrollPane.zoomFitToPanelAction;
    this.zoomOutAction=this.audioDisplayScrollPane.zoomOutAction;
    this.zoomInAction=this.audioDisplayScrollPane.zoomInAction;


  }

  ngAfterContentInit(){
    //console.log("AfterContentInit: "+this.ac);
  }

  ngAfterContentChecked(){
    //console.log("AfterContentChecked: "+this.ac);
  }

  ngAfterViewInit() {

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


  ngAfterViewChecked(){
    //console.log("AfterViewChecked: "+this.ac);
  }


  init() {


  }

  layout(){
    this.audioDisplayScrollPane.layout();
  }


  started() {
    console.log("Play started");
    this.status = 'Playing...';
  }


  @Input()
  set audioData(audioBuffer: AudioBuffer){
      this.audioDisplayScrollPane.audioData = audioBuffer;
      if(audioBuffer) {
          let clip = new AudioClip(audioBuffer);

      }else{
          this.playStartAction.disabled = true
      }
  }


  set playFramePosition(playFramePosition:number){
      this.audioDisplayScrollPane.playFramePosition = playFramePosition
  }

  error() {
    this.status = 'ERROR';
  }

}

