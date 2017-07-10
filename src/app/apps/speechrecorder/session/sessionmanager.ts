import { Action } from '../../../action/action'

    import { AudioCapture,AudioCaptureListener } from '../../../audio/capture/capture';
    import { AudioPlayer,AudioPlayerListener,AudioPlayerEvent,EventType } from '../../../audio/playback/player'


    import {AudioSignal} from '../../../audio/ui/audiosignal'
    import { AudioClipUIContainer} from '../../../audio/ui/container'
    import { WavWriter } from '../../../audio/impl/wavwriter'
    import { StartStopSignal} from '../startstopsignal/startstopsignal'
    import {Script,Section,PromptUnit,PromptPhase} from '../script/script';

    import { RecordingFile } from '../recording'
    import { Uploader,Upload } from '../../../net/uploader';
import {Component, ViewChild, ChangeDetectorRef, Input, Output, EventEmitter} from "@angular/core";
import {Progress} from "./progress";
import {SessionService} from "./session.service";

import {SimpleTrafficLight} from "../startstopsignal/ui/simpletrafficlight";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {MdDialog, MdDialogConfig} from "@angular/material";
import {AudioDisplayDialog} from "app/apps/audio/audio_display_dialog";


const MAX_RECORDING_TIME_MS = 1000 * 60 * 60 * 60; // 1 hour
    export enum Mode {SERVER_BOUND, STAND_ALONE}

    export enum Status {IDLE, PRE_RECORDING, RECORDING, POST_REC_STOP, POST_REC_PAUSE, STOPPING_STOP, STOPPING_PAUSE,
    }

    export class Item {
        promptAsString:string;
        training: boolean;
        recs: Array<RecordingFile>;

        constructor(promptAsString:string,training: boolean) {
            this.promptAsString=promptAsString;
            this.training = training;
            this.recs = null;
        }

    }

// TODO enum not possible in template language , use string for now
//export enum StatusAlertType {INFO,WARN,ERROR};
@Component({

  selector: 'app-sprprompter',

  template: `

    {{promptText}}
  `,
  styles: [`:host{

    justify-content: center; /* align horizontal center */
    align-items: center; /* align vertical  center */
    background: white;
    text-align: center;
    font-size: 2em;
    line-height: 1.2em;
    flex: 0 1;
  }
  `]
})
export class Prompter{
  @Input() promptText:string
}

@Component({

  selector: 'app-sprpromptcontainer',

  template: `
    <app-sprprompter [promptText]="promptText"></app-sprprompter>
  `
  ,
  styles: [`:host{

    flex: 3; /* the container consumes all available space */
    padding: 10pt;
    /* height: 100%; */
    justify-content: center; /* align horizontal center*/
    align-items: center; /* align vertical center */
    background: white;
    text-align: center;
    display: flex;
    flex-direction:column;
    min-height: 0px;
  }
  `]
})
export class PromptContainer{
  @Input() promptText:string;
}

@Component({

  selector: 'app-sprprompting',

  template: `

    <app-simpletrafficlight [status]="startStopSignalState"></app-simpletrafficlight>
    <app-sprpromptcontainer [promptText]="promptText"></app-sprpromptcontainer>
    <app-sprprogress [items]="items" [selectedItemIdx]="selectedItemIdx" (onRowSelect)="itemSelect($event)"></app-sprprogress>



  `,
  styles: [`:host{

    /* height: 100%; */
    margin: 0;
    padding: 0;
    background: lightgrey;
    width: 100%; /* use all horizontal available space */
    flex: 1; /* ... and fill rest of vertical available space (other components have flex 0) */

    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    min-height:0px;
   
    display: flex; /* flex container: left traffic light, right prompter (container) */
    flex-direction: row;
    flex-wrap: nowrap; /* wrap could completely destroy the layout */
  }`,`
      app-simpletrafficlight {
          margin: 10px;
        min-height: 0px;
      }
  `]

})

export class Prompting{
  @ViewChild(SimpleTrafficLight) simpleTrafficLight:SimpleTrafficLight;
  @Input() startStopSignalState:StartStopSignalState;
  @Input() promptText:string;
  @Input() items:Array<Item>;
  @Input() selectedItemIdx:number;
  @Output() onItemSelect=new EventEmitter<number>();

  itemSelect(rowIdx:number){
    console.log("Row (prompting) "+rowIdx)
    this.onItemSelect.emit(rowIdx);
  }
}

