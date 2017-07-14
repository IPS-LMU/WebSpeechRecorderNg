
  import { Component,ViewChild,ElementRef,AfterContentInit,ChangeDetectorRef } from '@angular/core'
	import { WavReader } from './impl/wavreader'
  import { AudioClip} from './persistor'
  import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from './playback/player'
  import { AudioClipUIContainer } from './ui/container'

  @Component({

    selector: 'app-audiodisplay',

    template: `<p>AudioSignal display</p>
	<app-audio #audioSignalContainer></app-audio>
    <button (click)="ap.start()" [disabled]="!startEnabled"></button> <button (click)="ap.stop()" [disabled]="!stopEnabled"></button>
	<p>{{status}}</p>`,
    styles: [`app-audiodisplay {
      width: 100%;
      height: 100%
    }`]

  })
	export class AudioDisplay implements AudioPlayerListener,AfterContentInit {
		private _audioUrl:string;
		startEnabled:boolean;
		stopEnabled:boolean;
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

    @ViewChild(AudioClipUIContainer)

    private ac:AudioClipUIContainer;
		constructor(private ref: ChangeDetectorRef) {


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
				this.ac.setData(audioBuffer);
				this.ap.audioClip = clip;
				//this.ap.start();
				//window.setTimeout(e=>this.audioSignal.layout,1000);

				//this.audioSignal.layout();
				//this.ac.layout();
                // this.ap.startAction.addControl(this.startBtn, 'click');
                // this.ap.stopAction.addControl(this.stopBtn, 'click');
				this.startEnabled=true;
			});
		}


		updatePlayPosition() {

			//this.audioSignal.playFramePosition = this.ap.playPositionFrames;
      if(this.ap && this.ap.playPositionFrames) {
        this.ac.playFramePosition = this.ap.playPositionFrames;
      }
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

