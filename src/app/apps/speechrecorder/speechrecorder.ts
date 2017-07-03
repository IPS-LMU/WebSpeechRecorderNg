import {Component, ViewChild, ViewChildDecorator} from '@angular/core'

import {ControlPanel, Mode as SessionMode, Prompting, StatusDisplay} from './session/sessionmanager';
	import {AudioCaptureListener} from '../../audio/capture/capture';
	import {AudioPlayer,AudioPlayerListener,AudioPlayerEvent, EventType as PlaybackEventType } from '../../audio/playback/player';
  import {AudioSignal } from '../../audio/ui/audiosignal';

	import { AudioClipUIContainer } from '../../audio/ui/container';
	import { SimpleTrafficLight } from './startstopsignal/ui/simpletrafficlight'
  import { Script } from './script/script'
  import { SessionManager} from  './session/sessionmanager';
  import { Uploader, UploaderStatusChangeEvent, UploaderStatus } from '../../net/uploader';
import {ActivatedRoute, Params, Router} from "@angular/router";
import 'rxjs/add/operator/switchMap';
import {SessionService} from "./session/session.service";
import {ScriptService} from "./script/script.service";
import {Progress} from "./session/progress";

  export enum Mode {SINGLE_SESSION,DEMO}


@Component({

  selector: 'app-speechrecorder',
  providers: [SessionService],
  template: `
    <app-sprrecordingsession></app-sprrecordingsession>
  `,
  styles: [`:host{
    flex: 2;
    display: flex;
    flex-direction: column;
    min-height:0;      

  }`]

})
export class SpeechRecorder implements AudioPlayerListener {

	  mode:Mode;

		ap:AudioPlayer;
        uploader: Uploader;
		//audioSignal:AudioClipUIContainer;
        uploadProgresBarDivEl: HTMLDivElement;

		//statusMsg:string;
		titleEl:HTMLElement;
		audio:any;

        project: any;
    sessionId: string;
    session:any;
    script:Script;
        dataSaved: boolean = true;
  @ViewChild(SessionManager) sm:SessionManager;
    //statusDisplay:StatusDisplay;


    currentPromptIdx:number;

		constructor(private route: ActivatedRoute,
                    private router: Router,private sessionsService:SessionService,private scriptService:ScriptService) {
			this.audio = document.getElementById('audio');
			var asc = <HTMLDivElement>document.getElementById('audioSignalContainer');
            this.uploadProgresBarDivEl = <HTMLDivElement>(document.getElementById('uploadProgressBar'));
			  //this.statusMsg = 'Initialize...';
            this.titleEl = <HTMLElement>(document.getElementById('title'));
            this.uploader = new Uploader();

            // let ops=this.route.params.switchMap(params: Params) => this.setSessionId(+params['id']))
            //     .subscribe((hero: Hero) => this.hero = hero);
		}

    ngOnInit() {
		    //
    }
       ngAfterViewInit(){

        this.route.params.subscribe((params:Params)=>{

            let sess= this.sessionsService.getSession(params['id']).then(sess=> {
              this.setSession(sess);
              this.init();
              if(sess.project){
                //TODO fetch project then fetchScript
                this.fetchScript(sess);
              }else{
                this.fetchScript(sess);
              }
            })
            .catch(reason =>{
                this.sm.statusMsg=reason;
                this.sm.statusAlertType='error';
                console.log("Error fetching session "+reason)
            });
        })
    }


    fetchScript(sess:any){
      if(sess.script){
        this.scriptService.getScript(sess.script).then(script=>{
          this.setScript(script)
          this.sm.session=sess;
          this.sm.start();
        })
          .catch(reason =>{
            this.sm.statusMsg=reason;
            this.sm.statusAlertType='error';
            console.log("Error fetching script: "+reason)
          });;
      }
    }


        setSession(session:any){
		    if(session) {
                console.log("Session ID: " + session.sessionId);


            }else{
                console.log("Session Undefined");
            }

        }

		init() {

			var n = <any>navigator;
			//var getUserMediaFnct= n.getUserMedia || n.webkitGetUserMedia ||
			//	n.mozGetUserMedia || n.msGetUserMedia;
			var w = <any>window;

			AudioContext = w.AudioContext || w.webkitAudioContext;
			if (typeof AudioContext !== 'function') {
                this.sm.statusAlertType='error';
				this.sm.statusMsg = 'ERROR: Browser does not support Web Audio API!';
			} else {
				var context = new AudioContext();

				if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
                    this.sm.statusAlertType='error';
					this.sm.statusMsg= 'ERROR: Browser does not support Media streams!';
				} else {


                    //this.sm = new SessionManager(new SimpleTrafficLight(), this.uploader);
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



      this.loadProjectCfg(() => {
        // display project name
        let prName: string = '[Unknown]';
        if (this.project && this.project.name) {
          prName = this.project.name;
        }
        this.titleEl.innerText = prName;

      });

    }


    setScript(script:any){
        this.script=script;
        this.sm.script = this.script;

    }


  setProject(project: any) {
    let chCnt = 2;

    if (this.project.audioFormat) {
      chCnt = this.project.audioFormat.channels;
    }
    this.sm.channelCount = chCnt;
    this.sm.audioDevices = this.project.audioDevices;
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

        //this.configure();

    }

		update(e:AudioPlayerEvent){
			if(PlaybackEventType.STARTED===e.type){
				//this.startBtn.disabled=true;
				//this.stopBtn.disabled=true;
                this.sm.statusAlertType='info';
				this.sm.statusMsg='Playback...';

            } else if (PlaybackEventType.ENDED === e.type) {
				//this.startBtn.disabled=false;
				//this.stopBtn.disabled=true;
                this.sm.statusAlertType='info';
				this.sm.statusMsg='Ready.';
			}
		}
		error(){
		    this.sm.statusAlertType='error';
			this.sm.statusMsg='ERROR: Recording.';
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
