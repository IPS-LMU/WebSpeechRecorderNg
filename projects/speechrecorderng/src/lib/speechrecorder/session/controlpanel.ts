import {Action} from '../../action/action'
import {
  Component, ViewChild, Input
} from "@angular/core";

import { MatDialog} from "@angular/material/dialog";
import {ProgressSpinnerMode} from "@angular/material/progress-spinner";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {ResponsiveComponent} from "../../ui/responsive_component";
import {ThemePalette} from "@angular/material/core";



@Component({
    selector: 'app-sprstatusdisplay',
    template: `
    <p matTooltip="Status">
      @if (statusWaiting) {
        <mat-progress-spinner color="black"  mode="indeterminate" [diameter]="30" [strokeWidth]="5"></mat-progress-spinner>
        }@if (statusAlertType==='error') {
        <mat-icon style="color:red">report_problem</mat-icon>
      }
      {{statusMsg}}
    </p>
    `,
    styles: [`:host {
    display: inline;
    text-align: left;
    font-size: smaller;
  }`, `
    p {
      padding: 4px;
      white-space:nowrap;
      display: inline-block;
    }
  `, `
    mat-progress-spinner {
      color: black;
      display: inline-block;
    }
  `, `
    span {
      color: red;
    }
  `],
    standalone: false
})

export class StatusDisplay {
  @Input() statusAlertType = 'info';
  @Input() statusMsg = 'Initialize...';
  @Input() statusWaiting =false;
}


@Component({
    selector: 'app-uploadstatus',
    template: `
    <mat-progress-spinner [mode]="spinnerMode" [color]="colorStatus" [diameter]="30" [strokeWidth]="5" [value]="_value"
                          [matTooltip]="toolTipText"></mat-progress-spinner>
  `,
    styles: [`:host {
    text-align: left;
  }`, `mat-progress-spinner{
      display: inline-block;
  }`],
    standalone: false
})
export class UploadStatus {
  private _awaitNewUpload=false;
  spinnerMode:ProgressSpinnerMode = 'determinate';
  _status!:string;
  colorStatus:ThemePalette='primary';
  _value = 100;
  displayValue:string|null=null;
  toolTipText:string='';

  private _updateSpinner(){

    let uplMsg;
    if (this._awaitNewUpload || this._value === 0) {
      this.spinnerMode = 'indeterminate'
      this.displayValue='&nbsp;&nbsp;&nbsp;&nbsp;'
      uplMsg='Preparing upload.'
    } else {
      this.spinnerMode = 'determinate'
      this.displayValue=this._value+'%'
      if(this._value===100){
        uplMsg = 'Upload complete'
      }else {
        uplMsg = 'Upload progress: ' + this.displayValue
      }
    }
    if(this.status==='warn'){
      uplMsg='Upload error occurred. Please check your network connection. '+uplMsg
    }
    this.toolTipText=uplMsg
  }

  @Input()
  set value(value: number) {
    this._value = value;
    this._updateSpinner()
  };

  @Input() set awaitNewUpload(awaitNewUpload:boolean){
    this._awaitNewUpload=awaitNewUpload
    this._updateSpinner()
  }

  @Input() set status(status:string) {
    this._status = status;
    if ('accent' === status) {
      this.colorStatus = 'accent';
    } else if ('warn' === status) {
      this.colorStatus = 'warn';
    } else{
      this.colorStatus = 'primary';
    }
    this._updateSpinner()
  }

  get status():string{
    return this._status
  }

}


@Component({
    selector: 'app-sprprogressdisplay',
    template: `
    <p>{{progressMsg}}</p>
  `,
    styles: [`:host {
    flex: 1;
  /* align-self: flex-start; */
    /*display: inline; */
      width: 100%;
    text-align: left;
  }`],
    standalone: false
})
export class ProgressDisplay {
  progressMsg = '[itemcode]';
}




export class TransportActions {
  startAction: Action<void>;
  stopAction: Action<void>;
  nextAction: Action<void>;
  fwdNextAction: Action<void>;
  pauseAction: Action<void>;
  fwdAction: Action<void>;
  bwdAction: Action<void>;
  stopNonrecordingAction:Action<void>;

  constructor() {
    this.startAction = new Action('Start');
    this.stopAction = new Action('Stop');
    this.nextAction = new Action('Next');
    this.pauseAction = new Action('Pause');
    this.fwdNextAction = new Action('Next recording');
    this.fwdAction = new Action('Forward');
    this.bwdAction = new Action('Backward');
    this.stopNonrecordingAction=new Action('Next');

  }
}

