import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, AfterContentInit, OnInit, AfterContentChecked, AfterViewChecked, ElementRef,
} from '@angular/core'

import {AudioClip, Selection} from './persistor'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../action/action";
import {AudioDisplayScrollPane} from "./ui/audio_display_scroll_pane";
import {MatCheckbox, MatCheckboxChange} from "@angular/material/checkbox";
import {MatSelectChange} from "@angular/material/select";

@Component({

  selector: 'app-audiodisplay',

  template: `
   
    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
  
    <div #controlPanel style="display:flex;flex-direction: row;" >
           <fieldset>

               <legend>Play</legend>

    <button (click)="playStartAction?.perform()" [disabled]="playStartAction?.disabled" [style.color]="playStartAction?.disabled ? 'grey' : 'green'"><mat-icon>play_arrow</mat-icon></button> <button (click)="playStopAction?.perform()" [disabled]="playStopAction?.disabled" [style.color]="playStopAction?.disabled ? 'grey' : 'yellow'"><mat-icon>stop</mat-icon></button>
           <mat-checkbox #autoplaySelectionCheckbox (change)="autoPlaySelectionChange($event)">Autoplay selection</mat-checkbox>
           </fieldset>
        <fieldset>

            <legend>Zoom</legend>
        <button (click)="zoomFitToPanelAction?.perform()" [disabled]="zoomFitToPanelAction?.disabled">{{zoomFitToPanelAction?.name}}</button> <button (click)="zoomOutAction?.perform()" [disabled]="zoomOutAction?.disabled">{{zoomOutAction?.name}}</button>
        <button (click)="zoomInAction?.perform()" [disabled]="zoomInAction?.disabled">{{zoomInAction?.name}}</button><button (click)="zoomSelectedAction?.perform()" [disabled]="zoomSelectedAction?.disabled">{{zoomSelectedAction?.name}}</button>
        </fieldset>
        <fieldset>
            <legend>Selection</legend>
            {{_audioClip?.selection?.leftFrame}} <span *ngIf="_audioClip?.selection">to</span> {{_audioClip?.selection?.rightFrame}} <button (click)="clearSelection()" [disabled]="_audioClip?.selection==null" [style.color]="_audioClip?.selection!=null ? 'red' : 'grey'"><mat-icon>clear</mat-icon></button> <button (click)="playSelectionAction.perform()" [disabled]="playSelectionAction.disabled" [style.color]="playSelectionAction.disabled ? 'grey' : 'green'"><mat-icon>play_arrow</mat-icon></button>
        </fieldset>
    </div>
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
    }`,`          
          legend{
              margin-left: 1em; padding: 0.2em 0.8em;font-size: 0.8em;
      }`,`
        fieldset{
            border: 1px darkgray solid
      }
      `]

})
export class AudioDisplay implements OnInit,AfterContentInit,AfterContentChecked,AfterViewInit,AfterViewChecked {

  parentE: HTMLElement;
  _audioClip:AudioClip

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

  status: string;

  audio: any;

  @ViewChild(AudioDisplayScrollPane)
  audioDisplayScrollPane: AudioDisplayScrollPane;

  @ViewChild(MatCheckbox)
  private autoplaySelectedCheckbox:MatCheckbox

  constructor(private route: ActivatedRoute, private ref: ChangeDetectorRef,private eRef:ElementRef) {
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

    clearSelection(){
      if(this._audioClip!=null){
          this._audioClip.selection=null
      }
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
      this.playStartAction.disabled = (audioBuffer==null)
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {

    let audioData:AudioBuffer=null;
    let sel:Selection=null;
    if(audioClip){
      audioData=audioClip.buffer;
      sel=audioClip.selection;
    }
    this._audioClip=audioClip
    this.audioDisplayScrollPane.audioClip = audioClip;
    //this.playStartAction.disabled = (audioData!==null)
  }

  autoPlaySelectionChange(ch:MatCheckboxChange){
      if(this.autoPlayOnSelectToggleAction) {
          this.autoPlayOnSelectToggleAction.perform(ch.checked)
      }
  }

  set playFramePosition(playFramePosition:number){
      this.audioDisplayScrollPane.playFramePosition = playFramePosition
  }

  error() {
    this.status = 'ERROR';
  }

}

