import {TransportActions} from "./controlpanel";
import {Browser, UserAgent, UserAgentBuilder} from "../../utils/ua-parser";
import {MatDialog} from "@angular/material/dialog";
import {MessageDialog} from "../../ui/message_dialog";
import {Session} from "./session";
import {SessionService} from "./session.service";
import {AudioCapture} from "../../audio/capture/capture";
import {AudioDevice, AutoGainControlConfig} from "../project/project";
import {LevelInfos, LevelMeasure, StreamLevelMeasure} from "../../audio/dsp/level_measure";
import {AudioPlayer} from "../../audio/playback/player";
import {Subscription} from "rxjs";
import {AudioClip} from "../../audio/persistor";
import {Action} from "../../action/action";
import {MIN_DB_LEVEL} from "../../ui/recordingitem_display";

export const FORCE_REQUEST_AUDIO_PERMISSIONS=false;
export const RECFILE_API_CTX = 'recfile';
export const MAX_RECORDING_TIME_MS = 1000 * 60 * 60 * 60; // 1 hour

export const LEVEL_BAR_INTERVALL_SECONDS = 0.1;  // 100ms

export class BasicRecorder {
  protected userAgent:UserAgent;
  statusMsg: string='';
  statusAlertType!: string;
  statusWaiting: boolean=false;
  readonly=false;
  processingRecording=false;
  ac: AudioCapture|null=null;
  // Property audioDevices from project config: list of names of allowed audio devices.
  protected _audioDevices: Array<AudioDevice> | null| undefined;
  protected _selectedDeviceId:string|undefined=undefined;
  protected selCaptureDeviceId: ConstrainDOMString | null;
  protected _channelCount = 2;
  protected _autoGainControlConfigs: Array<AutoGainControlConfig> | null| undefined;

  _session: Session|null=null;

  transportActions: TransportActions;
  playStartAction: Action<void>;

  uploadProgress: number = 100;
  uploadStatus: string = 'ok'
  audioSignalCollapsed = true;

  protected streamLevelMeasure: StreamLevelMeasure;
  protected levelMeasure: LevelMeasure;
  peakLevelInDb:number=MIN_DB_LEVEL;
  displayLevelInfos: LevelInfos | null=null;
  protected _controlAudioPlayer!: AudioPlayer;
  displayAudioClip: AudioClip | null=null;
  protected audioFetchSubscription:Subscription|null=null;

  protected destroyed=false;

  protected navigationDisabled=true;

  constructor(  public dialog: MatDialog,protected sessionService:SessionService) {
    this.userAgent=UserAgentBuilder.userAgent();
    console.debug("Detected platform: "+this.userAgent.detectedPlatform);
    console.debug("Detected browser: "+this.userAgent.detectedBrowser);
    this.transportActions = new TransportActions();
    this.playStartAction = new Action('Play');
    this.levelMeasure = new LevelMeasure();
    this.streamLevelMeasure = new StreamLevelMeasure();
    this.selCaptureDeviceId = null;
  }

  set audioDevices(audioDevices: Array<AudioDevice> | null | undefined) {
    this._audioDevices = audioDevices;
  }

  set autoGainControlConfigs(autoGainControlConfigs: Array<AutoGainControlConfig>|null|undefined){
    this._autoGainControlConfigs=autoGainControlConfigs;
  }

  set channelCount(channelCount: number) {
    this._channelCount = channelCount;
  }

  set session(session: Session|null) {
    this._session = session;
  }

  get session():Session|null{
    return this._session;
  }