@Component({

  selector: 'app-sprstatusdisplay',

  template: `
    <p><md-icon *ngIf="statusAlertType==='error'" style="color:red">report_problem</md-icon>{{statusMsg}}</p>
  `,
  styles: [`:host{
    flex: 1;
  //align-self: flex-start;
    display: inline;
    text-align:left;
    font-size: smaller;
  }`,`
  span {
    color:red;
  }
  `]

})

export class StatusDisplay{
  @Input() statusAlertType='info';
  @Input() statusMsg='Initialize...';

}

@Component({
  selector: 'app-sprprogressdisplay',
  template: `
    <p>{{progressMsg}}</p>
  `,
  styles: [`:host{
    flex: 1;
  //align-self: flex-start;
    display: inline;
    text-align:left;
  }`]
})
export class ProgressDisplay{
  progressMsg='[itemcode]';
}


export class TransportActions{
  startAction: Action;
  stopAction: Action;
  nextAction: Action;
  pauseAction: Action;
  fwdAction:Action;
  bwdAction:Action;
  constructor(){
    this.startAction = new Action('Start');
    this.stopAction = new Action('Stop');
    this.nextAction = new Action('Next');
    this.pauseAction = new Action('Pause');
    this.fwdAction=new Action('Forward');
    this.bwdAction=new Action('Backward');

  }
}

@Component({

  selector: 'app-sprtransport',

  template: `
      <button id="bwdBtn" (click)="actions.bwdAction.perform()" [disabled]="bwdDisabled()" md-raised-button><md-icon>chevron_left</md-icon></button>
      <button id="startBtn" (click)="actions.startAction.perform()" [disabled]="startDisabled()" md-raised-button><md-icon [style.color]="startDisabled() ? 'grey' : 'red'">fiber_manual_record</md-icon> Start</button>
      <button id="stopBtn" (click)="actions.stopAction.perform()" [disabled]="stopDisabled()" md-raised-button><md-icon [style.color]="stopDisabled() ? 'grey' : 'yellow'">stop</md-icon> Stop</button>
      <button id="nextBtn" (click)="actions.nextAction.perform()" [disabled]="nextDisabled()" md-raised-button><md-icon [style.color]="nextDisabled() ? 'grey' : 'yellow'">stop</md-icon><md-icon [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</md-icon> Next</button>
      <button id="pauseBtn" (click)="actions.pauseAction.perform()"  [disabled]="pauseDisabled()" md-raised-button><md-icon>pause</md-icon> Pause</button>
      <button id="fwdBtn" (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" md-raised-button><md-icon>chevron_right</md-icon></button>

  `,
  styles: [`:host{
    flex: 3;
    align-self: center;
    width: 100%;
    text-align: center;
    align-content: center;
    margin: 0;
  }`,`
    div {
      display:inline;
      flex: 0;
    }`,`
    button {
      font-size:1.5em;
    }
  `]

})
export class TransportPanel{


  @Input() actions:TransportActions;

  startDisabled() {
    return !this.actions || this.actions.startAction.disabled
  }
    stopDisabled() {
      return !this.actions || this.actions.stopAction.disabled
    }
    nextDisabled() {
      return !this.actions || this.actions.nextAction.disabled
    }
    pauseDisabled() {
      return !this.actions || this.actions.pauseAction.disabled
    }

  fwdDisabled() {
    return !this.actions || this.actions.fwdAction.disabled
  }

  bwdDisabled() {
    return !this.actions || this.actions.bwdAction.disabled
  }

}


@Component({

  selector: 'app-sprcontrolpanel',

  template: `
    <app-sprstatusdisplay [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"
                          class="hidden-xs"></app-sprstatusdisplay>
    <div>
      <button (click)="openAudioDisplayDialog()" [disabled]="!currentRecording" md-raised-button>
        <md-icon>menu</md-icon>
      </button>
    </div>
    <app-sprtransport [actions]="transportActions"></app-sprtransport>
    <app-sprprogressdisplay class="md-hidden-xs" ></app-sprprogressdisplay>
  `,
  styles: [`:host{
    flex: 0; /* only required vertical space */
    /*  width: 100%; */ /* available horizontal sace */
    /* display: inline; */
    display: flex;   /* Horizontal flex container: Bottom transport panel, above prompting panel */
    flex-direction: row;
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    min-height: min-content; /* important */
  }`,`
  div {
    flex:0 ;
  }
  `]
})
export class ControlPanel{
  @ViewChild(StatusDisplay) statusDisplay:StatusDisplay;
    @ViewChild(TransportPanel) transportPanel:TransportPanel;

