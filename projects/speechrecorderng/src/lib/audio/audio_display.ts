import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core'

import {AudioClip} from './persistor'
import {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from './playback/player'
import {AudioClipUIContainer} from './ui/container'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../action/action";

@Component({

  selector: 'app-audiodisplay',

  template: `
    <app-audio #audioSignalContainer></app-audio>
    <app-audiodisplaycontrol [playStartAction]="playStartAction"
                             [playStopAction]="playStopAction"></app-audiodisplaycontrol>
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
      background-color: rgba(0, 0, 0, 0.75)
    }`,
      `app-audio {
      flex: 2;
      width: 100%;
      height: 100%;
    }`, `app-audiodisplay {
      width: 100%;
      height: 100%
    }`]

})
export class AudioDisplay implements AudioPlayerListener, AfterViewInit {
  private _audioUrl: string;
  playStartAction: Action;
  playStopAction: Action;
  aCtx: AudioContext;
  ap: AudioPlayer;
  status: string;

  currentLoader: XMLHttpRequest | null;

  audio: any;
  updateTimerId: any;

  @ViewChild(AudioClipUIContainer)
  private ac: AudioClipUIContainer;

  constructor(private route: ActivatedRoute, private ref: ChangeDetectorRef) {
    this.playStartAction = new Action("Start");
    this.playStopAction = new Action("Stop");
  }

  ngAfterViewInit() {
    this.init();
    this.route.queryParams.subscribe((params: Params) => {
      if (params['url']) {
        this.audioUrl = params['url'];
      }
    });
  }

  init() {

    var n = <any>navigator;
    var w = <any>window;
    AudioContext = w.AudioContext || w.webkitAudioContext;
    if (typeof AudioContext !== 'function') {
      this.status = 'ERROR: Browser does not support Web Audio API!';
    } else {
      this.aCtx = new AudioContext();
      this.ap = new AudioPlayer(this.aCtx, this);
      this.playStartAction.onAction = () => this.ap.start();
      this.playStopAction.onAction = () => this.ap.stop();

    }
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
      console.log("Samplerate: ", audioBuffer.sampleRate);
      var clip = new AudioClip(audioBuffer);

      this.ac.audioData = audioBuffer;
      this.ap.audioClip = clip;
      this.playStartAction.disabled = false
    });
  }


  updatePlayPosition() {

    if (this.ap && this.ap.playPositionFrames) {
      this.ac.playFramePosition = this.ap.playPositionFrames;
    }
  }

  audioPlayerUpdate(e: AudioPlayerEvent) {
    if (EventType.STARTED === e.type) {
      this.status = 'Playback...';
      this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
      this.playStartAction.disabled = true;
      this.playStopAction.disabled = false;
    } else if (EventType.ENDED === e.type) {
      this.status = 'Ready.';
      window.clearInterval(this.updateTimerId);
      this.playStartAction.disabled = false;
      this.playStopAction.disabled = true;
    }

    this.ref.detectChanges();

  }

  error() {
    this.status = 'ERROR';
  }

}

