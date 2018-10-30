import {Component, ViewChild, ChangeDetectorRef, AfterViewInit, OnInit} from '@angular/core'
import {
  AudioPlayerListener, AudioPlayerEvent, EventType as PlaybackEventType,
  AudioPlayer
} from './audio/playback/player';
import { Script } from './speechrecorder/script/script'
import { SessionManager,Status as SessionManagerStatus} from './speechrecorder/session/sessionmanager';
import { UploaderStatusChangeEvent, UploaderStatus } from './net/uploader';
import {ActivatedRoute, Params, Router} from "@angular/router";
import 'rxjs/add/operator/switchMap';
import {SessionService} from "./speechrecorder/session/session.service";
import {ScriptService} from "./speechrecorder/script/script.service";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {Session} from "./speechrecorder/session/session";
import {Project} from "./speechrecorder/project/project";
import {ProjectService} from "./speechrecorder/project/project.service";
import {AudioContextProvider} from "./audio/context";

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
export class SpeechrecorderngComponent implements OnInit,AfterViewInit,AudioPlayerListener {

	  mode:Mode;
		controlAudioPlayer:AudioPlayer;
		audio:any;

  sessionId: string;
  session:Session;

  script:Script;
    dataSaved: boolean = true;
  @ViewChild(SessionManager) sm:SessionManager;
    //statusDisplay:StatusDisplay;


    currentPromptIdx:number;

		constructor(private route: ActivatedRoute,
                    private router: Router,
                private changeDetectorRef: ChangeDetectorRef,
                private sessionsService:SessionService,
                private projectService:ProjectService,
                private scriptService:ScriptService,
                private uploader:SpeechRecorderUploader) {
		}

    ngOnInit() {
      let audioSystem=AudioContextProvider.audioSystem();
      if (!audioSystem || !audioSystem.audioContext) {
        let reason = 'ERROR: Browser does not support Web Audio API!';
        this.sm.statusMsg=reason;
        this.sm.statusAlertType='error';
        console.log("Error fetching project config: "+reason)
      } else {

        this.controlAudioPlayer = new AudioPlayer(audioSystem.audioContext, this);
        this.sm.controlAudioPlayer=this.controlAudioPlayer;
        this.sm.statusAlertType='info';
        this.sm.statusMsg = 'Player initialized.';
      }
    }
       ngAfterViewInit(){

		  if(this.sm.status!== SessionManagerStatus.ERROR) {
        let initSuccess = this.init();
        if (initSuccess) {
          this.route.queryParams.subscribe((params: Params) => {
            if (params['sessionId']) {
              this.fetchSession(params['sessionId']);
            }
          });

          this.route.params.subscribe((params: Params) => {
            let routeParamsId = params['id'];
            if (routeParamsId) {
              this.fetchSession(routeParamsId);
            }
          })
        }
      }
    }

    fetchSession(sessionId:string){
      let sess= this.sessionsService.getSession(sessionId);

      if(sess) {
        sess.then(sess => {
          this.setSession(sess);


          if (sess.project) {
            console.log("Session associated project: "+sess.project)
            this.projectService.getProject(sess.project).then(project=>{
              this.project=project;
              this.fetchScript(sess);
            }).catch(reason =>{
              this.sm.statusMsg=reason;
              this.sm.statusAlertType='error';
              console.log("Error fetching project config: "+reason)
            });

          } else {
            console.log("Session has no associated project. Using default configuration.")
            this.fetchScript(sess);
          }
        })
          .catch(reason => {
            this.sm.statusMsg = reason;
            this.sm.statusAlertType = 'error';
            console.log("Error fetching session " + reason)
          });
      }
    }


