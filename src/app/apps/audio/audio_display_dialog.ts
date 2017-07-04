/**
 * Created by klausj on 29.06.17.
 */


import {Component, ViewChild, ElementRef, AfterContentInit, ChangeDetectorRef, Inject} from '@angular/core'
import {MD_DIALOG_DATA, MdDialog, MdDialogRef} from '@angular/material';
import { WavReader } from '../../audio/impl/wavreader'
import { AudioClip} from '../../audio/persistor'
import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from '../../audio/playback/player'
import { AudioClipUIContainer } from '../../audio/ui/container'


@Component({
  selector: 'dialog-result-example-dialog',
  template: `<h1 md-dialog-title>Dialog</h1>
  <div md-dialog-content>What would you like to do?</div>
      <div md-dialog-actions>
      <button md-button md-dialog-close="Option 1">Option 1</button>
  <button md-button md-dialog-close="Option 2">Option 2</button>
</div>`,
})
export class DialogResultExampleDialog {
  constructor(public dialogRef: MdDialogRef<DialogResultExampleDialog>) {}
}



@Component({

  selector: 'app-audiodisplaydialog',

  template: `
  <h1 md-dialog-title>Audio signal</h1>
  <div>
  <app-audio #audioSignalContainer></app-audio>
  <button (click)="ap.start()" [disabled]="!startEnabled" class="btn-lg btn-primary"></button> <button (click)="ap.stop()" [disabled]="!stopEnabled" class="btn-lg btn-primary"><span class="glyphicon glyphicon-stop"></span></button>
    <p>{{status}}</p></div>`,

  styles: [`:host {
    width: 800px;
    height: 400px;
  }`,`app-audio {
    width: 800px;
    height: 400px;
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
  constructor(private ref: ChangeDetectorRef,public dialogRef: MdDialogRef<DialogResultExampleDialog>) {


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

  }

  init() {
    // this.startBtn.disabled = true;
    // this.stopBtn.disabled = true;
    var n = <any>navigator;
    //var getUserMediaFnct= n.getUserMedia || n.webkitGetUserMedia ||
    //	n.mozGetUserMedia || n.msGetUserMedia;
    var w = <any>window;
    AudioContext = w.AudioContext || w.webkitAudioContext;
    if (typeof AudioContext !== 'function') {
      this.status= 'ERROR: Browser does not support Web Audio API!';
    } else {
      this.aCtx = new AudioContext();
      this.ap = new AudioPlayer(this.aCtx, this);
      //	this.startBtn.disabled = true;

    }
    //this.audioSignal.init();

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
    if(EventType.STARTED===e.type){
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

