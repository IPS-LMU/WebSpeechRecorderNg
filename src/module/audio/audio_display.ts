
  import {
  Component,
  ViewChild,
  ElementRef,
  AfterContentInit,
  ChangeDetectorRef,
  AfterViewInit,
    Input
  } from '@angular/core'
	import { WavReader } from './impl/wavreader'
  import { AudioClip} from './persistor'
  import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from './playback/player'
  import { AudioClipUIContainer } from './ui/container'
  import {ActivatedRoute, Params, Router} from "@angular/router";
  import {Status as SessionManagerStatus} from "../speechrecorder/session/sessionmanager";
  import {AudioDisplayControl} from "./ui/audio_display_control";
  import {Action} from "../action/action";

  @Component({

    selector: 'app-audiodisplay',

    template: `
	<app-audio #audioSignalContainer></app-audio>
     <app-audiodisplaycontrol [playStartAction]="playStartAction" [playStopAction]="playStopAction"></app-audiodisplaycontrol> 
    `,
    styles: [
        `:host {
        display: flex;
        flex-direction: column;
        position: absolute;
        bottom: 0px;
        /*left: 0px; */

        height: 100%;
        width: 100%;

        overflow: hidden;

        padding: 20px;
        /* margin: 20px; */
        /* border: 20px; */
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
	export class AudioDisplay implements AudioPlayerListener,AfterViewInit {
		private _audioUrl:string;
		//startEnabled:boolean;
		//stopEnabled:boolean;
    playStartAction:Action;
    playStopAction:Action;
		aCtx:AudioContext;
		ap:AudioPlayer;
	   status:string;
		//audioSignal:AudioSignal;
		//audioSonagram:Sonagram;
		currentLoader:XMLHttpRequest | null;
		//startBtn:HTMLInputElement;
		//stopBtn:HTMLInputElement;
		//statusMsg:HTMLElement;
		audio:any;
		updateTimerId:any;

    //@ViewChild(AudioDisplayControl)
    //private ctrl:AudioDisplayControl;

    @ViewChild(AudioClipUIContainer)
    private ac:AudioClipUIContainer;

		constructor(private route: ActivatedRoute,private ref: ChangeDetectorRef) {
      this.playStartAction=new Action("Start");

      this.playStopAction=new Action("Stop");

		}

    ngAfterViewInit(){
      this.init();
		  this.route.queryParams.subscribe((params: Params) => {
            if (params['url']) {
                this.audioUrl=params['url'];
            }
          });

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
        this.playStartAction.onAction=()=>this.ap.start();
        this.playStopAction.onAction=()=>this.ap.stop();

			}
		}

		get audioUrl():string {
			return this._audioUrl;
		}

		set audioUrl(value:string) {
			this.ap.stop();
			this._audioUrl = value;
			this.load();
		}



		started(){
			//this.stopBtn.disabled=false;

			console.log("Play started");
			this.status='Playing...';
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

		private loaded(data:ArrayBuffer) {
			// this.startBtn.disabled=false;
			// this.stopBtn.disabled=true;
			console.log("Loaded");
			this.status='Audio file loaded.';
			console.log("Received data ",data.byteLength);
			//var wr=new WavReader(data);

			//var clip = wr.read();

			var audioBuffer = this.aCtx.decodeAudioData(data, (audioBuffer)=> {
				console.log("Samplerate: ", audioBuffer.sampleRate);
				var clip = new AudioClip(audioBuffer);
				// Use Web audio API AudioBuffer instead of AudioClip
				//var ab=this.aCtx.createAudioBuffer();
				//var da0=clip.data[0];
				//this.audioSignal.setData(audioBuffer);
				this.ac.audioData=audioBuffer;
				this.ap.audioClip = clip;
				//this.ap.start();
				//window.setTimeout(e=>this.audioSignal.layout,1000);

				//this.audioSignal.layout();
				//this.ac.layout();
                // this.ap.startAction.addControl(this.startBtn, 'click');
                // this.ap.stopAction.addControl(this.stopBtn, 'click');
				//this.ctrl.startEnabled=true;
				this.playStartAction.disabled=false
			});
		}


		updatePlayPosition() {

			//this.audioSignal.playFramePosition = this.ap.playPositionFrames;
      if(this.ap && this.ap.playPositionFrames) {
        this.ac.playFramePosition = this.ap.playPositionFrames;
      }
		}
		audioPlayerUpdate(e:AudioPlayerEvent){
			if(EventType.STARTED===e.type){
				// this.startBtn.disabled=true;
				// this.stopBtn.disabled = false;
				this.status = 'Playback...';
				this.updateTimerId = window.setInterval(e=>this.updatePlayPosition(), 50);
				//this.ctrl.startEnabled=false;
				this.playStartAction.disabled=true;
				//this.ctrl.stopEnabled=true;
				this.playStopAction.disabled=false;
			}else if(EventType.ENDED===e.type){
				// this.startBtn.disabled=false;
				// this.stopBtn.disabled=true;

				this.status='Ready.';
				window.clearInterval(this.updateTimerId);
				//this.ctrl.startEnabled=true;
        this.playStartAction.disabled=false;
				//this.ctrl.stopEnabled=false;
				this.playStopAction.disabled=true;
			}

			//this.ref.markForCheck();
			this.ref.detectChanges();

		}
		error(){
			this.status = 'ERROR';
		}


    }