    @Input() transportActions:TransportActions
    @Input() statusMsg:string;
    @Input() statusAlertType:string;
    @Input() currentRecording:AudioBuffer;
    constructor(public dialog: MdDialog){

    }
  openAudioDisplayDialog() {
    let dCfg=new MdDialogConfig();
    dCfg.width='80%';
    dCfg.height='80%';
    dCfg.data=this.currentRecording;
    let audioDisplayRef=this.dialog.open(AudioDisplayDialog,dCfg);
    audioDisplayRef.componentInstance.audioBuffer=this.currentRecording;
  }
}


@Component({

  selector: 'app-sprrecordingsession',
  providers: [SessionService],
  template: `
    
    <app-sprprompting [startStopSignalState]="startStopSignalState" [promptText]="promptText"  [items]="items" [selectedItemIdx]="selectedItemIdx" (onItemSelect)="itemSelect($event)"></app-sprprompting>
   
    <app-sprcontrolpanel [currentRecording]="currentRecording" [transportActions]="transportActions" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"></app-sprcontrolpanel>
    
  `,
  styles: [`:host{
    
    flex: 2; 
    
    background: lightgrey;

    display: flex; /* Vertical flex container: Bottom transport panel, above prompting panel */
    flex-direction: column;
    margin: 0;
    padding: 0;
    min-height:0px;
  }`]

})
export class SessionManager implements AudioCaptureListener {


        status: Status;
        mode: Mode;

        private uploader: Uploader;
        ac: AudioCapture;
        private _channelCount=2;
        @ViewChild(Prompting) prompting:Prompting;

        startStopSignalState:StartStopSignalState;
        // Property audioDevices from project config: list of names of allowed audio devices.
        private _audioDevices:any;
        private selCaptureDeviceId: ConstrainDOMString;
        currentRecording:AudioBuffer;
        private ap: AudioPlayer;
        private updateTimerId: any;
        private preRecTimerId: number;
        private preRecTimerRunning: boolean;
        private postRecTimerId: number;
        private postRecTimerRunning: boolean;
        private maxRecTimerId: number;
        private maxRecTimerRunning: boolean;

        transportActions:TransportActions;
//        fwdBtn: HTMLInputElement;
        dnlLnk: HTMLAnchorElement;
        playStartAction: Action;
        //statusMsg: HTMLElement;
       // titleEl: HTMLElement;
        audio: any;

        _session: any;
        _script: Script; // TODO this a plain JS object for now, did not id an easy way to convert JSON to TypeScript
          // See: https://stackoverflow.com/questions/22875636/how-do-i-cast-a-json-object-to-a-typescript-class

        private section: Section;
        private promptUnit: PromptUnit;


        sectIdx: number;
        prmptIdx: number;
        private autorecording: boolean;

        items: Array<Item>;
        selectedItemIdx:number;
        private displayRecFile: RecordingFile;
        private displayRecFileVersion: number;

        promptItemCount: number;

        promptItemIndex=0;

        promptText:string;

        statusMsg:string;
        statusAlertType:string;

        audioSignalCollapsed=true;

        constructor(private changeDetectorRef: ChangeDetectorRef) {
            this.status = Status.IDLE;
            this.mode = Mode.SERVER_BOUND;
            //this._startStopSignal = startStopSignal;
            //this.uploader = uploader;
            this.transportActions=new TransportActions();

            let playStartBtn = <HTMLInputElement>(document.getElementById('playStartBtn'));
            this.playStartAction = new Action('Play');
            this.playStartAction.addControl(playStartBtn, 'click');
            this.dnlLnk = <HTMLAnchorElement>document.getElementById('rfDownloadLnk');
            this.audio = document.getElementById('audio');
            this.selCaptureDeviceId=null;
        }