    fetchScript(sess:Session){
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
          });
      }
    }


    fetchRecordings(sess:Session,script:Script){

    }


        setSession(session:any){
		    if(session) {
                console.log("Session ID: " + session.sessionId);


            }else{
                console.log("Session Undefined");
            }

        }

		init():boolean {

			var n = <any>navigator;
			//var getUserMediaFnct= n.getUserMedia || n.webkitGetUserMedia ||
			//	n.mozGetUserMedia || n.msGetUserMedia;
			var w = <any>window;
			// TODO test onyl !!

      // let debugFail=true;
		// 	AudioContext = w.AudioContext || w.webkitAudioContext;
		// 	if (typeof AudioContext !== 'function' || debugFail) {
      //           this.sm.statusAlertType='error';
		// 		this.sm.statusMsg = 'ERROR: Browser does not support Web Audio API!';
		// 		return false;
		// 	} else {
		// 		var context = new AudioContext();
      //
		// 		if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
      //               this.sm.statusAlertType='error';
		// 			this.sm.statusMsg= 'ERROR: Browser does not support Media streams!';
      //     return false;
		// 		} else {
      //

                    //this.sm = new SessionManager(new SimpleTrafficLight(), this.uploader);
					//this.sm.init();
					//this.ap = new AudioPlayer(context,this);
					//this.sm.listener=this;
			//	}
		//	}
            this.uploader.listener = (ue) => {
                this.uploadUpdate(ue);
            }

            window.addEventListener('beforeunload', (e) => {
                console.log("Before page unload event");

                if (this.dataSaved && !this.sm.isActive()) {
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
			return true;
        }

  uploadUpdate(ue: UploaderStatusChangeEvent) {
    let upStatus = ue.status;
    this.dataSaved = (UploaderStatus.DONE === upStatus);
    let percentUpl = ue.percentDone();
    if (UploaderStatus.ERR === upStatus) {
      this.sm.uploadStatus = 'warn'
    } else {
      if (percentUpl < 50) {
        this.sm.uploadStatus = 'accent'
      } else {
        this.sm.uploadStatus = 'success'
      }
      this.sm.uploadProgress = percentUpl;
    }

    this.changeDetectorRef.detectChanges()
  }

  configure() {



      this.loadProjectCfg(() => {
        // display project name
        let prName: string = '[Unknown]';
        if (this.project && this.project.name) {
          prName = this.project.name;
        }
        //this.titleEl.innerText = prName;

      });

    }


    setScript(script:Script){
        this.script=script;
        this.sm.script = this.script;

    }


  set project(project: Project) {

    let chCnt = 2;

    if (project) {
      console.log("Project name: "+project.name)
      this.sm.audioDevices = project.audioDevices;
      if(project.audioFormat) {
        chCnt =project.audioFormat.channels;
        console.log("Project requested recording channel count: "+chCnt)
      }
    }else{
      console.error("Empty project configuration!")
    }
    this.sm.channelCount = chCnt;

  }




    loadProjectCfg(callback: ()=> any){
      let projUrl: string | null = null;

      if (this.sessionId === null) {
        if (window.location.hostname === 'localhost' || this.mode === Mode.DEMO) {
          // debug or demo mode
          projUrl = 'test/Demo1.json?' + new Date().getTime();
        }
      } else {
        // load RESTful by sessionId
        projUrl = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/wikispeech/rest/projects/?sessionId=' + this.sessionId;

      }
      if(projUrl) {
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
    }




  // loadScript(callback: ()=>any){
  //   var scrLoader = new XMLHttpRequest();
  //   let hn:string =window.location.hostname;
  //   let pn:string =window.location.pathname;
  //   let pr:string =window.location.protocol;
  //   let po:string =window.location.port;
  //
  //   let sessionId:string=this.session.sessionId;
  //
  //     let scrUrl:string | null = null;
  //
  //     if (hn === 'localhost'  || this.mode===Mode.DEMO) {
  //         // local debug mode
  //         // FF caches
  //         scrUrl = 'test/' + this.session.script.toString() + '.json?' + new Date().getTime();
  //
  //     } else {
  //         let scrPath:string = '/wikispeech/session/scripts/servlet';
  //         let scrQu:string = 'sessionId=' + sessionId;
  //         scrUrl = pr + '//' + hn + ':' + po + scrPath;
  //         if (scrQu) {
  //             scrUrl = scrUrl + '?' + scrQu;
  //         }
  //     }
  //
  //   scrLoader.open("GET",scrUrl , true);
  //   scrLoader.setRequestHeader('Accept','application/json');
  //   scrLoader.responseType = "json";
  //   scrLoader.onload = (e) => {
  //
  //     this.script = scrLoader.response;
  //
  //
  //     this.sm.script = this.script;
  //
  //     callback();
  //   }
  //   scrLoader.onerror = (e) => {
  //     console.log("Error downloading recording script data ...");
  //   }
  //   scrLoader.send();
  // }

    start(){

        //this.configure();

    }

		audioPlayerUpdate(e:AudioPlayerEvent){
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
