import {Component, ViewChild, ChangeDetectorRef, AfterViewInit, OnInit} from '@angular/core'
import {
  AudioPlayerListener, AudioPlayerEvent, EventType as PlaybackEventType,
  AudioPlayer
} from './audio/playback/player';
import {Group, PromptItem, Script} from './speechrecorder/script/script'
import { SessionManager,Status as SessionManagerStatus} from './speechrecorder/session/sessionmanager';
import { UploaderStatusChangeEvent, UploaderStatus } from './net/uploader';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {SessionService} from "./speechrecorder/session/session.service";
import {ScriptService} from "./speechrecorder/script/script.service";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {Session} from "./speechrecorder/session/session";
import {AudioStorageType, Project, ProjectUtil} from "./speechrecorder/project/project";
import {ProjectService} from "./speechrecorder/project/project.service";
import {AudioContextProvider} from "./audio/context";
import {RecordingService} from "./speechrecorder/recordings/recordings.service";
import {RecordingFileDescriptorImpl} from "./speechrecorder/recording";
import {Arrays, DataSize} from "./utils/utils";
import {RecorderComponent} from "./recorder_component";
import {BasicRecorder} from "./speechrecorder/session/basicrecorder";
import {SprDb} from "./db/inddb";

export enum Mode {SINGLE_SESSION,DEMO}

@Component({

  selector: 'app-speechrecorder',
  providers: [SessionService],
  template: `
    <app-sprrecordingsession [projectName]="project?.name" [dataSaved]="dataSaved"></app-sprrecordingsession>
  `,
  styles: [`:host{
    flex: 2;
    display: flex;
    flex-direction: column;
    min-height:0;

  }`]

})
export class SpeechrecorderngComponent extends RecorderComponent implements OnInit,AfterViewInit,AudioPlayerListener {

  mode!:Mode;
  controlAudioPlayer:AudioPlayer|null=null;
  audio:any;
  _project:Project|null=null;
  sessionId!: string;
  session!:Session;
  script!:Script;

  @ViewChild(SessionManager, { static: true }) sm!:SessionManager;

		constructor(private route: ActivatedRoute,
                    private router: Router,
                private changeDetectorRef: ChangeDetectorRef,
                private sessionsService:SessionService,
                private projectService:ProjectService,
                private scriptService:ScriptService,
                private recFilesService:RecordingService,
                protected uploader:SpeechRecorderUploader) {
      super(uploader);
		}

    handleError(err:any){
      let errMsg='Unknown error';
      if(err instanceof Error){
        errMsg=err.message;
      }
      this.sm.statusMsg=errMsg;
      this.sm.statusAlertType='error';
      console.error(errMsg)
    }