        init() {
            this.sectIdx = 0;
            this.prmptIdx = 0;
            this.autorecording = false;
            this.transportActions.startAction.disabled = true;
            this.transportActions.stopAction.disabled = true;
            this.transportActions.nextAction.disabled = true;
            this.transportActions.pauseAction.disabled = true;
            this.playStartAction.disabled = true;

            let w = <any>window;

            AudioContext = w.AudioContext || w.webkitAudioContext;
            if (typeof AudioContext !== 'function') {
               this.statusMsg = 'ERROR: Browser does not support Web Audio API!';
               this.statusAlertType='error';
            } else {
                let context = new AudioContext();


                if (navigator.mediaDevices) {

                    this.ac = new AudioCapture(context);
                    this.ac.listener = this;
                    this.ap = new AudioPlayer(context, this);

                    if (this.ac) {
                        this.transportActions.startAction.onAction = () => this.startItem();
                        document.addEventListener('keypress', (e) => {
                            let ke = <KeyboardEvent>e;
                            //if (ke.code == 'Space') {
                            if (ke.key == ' ') {

                                this.transportActions.startAction.perform();

                            }
                        }, false);

                    } else {
                        this.transportActions.startAction.disabled = true;
                        this.statusMsg = 'ERROR: Browser does not support Media/Audio API!';
                      this.statusAlertType='error';
                    }
                    this.transportActions.stopAction.onAction = () => this.stopItem();
                    document.addEventListener('keydown', (e) => {
                        let ke = <KeyboardEvent>e;
                        //if (ke.code == 'Space' || ke.code == 'Escape') {
                        if (ke.key == ' ' || ke.key == 'Escape') {
                            this.transportActions.stopAction.perform();
                        }
                    }, false);
                    this.transportActions.nextAction.onAction = () => this.stopItem();
                    document.addEventListener('keypress', (e) => {
                        let ke = <KeyboardEvent>e;
                        //if (ke.code == 'Space') {
                        if (ke.key == ' ') {
                            this.transportActions.nextAction.perform();
                        }
                    }, false);
                    this.transportActions.pauseAction.onAction = () => this.pauseItem();
                    window.addEventListener('keydown', (e) => {
                        let ke = <KeyboardEvent>e;

                        //if (ke.code == 'KeyP' || ke.code == 'Escape') {
                        if (ke.key == 'p' || ke.key == 'Escape') {
                            this.transportActions.pauseAction.perform();
                        }
                    }, false);

                    this.transportActions.fwdAction.onAction=()=>this.nextItem();
                    this.transportActions.bwdAction.onAction=()=>this.prevItem();

                    // TODO
                    // this.dnlLnk.addEventListener('click', () => {
                    //     this.downloadRecording();
                    // });

                    this.playStartAction.onAction = () => this.ap.start();
                    window.addEventListener('keydown', (e) => {
                        let ke = <KeyboardEvent>e;
                        // Chrome: code is empty
                        //if (ke.key == 'MediaPlayPause' || ke.code == 'MediaPlayPause') {
                        if (ke.key == 'MediaPlayPause') {
                            this.playStartAction.perform();
                        }

                    }, false);


                } else {

                   this.statusMsg = 'ERROR: Browser does not support Media streams!';
                  this.statusAlertType='error';
                }
            }
            this.ac.listDevices();
            this.startStopSignalState=StartStopSignalState.OFF;
        }

        set session(session: any) {
            this._session = session;
        }

        set script(script: any) {
            this._script = script;
            this.loadScript();

            this.sectIdx = 0;
            this.prmptIdx = 0;

            this.applyItem();

        }

      set channelCount(channelCount: number) {
        this._channelCount = channelCount;
      }

      set audioDevices(audioDevices: any) {
        this._audioDevices = audioDevices;
      }

        update(e: AudioPlayerEvent) {
            if (e.type == EventType.STARTED) {
                this.playStartAction.disabled = true;
                this.updateTimerId = window.setInterval(e => {
                    //this.audioSignal.playFramePosition = this.ap.playPositionFrames;
                }, 50);
            } else if (e.type == EventType.STOPPED || e.type == EventType.ENDED) {
                window.clearInterval(this.updateTimerId);
               // this.audioSignal.playFramePosition = this.ap.playPositionFrames;
                this.playStartAction.disabled = (!(this.displayRecFile));

            }
        }

      itemSelect(itemIdx:number){
          console.log("Selected item: "+itemIdx);


        let i=0;
        for(let si=0;si<this._script.sections.length;si++){
          let section = this._script.sections[si];
          let pis = section.promptUnits;
          let sLen=pis.length;
          if(itemIdx<i+sLen){
            this.sectIdx=si;
            this.prmptIdx=itemIdx-i;
            break;
          }else {
            i += pis.length;
          }
        }

        this.applyItem();
      }

