import {Action} from '../../action/action'
import {
  Component, ViewChild, Input, EventEmitter, Output, HostListener
} from "@angular/core";

import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";


@Component({

  selector: 'app-sprstatusdisplay',

  template: `
    <p matTooltip="Status">
      <mat-icon *ngIf="statusAlertType==='error'" style="color:red">report_problem</mat-icon>
      {{statusMsg}}
    </p>
  `,
  styles: [`:host {
    flex: 1;
    /* align-self: flex-start; */
    display: inline;
    text-align: left;
    font-size: smaller;
  }`, `
    span {
      color: red;
    }
  `]

})

export class StatusDisplay {
  @Input() statusAlertType = 'info';
  @Input() statusMsg = 'Initialize...';

}


@Component({
  selector: 'app-uploadstatus',
  template: `
    <mat-progress-spinner [mode]="spinnerMode" [color]="status" [diameter]="30" [strokeWidth]="5" [value]="_value"></mat-progress-spinner>Upload: {{_value}}% <p *ngIf="online">Online</p><p *ngIf="!online">Offline</p>
  `,
  styles: [`:host {
    flex: 1;
  /* align-self: flex-start; */
    display: inline;
    text-align: left;
  }`]
})
export class UploadStatus {
  online:boolean=true;
  spinnerMode = 'determinate'
  spinnerColor = 'default'
  _value = 100
  @Input()
  set value(value: number) {
    if (value === 0) {
      this.spinnerMode = 'indeterminate'
    } else {
      this.spinnerMode = 'determinate'
    }

    this._value = value;
  };

  @Input() status: string;

  @HostListener('window:online', ['$event'])
  onLine(event: Event): void {
    this.online=true;
  }
  @HostListener('window:offline', ['$event'])
  offLine(event: Event): void {
    this.online=false;
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
    display: inline;
    text-align: left;
  }`]
})
export class ProgressDisplay {
  progressMsg = '[itemcode]';
}




export class TransportActions {
  startAction: Action;
  stopAction: Action;
  nextAction: Action;
  pauseAction: Action;
  fwdAction: Action;
  bwdAction: Action;

  constructor() {
    this.startAction = new Action('Start');
    this.stopAction = new Action('Stop');
    this.nextAction = new Action('Next');
    this.pauseAction = new Action('Pause');
    this.fwdAction = new Action('Forward');
    this.bwdAction = new Action('Backward');

  }
}

@Component({

  selector: 'app-sprtransport',

  template: `
    <button id="bwdBtn" (click)="actions.bwdAction.perform()" [disabled]="bwdDisabled()"
            mat-raised-button>
      <mat-icon>chevron_left</mat-icon>
    </button>
    <button (click)="startStopNextPerform()" [disabled]="startDisabled() && stopDisabled() && nextDisabled()"  mat-raised-button>
      <mat-icon [style.color]="startStopNextIconColor()">{{startStopNextIconName()}}</mat-icon><mat-icon *ngIf="!nextDisabled()" [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</mat-icon>
      {{startStopNextName()}}
    </button>
    <!--<button id="stopBtn" (click)="actions.stopAction.perform()" [disabled]="stopDisabled()" mat-raised-button>
      <mat-icon [style.color]="stopDisabled() ? 'grey' : 'yellow'">stop</mat-icon>
      Stop
    </button> 
    <button id="nextBtn" (click)="actions.nextAction.perform()" [disabled]="nextDisabled()" mat-raised-button>
      <mat-icon [style.color]="nextDisabled() ? 'grey' : 'yellow'">stop</mat-icon>
      <mat-icon [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</mat-icon>
      Next
    </button>-->
    <button  (click)="actions.pauseAction.perform()" [disabled]="pauseDisabled()" mat-raised-button>
      <mat-icon>pause</mat-icon>
      Pause
    </button>
    <button id="fwdBtn" (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" mat-raised-button>
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
    }`
  ]

})
export class TransportPanel {

  @Input() readonly:boolean;
  @Input() actions: TransportActions;

  startStopNextButtonName:string;
    startStopNextButtonIconName:string;

  startDisabled() {
    return !this.actions || this.readonly || this.actions.startAction.disabled
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

  selector: 'app-sprcontrolpanel',

  template: `
    <app-sprstatusdisplay fxHide.xs [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"
                          class="hidden-xs"></app-sprstatusdisplay>

    <app-sprtransport [readonly]="readonly" [actions]="transportActions"></app-sprtransport>

    <app-uploadstatus *ngIf="enableUploadRecordings" [value]="uploadProgress"
                      [status]="uploadStatus"></app-uploadstatus>
  `,
  styles: [`:host {
    flex: 0; /* only required vertical space */
    /*  width: 100%; */ /* available horizontal sace */
    /* display: inline; */
    display: flex; /* Horizontal flex container: Bottom transport panel, above prompting panel */
    flex-direction: row;
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    min-height: min-content; /* important */
  }`, `
    div {
      flex: 0;
    }
  `]
})
export class ControlPanel {
  @ViewChild(StatusDisplay, { static: true }) statusDisplay: StatusDisplay;
  @ViewChild(TransportPanel, { static: true }) transportPanel: TransportPanel;

  @Input() readonly:boolean
  @Input() transportActions: TransportActions
  @Input() statusMsg: string;
  @Input() statusAlertType: string;
  @Input() uploadStatus: string;
  @Input() uploadProgress: number;
  @Input() currentRecording: AudioBuffer;
  @Input() enableUploadRecordings: boolean;

  constructor(public dialog: MatDialog) {

  }
}


