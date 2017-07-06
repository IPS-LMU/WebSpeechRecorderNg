/**
 * Created by klausj on 29.06.17.
 */


import {Component, ViewChild, ElementRef, AfterContentInit, ChangeDetectorRef, Inject} from '@angular/core'
import {MD_DIALOG_DATA, MdDialog, MdDialogRef} from '@angular/material';
import { WavReader } from '../../audio/impl/wavreader'
import { AudioClip} from '../../audio/persistor'
import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from '../../audio/playback/player'
import { AudioClipUIContainer } from '../../audio/ui/container'
import {AudioContextProvider} from '../../audio/context'

@Component({

  selector: 'app-audiodisplaydialog',

  template: `
  <!-- <h1 md-dialog-title>Audio signal</h1> -->
  <app-audio #audioSignalContainer></app-audio>
  <div><button (click)="ap.start()" [disabled]="!startEnabled"><md-icon>play_arrow</md-icon></button> <button (click)="ap.stop()" [disabled]="!stopEnabled"><md-icon>stop</md-icon></button>
    <p>Status: {{status}}</p></div>`,

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
  //audioSignal:AudioSignal;
  //audioSonagram:Sonagram;
  currentLoader:XMLHttpRequest;
  //startBtn:HTMLInputElement;
  //stopBtn:HTMLInputElement;
  //statusMsg:HTMLElement;
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
    this.data=this.audioBuffer;
    if(this.data){
      this.startEnabled=true;
     this.ref.detectChanges();
    }
  }

  init() {
    this.aCtx=AudioContextProvider.audioContext;
    if (!this.aCtx) {
      this.status= 'ERROR: Browser does not support Web Audio API!';
    } else {

      this.ap = new AudioPlayer(this.aCtx, this);
    }
  }


  started(){
    //this.stopBtn.disabled=false;

    console.log("Play started");
    this.status='Playing...';
  }

  set data(audioBuffer:AudioBuffer){

      this.ac.setData(audioBuffer);
      //this.ap.audioClip = clip;
      this.ap.audioBuffer=audioBuffer;
  }


  updatePlayPosition() {

    //this.audioSignal.playFramePosition = this.ap.playPositionFrames;
    this.ac.playFramePosition = this.ap.playPositionFrames;
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

