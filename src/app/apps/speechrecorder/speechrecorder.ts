import { Component } from '@angular/core'

import { Mode as SessionMode } from './session/sessionmanager';
	import {AudioCaptureListener} from '../../audio/capture/capture';
	import {AudioPlayer,AudioPlayerListener,AudioPlayerEvent, EventType as PlaybackEventType } from '../../audio/playback/player';
  import {AudioSignal } from '../../audio/ui/audiosignal';

	import { AudioClipUIContainer } from '../../audio/ui/container';
	import { SimpleTrafficLight } from './startstopsignal/ui/simpletrafficlight'
  import { Script } from './script/script'
  import { SessionManager} from  './session/sessionmanager';
  import { Uploader, UploaderStatusChangeEvent, UploaderStatus } from '../../net/uploader';


  export enum Mode {SINGLE_SESSION,DEMO}

@Component({

  selector: 'app-sprprompter',

  template: `
   
      <div><p><span #prompt>Here is a text ... Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 2</span></p></div>
      `,
  styles: [`div{

      justify-content: center; /* align horizontal */
      align-items: center; /* align vertical */
      //background: white;
      text-align: center;
     //height: 100%;
      background: red;
      font-size: 20pt;
    flex: 1 1;
    }
  `]
})
export class Prompter{

}

@Component({

    selector: 'app-sprpromptcontainer',

    template: `

        <div><app-sprprompter></app-sprprompter></div>
        `
    ,
    styles: [`div{
        display: flex;
        padding: 10pt;
        height: 100%;
        justify-content: center; /* align horizontal */
        align-items: center; /* align vertical */
        background: white;
        text-align: center;
        flex-direction:column;
        flex: 3 1;
    }
    `]
})
export class PromptContainer{

}

@Component({

  selector: 'app-sprprompting',

  template: `
  
    <app-simpletrafficlight></app-simpletrafficlight>
    <app-sprpromptcontainer></app-sprpromptcontainer>
    

  `,
  styles: [`:host{
   
      height: 100%;
      margin: 0;
      padding: 0;
    background: yellow;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
    //width: 100%;
      flex: 1;

      /* Workaround for Firefox
      If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
      the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
      See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
      */  
      min-height:0;
    }`]

})

export class Prompting{
}

@Component({

  selector: 'app-speechrecorder',

  template: `
    <div style="height:100%"><app-sprprompting></app-sprprompting></div>`,
  styles: [`:host{
    width: 100%;
    height: 100%;
    background: orange;
  }`]

})
export class SpeechRecorder implements AudioPlayerListener {

	  mode:Mode;
		sm:SessionManager;
		ap:AudioPlayer;
        uploader: Uploader;
		//audioSignal:AudioClipUIContainer;
        uploadProgresBarDivEl: HTMLDivElement;
		statusMsg:HTMLElement;
		titleEl:HTMLElement;
		audio:any;

        project: any;
    sessionId: string;
    session:any;
    script:Script;
        dataSaved: boolean = true;


    currentPromptIdx:number;

		constructor() {
			this.audio = document.getElementById('audio');
			var asc = <HTMLDivElement>document.getElementById('audioSignalContainer');
            this.uploadProgresBarDivEl = <HTMLDivElement>(document.getElementById('uploadProgressBar'));
			this.statusMsg = <HTMLElement>(document.getElementById('status'));
      this.titleEl = <HTMLElement>(document.getElementById('title'));
            this.uploader = new Uploader();
		}

		init() {

			var n = <any>navigator;
			//var getUserMediaFnct= n.getUserMedia || n.webkitGetUserMedia ||
			//	n.mozGetUserMedia || n.msGetUserMedia;
			var w = <any>window;

			AudioContext = w.AudioContext || w.webkitAudioContext;
			if (typeof AudioContext !== 'function') {
				this.statusMsg.innerHTML = 'ERROR: Browser does not support Web Audio API!';
			} else {
				var context = new AudioContext();

				if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
					this.statusMsg.innerHTML = 'ERROR: Browser does not support Media streams!';
				} else {


                    this.sm = new SessionManager(new SimpleTrafficLight(), this.uploader);
					this.sm.init();
					this.ap = new AudioPlayer(context,this);
					//this.sm.listener=this;
				}
			}
            this.uploader.listener = (ue) => {
                this.uploadUpdate(ue);
            }