  ngOnInit() {
          this.controlAudioPlayer = new AudioPlayer( this);
      this.sm.controlAudioPlayer=this.controlAudioPlayer;
      this.sm.statusAlertType='info';
      this.sm.statusMsg = 'Player initialized.';

  }
       ngAfterViewInit(){
        // let wakeLockSupp=('wakeLock' in navigator);
        // alert('Wake lock API supported: '+wakeLockSupp);
           if (this.sm.status !== SessionManagerStatus.ERROR) {
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

      let sessObs= this.sessionsService.sessionObserver(sessionId);

      if(sessObs) {
        sessObs.subscribe({
          next: sess => {
            this.setSession(sess);
            this.sm.statusAlertType = 'info';
            this.sm.statusMsg = 'Received session info.';
            this.sm.statusWaiting = false;
            if (sess.project) {
              //console.debug("Session associated project: "+sess.project)
              this.projectService.projectObservable(sess.project).subscribe({
                  next: (project) => {
                    this.project = project;

                    let persistentAudiStorage=(AudioStorageType.DB_CHUNKED===project.clientAudioStorageType);
                      super.prepare(persistentAudiStorage).subscribe({
                        complete: () => {
                          this.sm.persistentAudioStorageTarget = this._persistentAudioStorageTarget;
                          this.fetchScript(sess);
                        },
                        error: (err) => {
                          this.handleError(err);
                        }
                      });

                  }, error: (reason) => {
                    this.sm.statusMsg = reason;
                    this.sm.statusAlertType = 'error';
                    this.sm.statusWaiting = false;
                    console.error("Error fetching project config: " + reason)
                  }
                }
              );

            } else {
              console.info("Session has no associated project. Using default configuration.")
              this.fetchScript(sess);
            }
          },
          error:(reason) =>
          {
            this.sm.statusMsg = reason;
            this.sm.statusAlertType = 'error';
            this.sm.statusWaiting = false;
            console.error("Error fetching session " + reason)
          }
        });
      }
    }

  fetchScript(sess: Session) {
    if (sess.script) {
      this.sm.statusAlertType = 'info';
      this.sm.statusMsg = 'Fetching recording script...';
      this.sm.statusWaiting = true;
      this.scriptService.scriptObservable(sess.script).subscribe({
        next: (script) => {
          this.sm.statusAlertType = 'info';
          this.sm.statusMsg = 'Received recording script.';
          this.sm.statusWaiting = false;
          this.setScript(script)
          this.sm.session = sess;
          this.fetchRecordings(sess, this.script)
        }, error: (reason) => {
          let errMsg = "Error fetching recording script: " + reason
          console.error(errMsg)
          this.sm.statusMsg = errMsg;
          this.sm.statusAlertType = 'error';
          this.sm.statusWaiting = false;
        }
      });
    } else {
      let errMsg = "No recording script is defined for this session with ID " + sess.sessionId;
      console.error(this.sm.statusMsg)
      this.sm.statusMsg = errMsg;
      this.sm.statusAlertType = 'error';

    }
  }

  fetchRecordings(sess: Session, script: Script) {
    this.sm.statusAlertType = 'info';
    this.sm.statusMsg = 'Fetching infos of recordings...';
    this.sm.statusWaiting = true;
    let prNm: string | null = null;
    if (this.project) {
      let rfsObs = this.recFilesService.recordingFileDescrList(this.project.name, sess.sessionId);
      rfsObs.subscribe({
        next: (rfs: Array<RecordingFileDescriptorImpl>) => {
          this.sm.statusAlertType = 'info';
          this.sm.statusMsg = 'Received infos of recordings.';
          this.sm.statusWaiting = false;
          if (rfs) {
            if (rfs instanceof Array) {
              rfs.forEach((rf) => {

                //console.debug("Already recorded: " + rf+ " "+rf.recording.itemcode);
                this.sm.addRecordingFileByDescriptor(rf);
              })
            } else {
              console.error('Expected type array for list of already recorded files ')
            }
          } else {
            //console.debug("Recording file list: " + rfs);
          }
        }, error: (err) => {
          // we start the session anyway
          this.startSession()
        }, complete: () => {
          this.startSession()
        }
      })
    } else {
      // TODO
    }
  }

  get screenLocked():boolean{
      return  this.sm.screenLocked;
  }

    private startSession(){
        this.sm.statusWaiting=false;
		  this.sm.start();
    }


        setSession(session:any){
		    if(session) {
               // console.debug("Session ID: " + session.sessionId);
            }else{
                //console.debug("Session Undefined");
            }
        }

        ready():boolean{
		    return this.dataSaved && !this.sm.isActive()
        }

		init():boolean {
      //TODO Duplicate code in AudioRecorderComponent
        this.uploader.listener = (ue) => {
          this.uploadUpdate(ue);
        }
        window.addEventListener('beforeunload', (e) => {
          //console.debug("Before page unload event");

          if (this.ready()) {
            return;
          } else {
            // all this attempts to customize the message do not work anymore (for security reasons)!!
            const message = "Please do not leave the page, until all recordings are uploaded!";
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
    let sizeInQueue=ue.sizeInQueue();
    //console.debug("Uploader: status: "+upStatus+", "+percentUpl+"%, Bytes in queue: "+sizeInQueue+' ('+DataSize.formatBytesToBinaryUnits(sizeInQueue)+')');
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
    //console.debug("Upload update, update wake lock.")
    this.sm.updateWakeLock(this.dataSaved);
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

    private randomize(script:Script){
		    script.sections.forEach((s)=>{
		        if('RANDOM'===s.order) {
                    s._shuffledGroups = Arrays.shuffleArray<Group>(s.groups);
                }else{
		            s._shuffledGroups=s.groups;
                }
		        s._shuffledGroups.forEach((g)=>{
		            if('RANDOM'===g.order){
		               g._shuffledPromptItems=Arrays.shuffleArray<PromptItem>(g.promptItems);
                    }else{
		                g._shuffledPromptItems=g.promptItems;
                    }
                });
            });
    }

    setScript(script:Script){
        this.script=script;
        this.randomize(this.script);
        this.sm.script = this.script;
    }


  set project(project: Project|null) {
    this._project = project;
    let chCnt = ProjectUtil.DEFAULT_AUDIO_CHANNEL_COUNT;

    if (project) {
      console.info("Project name: " + project.name)
      if(project.recordingDeviceWakeLock===true){
        this.sm.wakeLock=true;
      }
      console.info("Audio storage type: "+project.clientAudioStorageType);
      if(AudioStorageType.DB_CHUNKED===project.clientAudioStorageType){
        SprDb.prepare().subscribe()
      }
      if(project.clientAudioStorageType) {
        this.sm.clientAudioStorageType = project.clientAudioStorageType;
      }

      this.sm.audioDevices = project.audioDevices;
      chCnt = ProjectUtil.audioChannelCount(project);
      console.info("Project requested recording channel count: " + chCnt);
      this.sm.autoGainControlConfigs=project.autoGainControlConfigs;
      if(project.chunkedRecording===true){
        console.debug("Enable chunked upload: chunkSize: "+BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS)
        this.sm.uploadChunkSizeSeconds=BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;
      }else{
        this.sm.uploadChunkSizeSeconds=null;
      }
      if(project.showSessionCompleteMessage!=null){
        this.sm.showSessionCompleteMessage=project.showSessionCompleteMessage;
      }
    } else {
      console.error("Empty project configuration!")
    }
    this.sm.channelCount = chCnt;

  }

  get project():Project|null{
		  return this._project;
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
        const pLoader = new XMLHttpRequest();
        pLoader.open("GET", projUrl, true);
        pLoader.setRequestHeader('Accept', 'application/json');
        pLoader.responseType = "json";
        pLoader.onload = (e) => {

          this.project = pLoader.response.project;

          callback();
        }
        pLoader.onerror = (e) => {
          console.error("Error downloading project data ...");
        }
        pLoader.send();
      }
    }

    start(){
    }

  audioPlayerUpdate(e:AudioPlayerEvent){
    if(PlaybackEventType.STARTED===e.type){
      this.sm.statusAlertType='info';
      this.sm.statusMsg='Playback...';
    } else if (PlaybackEventType.ENDED === e.type) {
      this.sm.statusAlertType='info';
      this.sm.statusMsg='Ready.';
    }else if(PlaybackEventType.ERROR=== e.type){
      this.sm.statusAlertType='error';
      this.sm.statusMsg='Playback error.';
    }
  }
		error(){
		    this.sm.statusAlertType='error';
			this.sm.statusMsg='ERROR: Recording.';
		}
	}
