/**
 * Created by klausj on 29.06.17.
 */


import {Component, ViewChild, ElementRef, AfterContentInit, ChangeDetectorRef, Inject} from '@angular/core'
import {MD_DIALOG_DATA, MdDialog, MdDialogRef} from '@angular/material';
import { WavReader } from './impl/wavreader'
import { AudioClip} from './persistor'
import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from './playback/player'
import { AudioClipUIContainer } from './ui/container'
import {AudioContextProvider} from './context'
//import {isNullOrUndefined} from "util";

@Component({

  selector: 'app-audiodisplaydialog',

  template: `
  <!-- <h1 md-dialog-title>Audio signal</h1> -->
  <app-audio #audioSignalContainer></app-audio>
  <div><button (click)="ap.start()" [disabled]="!startEnabled"><md-icon>play_arrow</md-icon></button> <button (click)="ap.stop()" [disabled]="!stopEnabled"><md-icon>stop</md-icon></button>
    <p>Status: {{status}}</p>
    <p>Audio: {{audioFormatStr}}</p></div>`,

  styles: [`:host {
   /* width: 800px;
    height: 400px; */
    height: 100%;
    display:flex;
    flex-direction: column;
  }`,`div {
    /* height: 100%; */
    flex: 0;
  }`,`app-audio {
    /* width: 800px;
    height: 400px; */
    /* height: 100%; */
  }`]

})
export class AudioDisplayDialog implements AudioPlayerListener,AfterContentInit {
  private _audioUrl:string;
  startEnabled:boolean;
  stopEnabled:boolean;
  aCtx:AudioContext;
  ap:AudioPlayer;
  status:string;
  audioFormatStr:string;
  //audioSignal:AudioSignal;
  //audioSonagram:Sonagram;
  currentLoader:XMLHttpRequest;
  audio:any;
  updateTimerId:any;
  audioBuffer:AudioBuffer;
  @ViewChild(AudioClipUIContainer)

  private ac:AudioClipUIContainer;
  constructor(private ref: ChangeDetectorRef,public dialogRef: MdDialogRef<AudioDisplayDialog>) {


    // this.startBtn = <HTMLInputElement>(document.getElementById('startBtn'));
    // this.stopBtn = <HTMLInputElement>(document.getElementById('stopBtn'));
    //this.audio = document.getElementById('audio');
    //var asc = <HTMLDivElement>document.getElementById('audioSignalContainer');
    //this.audioSignal = new AudioSignal(asc);
    //this.audioSonagram = new Sonagram(asc);
    //this.ac = new AudioClipUIContainer();
    //this.statusMsg = <HTMLElement>(document.getElementById('status'));
  }

  ngAfterContentInit() {
    //   this.init();
    //   //this.audioUrl="http://www.phonetik.uni-muenchen.de/~klausj/Trappa1.wav";
    // this.audioUrl="test/audio.wav";
  }

  ngAfterViewInit(){
    this.init();
    // this.data=this.audioBuffer;
    // this.startEnabled=(!isNullOrUndefined(this.data));
    //  this.ref.detectChanges();
    this.updateUI();
  }

  init() {
    this.aCtx=AudioContextProvider.audioContext;
    if (!this.aCtx) {
      this.status= 'ERROR: Browser does not support Web Audio API!';
    } else {

      this.ap = new AudioPlayer(this.aCtx, this);
      this.status= 'Player initialized.';
    }
  }

  private updateUI(){

    this.ac.setData(this.audioBuffer);

    this.ap.audioBuffer=this.audioBuffer;
    if(this.audioBuffer) {
      this.status="Audio data loaded."
      this.audioFormatStr = this.audioBuffer.sampleRate + " Hz, " + this.audioBuffer.numberOfChannels + " channels, duration: " + this.audioBuffer.duration+" s";
    }else{
      this.status="No audio data."
      this.audioFormatStr='';
    }
    this.startEnabled=(!(this.audioBuffer));
    this.ref.detectChanges();
  }


  started(){
    //this.stopBtn.disabled=false;

    console.log("Play started");
    this.status='Playing...';
  }
  set data(audioBuffer:AudioBuffer){
      this.audioBuffer=audioBuffer;
      this.data=this.audioBuffer;

  }


  updatePlayPosition() {

    //this.audioSignal.playFramePosition = this.ap.playPositionFrames;
    if(this.ap.playPositionFrames) {
      this.ac.playFramePosition = this.ap.playPositionFrames;
    }
  }
  update(e:AudioPlayerEvent){
    if(EventType.READY===e.type) {
      this.status = 'Ready';
      this.startEnabled = true;
      this.stopEnabled = false;
    }else if(EventType.STARTED===e.type){
      // this.startBtn.disabled=true;
      // this.stopBtn.disabled = false;
      this.status = 'Playback...';
      this.updateTimerId = window.setInterval(e=>this.updatePlayPosition(), 50);
      this.startEnabled=false;
      this.stopEnabled=true;
    }else if(EventType.ENDED===e.type){
      // this.startBtn.disabled=false;
      // this.stopBtn.disabled=true;

      this.status='Ready.';
      window.clearInterval(this.updateTimerId);
      this.startEnabled=true;
      this.stopEnabled=false;
    }

    //this.ref.markForCheck();
    this.ref.detectChanges();

  }
  error(){
    this.status = 'ERROR';
  }


}