            window.addEventListener('beforeunload', (e) => {
                console.log("Before page unload event");

                if (this.dataSaved) {
                    return;
                } else {
                    // all this attempts to customize the message do not work anymore (for security reasons)!!
                    var message = "Please do not leave the page, until all recordings are uploaded!";
                    alert(message);
                    e = e || window.event;

                    if (e) {
                        e.returnValue = message;
                        e.cancelBubble = true;
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        }
                        if (e.preventDefault) {
                            e.preventDefault();
                        }
                    }

                    return message;
                }
            });
        }

        uploadUpdate(ue: UploaderStatusChangeEvent) {
            let upStatus = ue.status;
            this.dataSaved = (UploaderStatus.DONE === upStatus);
            let percentUpl = ue.percentDone();

            // set progress bar type
            // CSS class active (animated striped) consumes too much CPU
            if (UploaderStatus.UPLOADING === upStatus) {
                this.uploadProgresBarDivEl.classList.remove('progress-bar-warning');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-danger');
                this.uploadProgresBarDivEl.classList.add('progress-bar-success');
                this.uploadProgresBarDivEl.classList.add('progress-bar-striped');
                // this.uploadProgresBarDivEl.classList.add('active');
            } else if (UploaderStatus.DONE === upStatus) {
                this.uploadProgresBarDivEl.classList.remove('progress-bar-warning');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-danger');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-striped');
                this.uploadProgresBarDivEl.classList.remove('active');
                //this.uploadProgresBarDivEl.classList.add('progress-bar-success');
            } else if (UploaderStatus.TRY_UPLOADING === upStatus) {
                this.uploadProgresBarDivEl.classList.remove('progress-bar-success');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-danger');
                this.uploadProgresBarDivEl.classList.add('progress-bar-warning');
                this.uploadProgresBarDivEl.classList.add('progress-bar-striped');
                //this.uploadProgresBarDivEl.classList.add('active');
            } else if (UploaderStatus.ERR === upStatus) {
                this.uploadProgresBarDivEl.classList.remove('progress-bar-success');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-warning');
                this.uploadProgresBarDivEl.classList.add('progress-bar-danger');
                this.uploadProgresBarDivEl.classList.remove('progress-bar-striped');
                //this.uploadProgresBarDivEl.classList.remove('active');
            }

            this.uploadProgresBarDivEl.style.width = percentUpl.toString() + '%';
            this.uploadProgresBarDivEl.innerText = "Upload " + ue.sizeDone + " of " + ue.sizeQueued + " bytes";
        }

    configure() {


      let hn: string = window.location.hostname;
      let pn: string = window.location.pathname;
      let pr: string = window.location.protocol;
      let po: string = window.location.port;
      let se: string = window.location.search;

      let qs: string = se.substring(1);

      this.sessionId = null;
      this.mode = Mode.SINGLE_SESSION;

      let ps = qs.split('&');
      for (var i = 0; i < ps.length; i++) {
        let kv: Array<string> = ps[i].split('=');
        let dkey: string = decodeURIComponent(kv[0]);
        let dval: string = decodeURIComponent(kv[1]);
        if (dkey == 'sessionId') {
          this.sessionId = dval;
        } else if (dkey == 'mode') {
          if (dval == 'single_session') {
            this.mode = Mode.SINGLE_SESSION;
          } else if (dval == 'demo') {
            this.mode = Mode.DEMO;
          }
        }
      }


      this.loadProjectCfg(() => {
        // display project name
        let prName: string = '[Unknown]';
        if (this.project && this.project.name) {
          prName = this.project.name;
        }
        this.titleEl.innerText = prName;
        this.loadSessionData(()=>{
          this.loadScript(()=>{
            let chCnt=2;
            if(this.project.audioFormat){
              chCnt=this.project.audioFormat.channels;
            }
            this.sm.channelCount=chCnt;
            this.sm.audioDevices=this.project.audioDevices;
            this.sm.start();
          })
        });
      });

    }

    loadSessionData(callback: ()=>any){
      let sessUrl: string = null;
      if (this.sessionId === null) {
        if (window.location.hostname === 'localhost' || this.mode === Mode.DEMO) {
          this.sm.mode = SessionMode.STAND_ALONE;
          // debug or demo mode
          sessUrl = 'test/test_session.json?' + new Date().getTime();
        } else {
          alert("No session ID !!");
          return;
        }
      } else {
        this.sm.mode = SessionMode.SERVER_BOUND;
        sessUrl =window.location.protocol + '//' +window.location.hostname + ':' + window.location.port + '/wikispeech/rest/sessions/' + this.sessionId;
      }
      var sLoader = new XMLHttpRequest();
      sLoader.open("GET", sessUrl, true);
      sLoader.setRequestHeader('Accept', 'application/json');
      sLoader.responseType = "json";
      sLoader.onload = (e) => {

        this.session = sLoader.response;
        this.sm.session = this.session;
        callback();
      }
      sLoader.onerror = (e) => {
        console.log("Error downloading session data ...");
      }
      sLoader.send();

    }

    loadProjectCfg(callback: ()=> any){
      let projUrl: string = null;

      if (this.sessionId === null) {
        if (window.location.hostname === 'localhost' || this.mode === Mode.DEMO) {
          // debug or demo mode
          projUrl = 'test/Demo1.json?' + new Date().getTime();
        }
      } else {
        // load RESTful by sessionId
        projUrl = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/wikispeech/rest/projects/?sessionId=' + this.sessionId;

      }
      var pLoader = new XMLHttpRequest();
      pLoader.open("GET", projUrl, true);
      pLoader.setRequestHeader('Accept', 'application/json');
      pLoader.responseType = "json";
      pLoader.onload = (e) => {

        this.project = pLoader.response.project;

        callback();
      }
      pLoader.onerror = (e) => {
        console.log("Error downloading project data ...");
      }
      pLoader.send();
    }




  loadScript(callback: ()=>any){
    var scrLoader = new XMLHttpRequest();
    let hn:string =window.location.hostname;
    let pn:string =window.location.pathname;
    let pr:string =window.location.protocol;
    let po:string =window.location.port;

    let sessionId:string=this.session.sessionId;

      let scrUrl:string = null;

      if (hn === 'localhost'  || this.mode===Mode.DEMO) {
          // local debug mode
          // FF caches
          scrUrl = 'test/' + this.session.script.toString() + '.json?' + new Date().getTime();

      } else {
          let scrPath:string = '/wikispeech/session/scripts/servlet';
          let scrQu:string = 'sessionId=' + sessionId;
          scrUrl = pr + '//' + hn + ':' + po + scrPath;
          if (scrQu) {
              scrUrl = scrUrl + '?' + scrQu;
          }
      }

    scrLoader.open("GET",scrUrl , true);
    scrLoader.setRequestHeader('Accept','application/json');
    scrLoader.responseType = "json";
    scrLoader.onload = (e) => {

      this.script = scrLoader.response;


      this.sm.script = this.script;

      callback();
    }
    scrLoader.onerror = (e) => {
      console.log("Error downloading recording script data ...");
    }
    scrLoader.send();
  }

    start(){

        this.configure();

    }

		update(e:AudioPlayerEvent){
			if(PlaybackEventType.STARTED===e.type){
				//this.startBtn.disabled=true;
				//this.stopBtn.disabled=true;
				this.statusMsg.innerHTML='Playback...';

            } else if (PlaybackEventType.ENDED === e.type) {
				//this.startBtn.disabled=false;
				//this.stopBtn.disabled=true;
				this.statusMsg.innerHTML='Ready.';
			}
		}
		error(){
			this.statusMsg.innerHTML='ERROR: Recording.';
		}
	}


//
//
// function speechrecorderInit() {
// 	var spr = new ips.apps.speeechrecorder.SpeechRecorder();
// 	spr.init();
//   spr.start();
//
//
// }
