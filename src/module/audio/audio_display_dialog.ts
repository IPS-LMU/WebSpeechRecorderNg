/**
 * Created by klausj on 29.06.17.
 */


import {
  Component, ViewChild, ChangeDetectorRef, OnDestroy, AfterViewInit, AfterViewChecked, Inject
} from '@angular/core'
import {MdDialogConfig, MdDialogRef} from '@angular/material';
import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from './playback/player'
import { AudioClipUIContainer } from './ui/container'
import {AudioContextProvider, AudioSystem} from './context'
import {MD_DIALOG_DATA} from '@angular/material';

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
export class AudioDisplayDialog implements AudioPlayerListener,OnDestroy {
  private _audioUrl:string;
  startEnabled:boolean;
  stopEnabled:boolean;
  private aCtx:AudioSystem;
  ap:AudioPlayer;
  status:string;
  audioFormatStr:string;
  currentLoader:XMLHttpRequest;
  //audio:any;
  updateTimerId:any;
  audioBuffer:AudioBuffer | null=null;
  @ViewChild(AudioClipUIContainer)
  private ac:AudioClipUIContainer;
  private destroyed=false;

  constructor(private ref: ChangeDetectorRef,public dialogRef: MdDialogRef<AudioDisplayDialog>,@Inject(MD_DIALOG_DATA) public data: any) {
    this.aCtx=AudioContextProvider.audioSystem();
    if (!this.aCtx.audioContext) {
      this.status= 'ERROR: Browser does not support Web Audio API!';
    } else {

      this.ap = new AudioPlayer(this.aCtx.audioContext, this);
      this.status= 'Player initialized.';
    }
  }



  ngAfterViewInit(){
    console.log("ngAfterViewInit")
    this.destroyed=false;
    //this.init();
    this.applyAudioBuffer()
   // this.updateUI();

  }
  //
  // ngAfterViewChecked(){
  //   console.log("ngAfterViewChecked")
  //
  // }

  ngOnDestroy(){
    // stop player
    this.ap.stop();
    // mark component destroyed
    this.destroyed=true;
  }



  applyAudioBuffer(){
    this.audioBuffer=this.data;
    //setTimeout(_=> {
      this.ac.setData(this.audioBuffer);

      this.ap.audioBuffer = this.audioBuffer;
      if (this.audioBuffer) {
        this.status = "Audio data loaded."
        this.audioFormatStr = this.audioBuffer.sampleRate + " Hz, " + this.audioBuffer.numberOfChannels + " channels, duration: " + this.audioBuffer.duration + " s";
      } else {
        this.status = "No audio data."
        this.audioFormatStr = '';
      }
      this.startEnabled = (this.audioBuffer !== null);
      this.ref.detectChanges();
    //});
  }


  started(){
    console.log("Play started");
    this.status='Playing...';
  }
  // set data(audioBuffer:AudioBuffer){
  //     this.audioBuffer=audioBuffer;
  //     this.data=this.audioBuffer;
  //
  // }


  updatePlayPosition() {
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
      this.status = 'Playback...';
      this.updateTimerId = window.setInterval(e=>this.updatePlayPosition(), 50);
      this.startEnabled=false;
      this.stopEnabled=true;
    }else if(EventType.ENDED===e.type){
      this.status='Ready.';
      window.clearInterval(this.updateTimerId);
      this.startEnabled=true;
      this.stopEnabled=false;
    }

    if(!this.destroyed) {
      this.ref.detectChanges();
    }

  }
  error(){
    this.status = 'ERROR';
  }


}

