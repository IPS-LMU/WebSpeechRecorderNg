import {Action} from '../../action/action'
import {
  Component, ViewChild, Input
} from "@angular/core";

import { MatDialog} from "@angular/material/dialog";
import {ProgressSpinnerMode} from "@angular/material/progress-spinner";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {ResponsiveComponent} from "../../ui/responsive_component";
import {ThemePalette} from "@angular/material/core";

import '@angular/localize/init';


@Component({

  selector: 'app-sprstatusdisplay',

  template: `
    <p matTooltip="Status">
      <mat-progress-spinner *ngIf="statusWaiting" color="black"  mode="indeterminate" [diameter]="30" [strokeWidth]="5"></mat-progress-spinner><mat-icon *ngIf="statusAlertType==='error'" style="color:red">report_problem</mat-icon>
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
  `]

})

export class StatusDisplay {
  @Input() statusAlertType = 'info';
  @Input() statusMsg = 'Initialize...';
  @Input() statusWaiting =false;
}


@Component({
  selector: 'app-uploadstatus',
  template: `
    <mat-progress-spinner [mode]="spinnerMode" [color]="status" [diameter]="30" [strokeWidth]="5" [value]="_value" [matTooltip]="toolTipText"></mat-progress-spinner>
  `,
  styles: [`:host {
    text-align: left;
  }`,`mat-progress-spinner{
      display: inline-block;
  }`]
})
export class UploadStatus {
  private _awaitNewUpload=false;
  spinnerMode:ProgressSpinnerMode = 'determinate';
  _status!:string;
  _colorStatus:ThemePalette='primary';
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
      this._colorStatus = 'accent';
    } else if ('warn' === status) {
      this._colorStatus = 'warn';
    } else{
      this._colorStatus = 'primary';
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
  }`]
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

  constructor() {
    const locStart=$localize `Start`;
    this.startAction = new Action(locStart);
    this.stopAction = new Action('Stop');
    this.nextAction = new Action('Next');
    this.pauseAction = new Action('Pause');
    this.fwdNextAction = new Action('Next recording');
    this.fwdAction = new Action('Forward');
    this.bwdAction = new Action('Backward');

  }
}

@Component({

  selector: 'app-sprtransport',

  template: `
    <button id="bwdBtn" *ngIf="navigationEnabled"  (click)="actions.bwdAction.perform()" [disabled]="bwdDisabled()"
            mat-raised-button>
      <mat-icon>chevron_left</mat-icon>
    </button>
    <button (click)="startStopNextPerform()" [disabled]="startDisabled() && stopDisabled() && nextDisabled()"  mat-raised-button>
      <mat-icon [style.color]="startStopNextIconColor()">{{startStopNextIconName()}}</mat-icon><mat-icon *ngIf="!nextDisabled()" [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</mat-icon>
      <span *ngIf="!screenXs">{{startStopNextName()}}</span>
    </button>
    <button *ngIf="pausingEnabled" (click)="actions.pauseAction.perform()" [disabled]="pauseDisabled()" mat-raised-button>
      <mat-icon>pause</mat-icon>
      <span *ngIf="!screenXs" i18n>Pause</span>
    </button>
    <button id="fwdNextBtn" *ngIf="navigationEnabled && !screenXs" (click)="actions.fwdNextAction.perform()" [disabled]="fwdNextDisabled()" mat-raised-button>
      <mat-icon>redo</mat-icon>
    </button>
    <button id="fwdBtn" *ngIf="navigationEnabled"  (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" mat-raised-button>
      <mat-icon>chevron_right</mat-icon>
    </button>

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
    }`,`
     button {
       touch-action: manipulation;
     }`
  ]

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
        if(!this.nextDisabled()){
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
      }else if(!this.stopDisabled()){
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
    }
  }

}

@Component({
  selector: 'app-wakelockindicator',
  template: `
    <mat-icon *ngIf="_screenLocked">screen_lock_portrait</mat-icon>
  `,
  styles: []
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
  styles: []
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
    <div *ngIf="!screenXs" style="flex-direction: row" >
     <app-sprstatusdisplay style="flex:0 0 0" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"
                          class="hidden-xs"></app-sprstatusdisplay>
      <app-sprtransport style="flex:10 0 0" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled"></app-sprtransport>
      <app-uploadstatus style="flex:0 0 0" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                      [status]="uploadStatus" [awaitNewUpload]="processing"></app-uploadstatus>
      <app-readystateindicator [ready]="_ready"></app-readystateindicator>
    </div>
    <div *ngIf="screenXs"style="flex-direction: column"  >
      <div style="flex-direction: row" class="flexFill" >
       <app-sprstatusdisplay style="flex:10 0 0;flex-align:left" [statusMsg]="statusMsg" [statusAlertType]="statusAlertType" [statusWaiting]="statusWaiting"
                            class="hidden-xs"></app-sprstatusdisplay>
       <app-uploadstatus style="flex:0 0 0" *ngIf="enableUploadRecordings" [value]="uploadProgress"
                        [status]="uploadStatus" [awaitNewUpload]="processing"></app-uploadstatus>
        <app-readystateindicator [ready]="_ready"></app-readystateindicator>
      </div>
      <app-sprtransport [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled"></app-sprtransport>

    </div>
  `,
  styles: [`div {
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    min-height: min-content; /* important */
  }`]
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


