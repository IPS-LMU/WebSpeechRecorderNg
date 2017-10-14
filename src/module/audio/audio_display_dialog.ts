/**
 * Created by klausj on 29.06.17.
 */


import {
  Component, ViewChild, ChangeDetectorRef, OnDestroy, Inject
} from '@angular/core'
import {MatDialogRef} from '@angular/material';
import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from './playback/player'
import { AudioClipUIContainer } from './ui/container'
import {AudioContextProvider, AudioSystem} from './context'
import {MAT_DIALOG_DATA} from '@angular/material';

@Component({

  selector: 'app-audiodisplaydialog',

  template: `
  <app-audio #audioSignalContainer></app-audio>
  <div><button (click)="ap.start()" [disabled]="!startEnabled"><mat-icon>play_arrow</mat-icon></button> <button (click)="ap.stop()" [disabled]="!stopEnabled"><mat-icon>stop</mat-icon></button>
    <p>Status: {{status}}</p>
    <p>Audio: {{audioFormatStr}}</p></div>`,

  styles: [`:host {
    height: 100%;
    display:flex;
    flex-direction: column;
  }`,`div {
    flex: 0;
  }`,`app-audio {
  }`]

})
export class AudioDisplayDialog implements AudioPlayerListener,OnDestroy {
  startEnabled:boolean;
  stopEnabled:boolean;
  private aCtx:AudioSystem;
  ap:AudioPlayer;
  status:string;
  audioFormatStr:string;
  updateTimerId:any;
  audioBuffer:AudioBuffer | null=null;
  @ViewChild(AudioClipUIContainer)
  private ac:AudioClipUIContainer;
  private destroyed=false;

  constructor(private ref: ChangeDetectorRef,public dialogRef: MatDialogRef<AudioDisplayDialog>,@Inject(MAT_DIALOG_DATA) public data: any) {
    this.ap=data.audioPlayer;
    if(!this.ap) {
      this.aCtx=AudioContextProvider.audioSystem();
      if (!this.aCtx.audioContext) {
        this.status = 'ERROR: Browser does not support Web Audio API!';
      } else {

        this.ap = new AudioPlayer(this.aCtx.audioContext, this);
        this.status = 'Player initialized.';
      }
    }
  }

  ngAfterViewInit(){
    this.destroyed=false;
    this.applyAudioBuffer()
  }

  ngOnDestroy(){
    // stop player
    this.ap.stop();
    // mark component destroyed
    this.destroyed=true;
  }

  applyAudioBuffer(){
    this.audioBuffer=this.data.audioBuffer;
      this.ac.audioData=this.audioBuffer;

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
  }


  started(){
    this.status='Playing...';
  }

  updatePlayPosition() {
    if(this.ap.playPositionFrames) {
      this.ac.playFramePosition = this.ap.playPositionFrames;
    }
  }

  audioPlayerUpdate(e:AudioPlayerEvent){
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

