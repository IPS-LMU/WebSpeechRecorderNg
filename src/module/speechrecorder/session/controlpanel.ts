import {Action} from '../../action/action'
import {
  Component, ViewChild, Input, EventEmitter, Output
} from "@angular/core";

import {MatDialog, MatDialogConfig, MatIcon} from "@angular/material";


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
    <mat-progress-spinner [mode]="spinnerMode" [color]="status" [diameter]="30" [strokeWidth]="5" [value]="_value"></mat-progress-spinner>Upload: {{_value}}%
  `,
  styles: [`:host {
    flex: 1;
  /* align-self: flex-start; */
    display: inline;
    text-align: left;
  }`]
})
export class UploadStatus {
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
    console.log('Spinner value: ' + this._value)
  };

  @Input() status: string;
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
            md-raised-button>
      <mat-icon>chevron_left</mat-icon>
    </button>
    <button id="startBtn" (click)="actions.startAction.perform()" [disabled]="startDisabled()" md-raised-button>
      <mat-icon [style.color]="startDisabled() ? 'grey' : 'red'">fiber_manual_record</mat-icon>
      Start
    </button>
    <button id="stopBtn" (click)="actions.stopAction.perform()" [disabled]="stopDisabled()" md-raised-button>
      <mat-icon [style.color]="stopDisabled() ? 'grey' : 'yellow'">stop</mat-icon>
      Stop
    </button>
    <button id="nextBtn" (click)="actions.nextAction.perform()" [disabled]="nextDisabled()" md-raised-button>
      <mat-icon [style.color]="nextDisabled() ? 'grey' : 'yellow'">stop</mat-icon>
      <mat-icon [style.color]="nextDisabled() ? 'grey' : 'black'">chevron_right</mat-icon>
      Next
    </button>
    <button id="pauseBtn" (click)="actions.pauseAction.perform()" [disabled]="pauseDisabled()" md-raised-button>
      <mat-icon>pause</mat-icon>
      Pause
    </button>
    <button id="fwdBtn" (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" md-raised-button>
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
    }`, `
    button {
      font-size: 1.2em;
    }
  `]

})
export class TransportPanel {


  @Input() actions: TransportActions;

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
    <app-sprstatusdisplay fxHide.xs [statusMsg]="statusMsg" [statusAlertType]="statusAlertType"
                          class="hidden-xs"></app-sprstatusdisplay>

    <app-sprtransport [actions]="transportActions"></app-sprtransport>

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
  @ViewChild(StatusDisplay) statusDisplay: StatusDisplay;
  @ViewChild(TransportPanel) transportPanel: TransportPanel;

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