  enableStartUserGesture() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Ready.';
  }

  start() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Starting session...';
    this.statusWaiting=false;
    if(this._session) {
      if (this._session.sealed) {
        this.readonly = true
        this.statusMsg = 'Session sealed!';
        //let dialogRef = this.dialog.open(SessionSealedDialog, {});
        this.dialog.open(MessageDialog, {
          data: {
            type: 'error',
            title: 'Error',
            msg: "This session is sealed. Recordings cannot be added anymore.",
            advise: 'Please ask your experimenter what to do (e.g start a new session).',
          }
        });
      } else {
        let body: any = {};
        if (this._session.status === "CREATED") {
          this._session.status = "LOADED";
          body.status = this._session.status;
          if (!this._session.loadedDate) {
            this._session.loadedDate = new Date();
            body.loadedDate = this._session.loadedDate;
          }
        } else {
          this._session.restartedDate = new Date();
          body.restartedDate = this._session.restartedDate;
        }
        this.sessionService.patchSessionObserver(this._session, body).subscribe()
      }
    }

    // Check browser compatibility
    if(this.userAgent.detectedBrowser===Browser.Safari && this._channelCount>1){
      let eMsg="Error: Safari browser does not support stereo recordings.";
      console.error(eMsg);
      this.dialog.open(MessageDialog, {
        data: {
          type: 'error',
          title: 'Browser not supported',
          msg: eMsg,
          advice: "Please use a supported browser, e.g. Mozilla Firefox."
        }
      })
    }

    //console.log("Session ID: "+this._session.session+ " status: "+this._session.status)
    this._selectedDeviceId=undefined;

    if (!this.readonly && this.ac && (FORCE_REQUEST_AUDIO_PERMISSIONS || (this._audioDevices && this._audioDevices.length > 0))) {
      this.statusMsg = 'Requesting audio permissions...';
      this.statusAlertType = 'info';

      this.ac.deviceInfos((mdis) => {
        let audioCaptureDeviceAvail: boolean = false;
        let audioPlayDeviceAvail: boolean = false;
        if (mdis) {
          if(this.ac) {
            this.ac.printDevices(mdis);
          }
          if (mdis.length > 0) {
            for (let mdii = 0; mdii < mdis.length; mdii++) {
              let mdi = mdis[mdii];
              let kind=mdi.kind;
              if(kind === "audioinput"){
                audioCaptureDeviceAvail=true;
              }else if(kind=== "audiooutput"){
                audioPlayDeviceAvail=true;
              }
            }
          }

          if (this._session && this._session.type !== 'TEST_DEF_A' && this._audioDevices && this._audioDevices.length > 0) {
            let fdi: MediaDeviceInfo | null = null;
            for (let adI = 0; adI < this._audioDevices.length; adI++) {
              let ad = this._audioDevices[adI];
              if (ad.playback) {
                // project audio device config for playback device
                // not used for now
                continue;
              }
              for (let mdii = 0; mdii < mdis.length; mdii++) {
                let mdi = mdis[mdii];
                let kind=mdi.kind;
                if(kind === "audioinput"){
                  audioCaptureDeviceAvail=true;
                }else if(kind=== "audiooutput"){
                  audioPlayDeviceAvail=true;
                }
                if (ad.regex) {
                  //console.log("Match?: \'"+mdi.label+"\' \'"+ad.name+"\'");
                  if (mdi.label.match(ad.name)) {
                    fdi = mdi;
                    //console.log("Match!");
                  }
                } else {
                  if (mdi.label.trim() === ad.name.trim()) {
                    fdi = mdi;
                  }
                }
                if (fdi) {
                  break;
                }
              }
              if (fdi) {
                break;
              }
            }

            if (fdi) {
              // matching device found

              // Not able to open device here since Chrome 71
              // Chrome 71 requires a user gesture before the AudioContext can be resumed
              // sessionmanager.ts:712 Open session with default audio device for 1 channels
              // capture.ts:128 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu
              // push../projects/speechrecorderng/src/lib/audio/capture/capture.ts.AudioCapture.open @ capture.ts:128

              //this.ac.open(this._channelCount, fdi.deviceId);
              console.info("Set selected audio device: \'" + fdi.label + "\' Id: \'" + fdi.deviceId + "\'");
              this._selectedDeviceId = fdi.deviceId;

              this.enableStartUserGesture()
            } else {
              // device not found
              this.statusMsg = 'ERROR: Required audio device not available!';
              this.statusAlertType = 'error';
              this.readonly = true;

              this.dialog.open(MessageDialog, {
                data: {
                  type: 'error',
                  title: 'Required audio device',
                  msg: "Required audio device not found",
                  advice: "Please connect a suitable audio device for this project and retry (press the browser reload button)."
                }
              })
            }
          }else{
            if(!audioCaptureDeviceAvail && !audioPlayDeviceAvail){
              // no device found
              this.statusMsg = 'ERROR: No audio device available!';
              this.statusAlertType = 'warn';
              //this.readonly = true;

              this.dialog.open(MessageDialog, {
                data: {
                  type: 'warn',
                  title: 'No audio device',
                  msg: "No audio device found",
                  advice: "Please connect an audio device and retry (press the browser reload button) or try to continue anyway."
                }
              })
            }else {
              if (!this.readonly && !audioCaptureDeviceAvail) {
                // no device found
                this.statusMsg = 'WARNING: No audio capture device available!';
                this.statusAlertType = 'warning';
                //this.readonly = true;

                this.dialog.open(MessageDialog, {
                  data: {
                    type: 'warning',
                    title: 'No audio capture device',
                    msg: "No audio capture device found",
                    advice: "Please connect an audio capture device and retry (press the browser reload button) or try to continue anyway."
                  }
                })
              }
              // Safari does not list playback devices
              if (!audioPlayDeviceAvail) {
                // Firefox does not enumerate audiooutput devices
                // Do not show this warning, because it would always appear on Firefox
                // When https://bugzilla.mozilla.org/show_bug.cgi?id=1498512 is fixed the warning can be enabled for Firefox as well

                // It is already implemneted but kept behind a preference setting https://bugzilla.mozilla.org/show_bug.cgi?id=1152401


                // Output devices are listed if about:config media.setsinkid.enabled=true
                // but default setting is false


                // Same problem with Safari

                if (!(this.userAgent.detectedBrowser===Browser.Safari || this.userAgent.detectedBrowser===Browser.Firefox)) {
                  // no device found
                  this.statusMsg = 'WARNING: No audio playback device available!';
                  this.statusAlertType = 'warn';
                  //this.readonly = true;

                  this.dialog.open(MessageDialog, {
                    data: {
                      type: 'warn',
                      title: 'No audio playback device',
                      msg: "No audio playback device found",
                      advice: "Please connect an audio playback device and retry (press the browser reload button) or try to continue anyway."
                    }
                  })
                }
              }
            }

            // Not able to open device here since Chrome 71
            // Chrome 71 requires a user gesture before the AudioContext can be resumed
            // sessionmanager.ts:712 Open session with default audio device for 1 channels
            // capture.ts:128 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu
            // push../projects/speechrecorderng/src/lib/audio/capture/capture.ts.AudioCapture.open @ capture.ts:128
            //console.log("Open session with default audio device for "+this._channelCount+" channels");
            //this.ac.open(this._channelCount);

            // enable start gesture anyway
            this.enableStartUserGesture()
          }
        }

      });
    }
  }

  closed() {
    this.statusAlertType = 'info';
    this.statusMsg = 'Session closed.';
  }

  error(msg='An unknown error occured during recording.',advice:string='Please retry.') {
    this.statusMsg = 'ERROR: Recording.';
    this.statusAlertType = 'error';
    this.dialog.open(MessageDialog, {
      data: {
        type: 'error',
        title: 'Recording error',
        msg: msg,
        advice: advice
      }
    });
  }

}