@Component({
    selector: 'app-sprtransport',
    template: `
    @if (navigationEnabled) {
      <button id="bwdBtn"  (click)="actions.bwdAction.perform()" [disabled]="bwdDisabled()"
        mat-raised-button class="transport-button-icon">
        <span><mat-icon>chevron_left</mat-icon></span>
      </button>
    }
    <button (click)="startStopNextPerform()" [disabled]="startDisabled() && stopDisabled() && nextDisabled() && stopNonrecordingDisabled()"  mat-raised-button  class="transport-button-icon">
      <span><mat-icon class="transport-button-icon" [style.color]="startStopNextIconColor()">{{startStopNextIconName()}}</mat-icon>@if (!nextDisabled() || !stopNonrecordingDisabled()) {
      <mat-icon class="transport-button-icon" [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</mat-icon>
    }</span>
    @if (!screenXs) {
      <span class="transport-button-text">{{startStopNextName()}}</span>
    }
    </button>
    @if (pausingEnabled) {
      <button (click)="actions.pauseAction.perform()" [disabled]="pauseDisabled()" mat-raised-button  class="transport-button-icon">
        <span><mat-icon class="transport-button-icon">pause</mat-icon></span>
        @if (!screenXs) {
          <span class="transport-button-text">Pause</span>
        }
      </button>
    }
    @if (navigationEnabled && !screenXs) {
      <button id="fwdNextBtn" (click)="actions.fwdNextAction.perform()" [disabled]="fwdNextDisabled()" mat-raised-button class="transport-button-icon">
        <span><mat-icon>redo</mat-icon></span>
      </button>
    }
    @if (navigationEnabled) {
      <button id="fwdBtn"  (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" mat-raised-button class="transport-button-icon">
        <span><mat-icon>chevron_right</mat-icon></span>
      </button>
    }
    
    `,
    styles: [`:host {
    flex: 20;
    align-self: center;
    width: 100%;
    text-align: center;
    align-content: center;
    margin: 0;

  }`, `
    div {
      display: inline;
      flex: 0;
    }`, `
     button {
       touch-action: manipulation;
     }`, `
    .transport-button-icon{
      font-size: 24px;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
    }`, `
    .transport-button-text{
      font-size: 14px;
      letter-spacing: normal;
      vertical-align: baseline;
    }`
    ],
    standalone: false
})
export class TransportPanel extends ResponsiveComponent{

  @Input() readonly!:boolean;
  @Input() actions!: TransportActions;
  @Input() navigationEnabled=true;
  @Input() pausingEnabled=true;

  startStopNextButtonName!:string;
  startStopNextButtonIconName!:string;

    constructor(breakpointObserver: BreakpointObserver) {
      super(breakpointObserver);
    }

  startDisabled() {
    return !this.actions || this.readonly || this.actions.startAction.disabled
  }

  stopDisabled() {
    return !this.actions || this.actions.stopAction.disabled
  }

  nextDisabled() {
    return !this.actions || this.actions.nextAction.disabled || !this.navigationEnabled;
  }

  stopNonrecordingDisabled() {
    return !this.actions || this.actions.stopNonrecordingAction.disabled || !this.navigationEnabled;
  }

  pauseDisabled() {
    return !this.actions || this.actions.pauseAction.disabled || !this.pausingEnabled;
  }

  fwdDisabled() {
    return !this.actions || this.actions.fwdAction.disabled || !this.navigationEnabled;
  }

  fwdNextDisabled() {
    return !this.actions || this.actions.fwdNextAction.disabled || !this.navigationEnabled;
  }

  bwdDisabled() {
    return !this.actions || this.actions.bwdAction.disabled || !this.navigationEnabled;
  }

    startStopNextName():string{
        if(!this.nextDisabled() || !this.stopNonrecordingDisabled()){
            this.startStopNextButtonName= "Next"
        }else if(!this.startDisabled()){
            this.startStopNextButtonName="Start"
        }else if(!this.stopDisabled()) {
            this.startStopNextButtonName = "Stop"
        }
        return this.startStopNextButtonName;
    }
  startStopNextIconName():string{
      if(!this.startDisabled()){
         this.startStopNextButtonIconName="fiber_manual_record"
      }else if(!this.stopDisabled() || !this.stopNonrecordingDisabled()){
          this.startStopNextButtonIconName="stop"
      }else if(!this.nextDisabled()){
          this.startStopNextButtonIconName="stop"
      }
      return this.startStopNextButtonIconName
  }
    startStopNextIconColor():string{
        if(!this.startDisabled()){
            return "red"
        }else if(!this.stopDisabled() || !this.nextDisabled()){
            return "yellow"
        }else{
            return "grey";
        }
    }