        startItem() {
            //this.bwdBtn.disabled = true;
            this.transportActions.startAction.disabled = true;
            this.transportActions.pauseAction.disabled = true;
          this.transportActions.fwdAction.disabled=true
          this.transportActions.bwdAction.disabled=true
            //this.fwdBtn.disabled = true;
            this.displayRecFile = null;
            this.displayRecFileVersion = 0;
            this.showRecording();
            if (this.section.mode === 'AUTORECORDING') {
                this.autorecording = true;
            }
            this.ac.start();

        }


        loadScript() {
            this.promptItemCount = 0;

            this.items = new Array<Item>();
            let ln = 0;

            //TODO randomize not supported
            for (let si = 0; si < this._script.sections.length; si++) {
                let section = this._script.sections[si];
                let pis = section.promptUnits;

                let pisLen = pis.length;
                this.promptItemCount += pisLen;
                for (let piSectIdx = 0; piSectIdx < pisLen; piSectIdx++) {
                    let pi = pis[piSectIdx];
                    let promptAsStr='';
                    if(pi.mediaitems && pi.mediaitems.length>0){
                      promptAsStr=pi.mediaitems[0].text;
                    }

                    let it = new Item(promptAsStr,section.training);
                    this.items.push(it);
                    ln++;
                }
            }
        }

        currPromptIndex() {
            let idx = 0;
            for (let si = 0; si < this.sectIdx; si++) {
                let section = this._script.sections[si];
                let pis = section.promptUnits;
                idx += pis.length;
            }
            idx += this.prmptIdx;
            return idx;
        }



        clearPrompt() {
          //this.prompting.promptContainer.prompter.promptText='';
          this.promptText='';
          this.changeDetectorRef.detectChanges()
        }

        applyPrompt() {
          //this.prompting.promptContainer.prompter.promptText=this.promptUnit.mediaitems[0].text;
          this.promptText=this.promptUnit.mediaitems[0].text;
          this.changeDetectorRef.detectChanges()
        }

      downloadRecording() {
        if (this.displayRecFile) {
          let ab: AudioBuffer = this.displayRecFile.audioBuffer;
            let ww = new WavWriter();
            let wavFile = ww.writeAsync(ab, (wavFile) => {
                let blob = new Blob([wavFile], {type: 'audio/wav'});
                let rfUrl = URL.createObjectURL(blob);
                let rdDlEl = <HTMLAnchorElement>document.getElementById('rfDownloadLnk');

            let rdDlDivEl: HTMLDivElement = <HTMLDivElement>document.getElementById('rfDownload');
            let dataDnlLnk: HTMLAnchorElement = document.createElement('a');
            rdDlDivEl.appendChild(dataDnlLnk);

            dataDnlLnk.href = rfUrl;
            dataDnlLnk.name = 'Recording';
            // download property not yet in TS def
            let fn = this.displayRecFile.filenameString();
            fn += '_' + this.displayRecFileVersion;
            fn += '.wav';
            dataDnlLnk.setAttribute('download', fn);
            dataDnlLnk.click();
          });
        }
      }

        showRecording() {
            this.ap.stop();

            if (this.displayRecFile) {
                let ab: AudioBuffer = this.displayRecFile.audioBuffer;
                //this.audioSignal.setData(ab);
              this.currentRecording=ab;
              //  rdDlDivEl.style.visibility = 'visible';
                this.playStartAction.disabled = false;
                this.ap.audioBuffer = ab;
            } else {
                this.currentRecording=null;
               // this.audioSignal.setData(null);
                //     rdDlEl.href = null;
                //     rdDlEl.name = 'Recording';
                // // TODO disable link (remove anchor element)
                // rdDlEl.removeAttribute('download');
                //rdDlDivEl.style.visibility = 'hidden';
                this.ap.audioBuffer = null;
                this.playStartAction.disabled = true;
            }
        }

        applyItem() {

            this.section = this._script.sections[this.sectIdx]
            this.promptUnit = this.section.promptUnits[this.prmptIdx];
           // this.status=Status.IDLE;
            this.changeDetectorRef.detectChanges();
            this.clearPrompt();
            if (this.section.promptphase === 'IDLE') {
                this.applyPrompt();
            }

            this.selectedItemIdx=this.currPromptIndex();
            let it = this.items[this.selectedItemIdx];
            if (!it.recs) {
                it.recs = new Array<RecordingFile>();
            }

            let recentRecFile: RecordingFile = null;
            let availRecfiles: number = it.recs.length;
            if (availRecfiles > 0) {
                let rfVers: number = availRecfiles - 1;
                recentRecFile = it.recs[rfVers];
                this.displayRecFile = recentRecFile;
                this.displayRecFileVersion = rfVers;
            } else {
                this.displayRecFile = null;
                this.displayRecFileVersion = 0;
            }
          this.showRecording();
            this.startStopSignalState=StartStopSignalState.IDLE;
        }



