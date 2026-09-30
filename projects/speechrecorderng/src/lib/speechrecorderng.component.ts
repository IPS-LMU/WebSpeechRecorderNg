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
import {ScriptPrefillService} from "./speechrecorder/script/prefill.service";
import {PrefillChoices} from "./speechrecorder/script/prefill";
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
import {SprLogger} from "./utils/logger";
import {SprTranslator} from "./i18n/translate";

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

  }`],
    standalone: false
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
                private prefillService:ScriptPrefillService,
                private recFilesService:RecordingService,
                protected uploader:SpeechRecorderUploader,
                private i18n: SprTranslator) {
      super(uploader);
		}

    handleError(err:any){
      let errMsg=this.i18n.t('spr.error.unknown');
      if(err instanceof Error){
        errMsg=err.message;
      }
      this.sm.statusMsg=errMsg;
      this.sm.statusAlertType='error';
      SprLogger.error(errMsg)
    }

  ngOnInit() {
          this.controlAudioPlayer = new AudioPlayer( this, this.i18n);
      this.sm.controlAudioPlayer=this.controlAudioPlayer;
      this.sm.statusAlertType='info';
      this.sm.statusMsg = this.i18n.t('spr.status.playerInitialized');

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
            this.sm.statusMsg = this.i18n.t('spr.status.sessionInfo');
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
                    SprLogger.error("Error fetching project config: " + reason)
                  }
                }
              );

            } else {
              SprLogger.info("Session has no associated project. Using default configuration.")
              this.fetchScript(sess);
            }
          },
          error:(reason) =>
          {
            this.sm.statusMsg = reason;
            this.sm.statusAlertType = 'error';
            this.sm.statusWaiting = false;
            SprLogger.error("Error fetching session " + reason)
          }
        });
      }
    }

  fetchScript(sess: Session) {
    if (sess.script) {
      this.sm.statusAlertType = 'info';
      this.sm.statusMsg = this.i18n.t('spr.status.fetchingScript');
      this.sm.statusWaiting = true;
      this.scriptService.scriptObservable(sess.script).subscribe({
        next: (script) => {
          this.sm.statusAlertType = 'info';
          this.sm.statusMsg = this.i18n.t('spr.status.scriptReceived');
          this.sm.statusWaiting = false;
          this.prefillService.resolve(script, sess).subscribe({
            next: (resolved) => {
              this.storePrefillChoices(sess, resolved.choices);
              this.setScript(resolved.script)
              this.sm.session = sess;
              this.fetchRecordings(sess, this.script)
            },
            error: (reason) => {
              const errMsg = this.i18n.t('spr.status.scriptPrefillError', {value: reason})
              SprLogger.error(errMsg)
              this.sm.statusMsg = errMsg;
              this.sm.statusAlertType = 'error';
            }
          });
        }, error: (reason) => {
          let errMsg = this.i18n.t('spr.status.scriptFetchError', {value: reason})
          SprLogger.error(errMsg)
          this.sm.statusMsg = errMsg;
          this.sm.statusAlertType = 'error';
          this.sm.statusWaiting = false;
        }
      });
    } else {
      let errMsg = this.i18n.t('spr.status.noScript', {value: sess.sessionId});
      SprLogger.error(this.sm.statusMsg)
      this.sm.statusMsg = errMsg;
      this.sm.statusAlertType = 'error';

    }
  }

  /**
   * Keeps the drawn lists on the session record: the local object (exported with the session and
   * handed to the session manager) and, via PATCH, the stored session. The stored choices make a
   * reload reproduce the same generated items, and trace the drawn lists back afterwards.
   */
  private storePrefillChoices(sess: Session, choices: PrefillChoices) {
    if (Object.keys(choices).length === 0) {
      return;
    }
    const known = sess.prefills ?? {};
    sess.prefills = {...known, ...choices};
    const unchanged = Object.keys(choices).every((itemcode) =>
      known[itemcode] !== undefined &&
      known[itemcode].source === choices[itemcode].source &&
      known[itemcode].list === choices[itemcode].list);
    if (unchanged) {
      return;
    }
    this.sessionsService.patchSessionObserver(sess, {prefills: sess.prefills}).subscribe({
      error: (err) => {
        SprLogger.warn('Could not store the drawn script lists on the session: ' + err);
      }
    });
  }

  fetchRecordings(sess: Session, script: Script) {
    this.sm.statusAlertType = 'info';
    this.sm.statusMsg = this.i18n.t('spr.status.fetchingRecordings');
    this.sm.statusWaiting = true;
    let prNm: string | null = null;
    if (this.project) {
      let rfsObs = this.recFilesService.recordingFileDescrList(this.project.name, sess.sessionId);
      rfsObs.subscribe({
        next: (rfs: Array<RecordingFileDescriptorImpl>) => {
          this.sm.statusAlertType = 'info';
          this.sm.statusMsg = this.i18n.t('spr.status.recordingsReceived');
          this.sm.statusWaiting = false;
          if (rfs) {
            if (rfs instanceof Array) {
              rfs.forEach((rf) => {

                //console.debug("Already recorded: " + rf+ " "+rf.recording.itemcode);
                this.sm.addRecordingFileByDescriptor(rf);
              })
            } else {
              SprLogger.error('Expected type array for list of already recorded files ')
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
    this.uploader.restorePersistedUploads().subscribe({
      next: (restored: number) => {
        if (restored > 0) {
          SprLogger.info('Restored ' + restored + ' persisted uploads.');
        }
      },
      error: (err: unknown) => {
        SprLogger.error('Could not restore persisted uploads: ' + err);
      }
    });
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
      this.sm.uploadStatusMsg = ue.lastError ? this.i18n.t('spr.status.uploadErrorDetail', {value: ue.lastError.message}) : null;
    } else if (UploaderStatus.PARTIAL === upStatus) {
      this.sm.uploadStatus = 'warn'
      this.sm.uploadStatusMsg = ue.lastError ? this.i18n.t('spr.status.uploadFailed', {value: ue.lastError.message}) : this.i18n.t('spr.status.uploadPartial');
    } else {
      this.sm.uploadStatusMsg = null;
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
      SprLogger.info("Project name: " + project.name)
      if(project.recordingDeviceWakeLock===true){
        this.sm.wakeLock=true;
      }
      SprLogger.info("Audio storage type: "+project.clientAudioStorageType);
      if(AudioStorageType.DB_CHUNKED===project.clientAudioStorageType){
        SprDb.prepare().subscribe()
      }
      if(project.clientAudioStorageType) {
        this.sm.clientAudioStorageType = project.clientAudioStorageType;
      }
      this.sm.clientMediaStorageFormat=project.mediaStorageFormat;

      this.sm.audioDevices = project.audioDevices;
      chCnt = ProjectUtil.audioChannelCount(project);
      SprLogger.info("Project requested recording channel count: " + chCnt);
      this.sm.autoGainControlConfigs=project.autoGainControlConfigs;
      if(project.allowEchoCancellation!==undefined) {
        this.sm.allowEchoCancellation = project.allowEchoCancellation;
      }
      if(project.chunkedRecording===true){
        SprLogger.debug("Enable chunked upload: chunkSize: "+BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS)
        this.sm.uploadChunkSizeSeconds=BasicRecorder.DEFAULT_CHUNK_SIZE_SECONDS;
      }else{
        this.sm.uploadChunkSizeSeconds=null;
      }
      if(project.showSessionCompleteMessage!=null){
        this.sm.showSessionCompleteMessage=project.showSessionCompleteMessage;
      }
    } else {
      SprLogger.error("Empty project configuration!")
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
          SprLogger.error("Error downloading project data ...");
        }
        pLoader.send();
      }
    }

    start(){
    }

  audioPlayerUpdate(e:AudioPlayerEvent){
    if(PlaybackEventType.STARTED===e.type){
      this.sm.statusAlertType='info';
      this.sm.statusMsg=this.i18n.t('spr.status.playback');
    } else if (PlaybackEventType.ENDED === e.type) {
      this.sm.statusAlertType='info';
      this.sm.statusMsg=this.i18n.t('spr.status.ready');
    }else if(PlaybackEventType.ERROR=== e.type){
      this.sm.statusAlertType='error';
      this.sm.statusMsg=this.i18n.t('spr.status.playbackError');
    }
  }
		error(){
		    this.sm.statusAlertType='error';
			this.sm.statusMsg=this.i18n.t('spr.status.recordingError');
		}
	}