  startStopNextPerform(){
    if(!this.startDisabled()){
      this.actions.startAction.perform();
    }else if(!this.stopDisabled()){
      this.actions.stopAction.perform();
    }else if(!this.nextDisabled()){
      this.actions.nextAction.perform();
    }else if(!this.stopNonrecordingDisabled()){
      this.actions.stopNonrecordingAction.perform();
    }
  }

}

@Component({
    selector: 'app-wakelockindicator',
    template: `
    @if (_screenLocked) {
      <mat-icon>screen_lock_portrait</mat-icon>
    }
    `,
    styles: [],
    standalone: false
})
export class WakeLockIndicator {
  _screenLocked=false;

  constructor() {}

  @Input() set screenLocked(screenLock:boolean){
    this._screenLocked=screenLock;
  }
}

@Component({
    selector: 'app-readystateindicator',
    template: `
    <mat-icon [matTooltip]="readyStateToolTip">{{hourGlassIconName}}</mat-icon>
  `,
    styles: [],
    standalone: false
})
export class ReadyStateIndicator {
  _ready=true;
  hourGlassIconName='hourglass_empty'
  readyStateToolTip:string=''

  constructor() {}

  @Input() set ready(ready:boolean){
    this._ready=ready
    this.hourGlassIconName=this._ready?'hourglass_empty':'hourglass_full'
    this.readyStateToolTip=this._ready?'Audio processing and upload done. You can leave the page without data loss.':'Please wait until audio processing and upload have finished. Please do not leave the page.'
  }

  get ready():boolean{
    return this._ready
  }
}

@Component({
    selector: 'app-sprcontrolpanel',
    template: `
    @if (!screenXs) {
      <div style="flex-direction: row" >
        <app-sprstatusdisplay style="flex:0 0 0" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"
        class="hidden-xs"></app-sprstatusdisplay>
        <app-sprtransport style="flex:10 0 0" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled"></app-sprtransport>
        @if (enableUploadRecordings) {
          <app-uploadstatus style="flex:0 0 0" [value]="uploadProgress"
          [status]="uploadStatus" [awaitNewUpload]="processing"></app-uploadstatus>
        }
        <app-readystateindicator [ready]="_ready"></app-readystateindicator>
      </div>
    }
    @if (screenXs) {
      <div style="flex-direction: column">
        <div style="flex-direction: row" class="flexFill" >
          <app-sprstatusdisplay style="flex:10 0 0" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"
          class="hidden-xs"></app-sprstatusdisplay>
          @if (enableUploadRecordings) {
            <app-uploadstatus style="flex:0 0 0" [value]="uploadProgress"
            [status]="uploadStatus" [awaitNewUpload]="processing"></app-uploadstatus>
          }
          <app-readystateindicator [ready]="_ready"></app-readystateindicator>
        </div>
        <app-sprtransport [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled"></app-sprtransport>
      </div>
    }
    `,
    styles: [`div {
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    min-height: min-content; /* important */
  }`],
    standalone: false
})
export class ControlPanel extends ResponsiveComponent {
  @ViewChild(StatusDisplay, { static: true }) statusDisplay!: StatusDisplay;
  @ViewChild(TransportPanel, { static: true }) transportPanel!: TransportPanel;

  @Input() readonly!:boolean
  @Input() transportActions!: TransportActions
  @Input() processing=false
  @Input() statusMsg!: string;
  @Input() statusAlertType!: string;
  @Input() statusWaiting!: boolean;
  @Input() uploadStatus!: string;
  @Input() uploadProgress!: number;
  @Input() currentRecording: AudioBuffer| null| undefined;
  @Input() enableUploadRecordings!: boolean;
  @Input() navigationEnabled=true;

  _ready=true

  constructor(protected bpo:BreakpointObserver,public dialog: MatDialog) {
    super(bpo);
  }

  @Input() set ready(ready:boolean){
    this._ready=ready
  }

  get ready():boolean{
    return this._ready
  }

}