        start() {

            if (this.ac) {
                this.statusMsg = 'Requesting audio permissions...';

                if (this._audioDevices) {
                  let fdi=null;

                  this.ac.deviceInfos((mdis)=> {
                    if(mdis) {
                      for (let adI = 0; adI < this._audioDevices.length; adI++) {
                        let ad = this._audioDevices[adI];
                        if(ad.playback){
                          // project audio device config for playback device
                          // not used for now
                          continue;
                        }
                        for (let mdii = 0; mdii < mdis.length; mdii++) {
                          let mdi = mdis[mdii];
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
                    }

                    if(fdi){
                      // matching device found
                      console.log("Open session with audio device \'" + fdi.label + "\' Id: \'" + fdi.deviceId + "\'");
                      this.ac.open(this._channelCount, fdi.deviceId);
                    }else {
                      // device not found
                      // TODO more user friendly ("Please plug audio device ... bla")
                      this.statusMsg = 'ERROR: Required audio device not available!';
                      this.statusAlertType='error';
                    }
                  });
                } else {
                    this.ac.open(this._channelCount);
                }


            }
        }



        prevItem() {
            let scriptLength = this._script.sections.length;

            this.prmptIdx--;
            if (this.prmptIdx < 0) {
                this.sectIdx--;
                if (this.sectIdx < 0) {
                    this.sectIdx = scriptLength - 1;
                }
                let currSectLength = this._script.sections[this.sectIdx].promptUnits.length;
                this.prmptIdx = currSectLength - 1;

            }
            this.applyItem();
        }

        nextItem() {
            let scriptLength = this._script.sections.length;
            let currSectLength = this._script.sections[this.sectIdx].promptUnits.length;
            this.prmptIdx++;
            if (this.prmptIdx >= currSectLength) {
                this.sectIdx++;
                this.prmptIdx = 0;
                if (this.sectIdx >= scriptLength) {
                    this.sectIdx = 0;
                }
            }
            this.applyItem();
        }


        opened() {
          this.statusAlertType='info';
            this.statusMsg = 'Ready.';
            this.transportActions.startAction.disabled = false;
          this.transportActions.fwdAction.disabled=false
          this.transportActions.bwdAction.disabled=false
        }

        started() {
            this.status = Status.PRE_RECORDING;
            this.transportActions.startAction.disabled = true;

            console.log("Spr: capture started");

            this.startStopSignalState=StartStopSignalState.PRERECORDING;

            if (this.section.promptphase === 'PRERECORDING') {
                this.applyPrompt();
            }
          this.statusAlertType='info';
            this.statusMsg = 'Recording...';

            let maxRecordingTimeMs = MAX_RECORDING_TIME_MS;
            if (this.promptUnit.recduration) {
                maxRecordingTimeMs = this.promptUnit.recduration;
            }
            this.maxRecTimerId = window.setTimeout(() => {
                this.maxRecTimerRunning = false;
                this.status = Status.STOPPING_STOP;
                this.ac.stop();
            }, maxRecordingTimeMs);
            this.maxRecTimerRunning = true;

            let preDelay = 1000;
            if (this.promptUnit.prerecording) {
                preDelay = this.promptUnit.prerecording;
            }

            this.preRecTimerId = window.setTimeout(() => {

                this.preRecTimerRunning = false;
                this.status = Status.RECORDING;
                this.startStopSignalState=StartStopSignalState.RECORDING;
                if (this.section.mode === 'AUTORECORDING') {
                    this.transportActions.nextAction.disabled = false;
                    this.transportActions.pauseAction.disabled = false;
                } else {
                    this.transportActions.stopAction.disabled = false;
                }
                if (this.section.promptphase === 'RECORDING') {
                    this.applyPrompt();
                }
            }, preDelay);
            this.preRecTimerRunning = true;
        }

        stopItem() {
            this.status = Status.POST_REC_STOP;
            this.startStopSignalState=StartStopSignalState.POSTRECORDING;
            this.transportActions.stopAction.disabled = true;
            this.transportActions.nextAction.disabled = true;
            let postDelay = 500;
            if (this.promptUnit.postrecording) {
                postDelay = this.promptUnit.postrecording;
            }

            this.postRecTimerId = window.setTimeout(() => {
                this.postRecTimerRunning = false;
                this.status = Status.STOPPING_STOP;
                this.stopRecording();
            }, postDelay);
            this.postRecTimerRunning = true;
        }

        pauseItem() {
            this.status = Status.POST_REC_PAUSE;
            this.transportActions.pauseAction.disabled = true;
            this.startStopSignalState=StartStopSignalState.POSTRECORDING;
            this.transportActions.stopAction.disabled = true;
            this.transportActions.nextAction.disabled = true;
            this.transportActions.pauseAction.disabled = true;
            let postDelay = 500;
            if (this.promptUnit.postrecording) {
                postDelay = this.promptUnit.postrecording;
            }

            this.postRecTimerId = window.setTimeout(() => {
                this.postRecTimerRunning = false;
                this.status = Status.STOPPING_PAUSE;
                this.stopRecording();
            }, postDelay);
            this.postRecTimerRunning = true;
        }

        stopRecording() {
            if (this.maxRecTimerRunning) {
                window.clearTimeout(this.maxRecTimerId);
                this.maxRecTimerRunning = false;
            }
            this.ac.stop();
        }

        stopped() {
            this.transportActions.startAction.disabled = false;
            this.transportActions.stopAction.disabled = true;
            this.transportActions.nextAction.disabled = true;
            this.transportActions.pauseAction.disabled = true;
            // console.log("Spr: capture stopped");
          this.statusAlertType='info';
            this.statusMsg = 'Recorded.';
            this.startStopSignalState=StartStopSignalState.IDLE;

            let ad = this.ac.audioBuffer();
            let ic = this._script.sections[this.sectIdx].promptUnits[this.prmptIdx].itemcode;
            let rf = new RecordingFile(this._session.sessionId, ic, ad);
            let cpIdx=this.currPromptIndex();
            let it = this.items[cpIdx];
            if (!it.recs) {
                it.recs = new Array<RecordingFile>();
            }
            it.recs.push(rf);

            // apply recorded item
            this.applyItem();

            if (this.mode === Mode.SERVER_BOUND) {
                // create Wikispeech URL

                // build upload URL
                let recUrl: string = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/wikispeech/storage/RECS?session=' + rf.sessionId + '&itemcode=' + rf.itemCode + '&extension=wav&line=01&overwrite=false';


                //console.log("Build wav writer...");
                let ww = new WavWriter();
                // convert to 16-bit integer PCM
                // TODO could we avoid conversion to save CPU resources and transfer float PCM directly?
                // TODO duplicate conversion for manual download
                ww.writeAsync(ad, (wavFile) => {
                     // TODO and upload to WikiSpeech server

                    //this.postRecording(wavFile, recUrl);
                });
            }


            // check complete session
            let complete = true;
            // search backwards, to gain faster detection of incomplete state
            for (let ri = this.items.length - 1; ri >= 0; ri--) {
                let it = this.items[ri];
                if (!it.training && (!it.recs || it.recs.length == 0)) {

                    complete = false;
                    break;
                }
            }

            if (complete) {
                this.statusMsg = 'Session complete!';
            } else {

                if (this.section.mode === 'AUTOPROGRESS' || this.section.mode === 'AUTORECORDING') {
                    this.nextItem();
                }

                if (this.section.mode === 'AUTORECORDING' && this.autorecording && this.status === Status.STOPPING_STOP) {
                    this.startItem();
                }else{
                    this.status=Status.IDLE
                  this.transportActions.fwdAction.disabled=false
                  this.transportActions.bwdAction.disabled=false
                }
            }
        }

        postRecording(wavFile: Uint8Array, recUrl: string) {
            let wavBlob = new Blob([wavFile], {type: 'audio/wav'});
            let ul = new Upload(wavBlob, recUrl);
            this.uploader.queueUpload(ul);
        }

        stop() {
            this.ac.close();
        }

        closed() {
          this.statusAlertType='info';
           this.statusMsg = 'Session closed.';
        }


        error() {
            this.statusMsg = 'ERROR: Recording.';
          this.statusAlertType='error';
        }
    }

