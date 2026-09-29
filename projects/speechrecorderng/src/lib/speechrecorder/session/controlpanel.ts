import {Action} from '../../action/action'
import {
  Component, ViewChild, Input
} from "@angular/core";

import { MatDialog} from "@angular/material/dialog";
import {ProgressSpinnerMode} from "@angular/material/progress-spinner";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {ResponsiveComponent} from "../../ui/responsive_component";
import {ThemePalette} from "@angular/material/core";
import {KEY, keyLabel} from "./keybindings";
import {SprTranslator} from "../../i18n/translate";



@Component({
    selector: 'app-sprstatusdisplay',
    template: `
    <p [matTooltip]="i18n.t('spr.status.status')">
      @if (statusWaiting) {
        <mat-progress-spinner mode="indeterminate" [diameter]="20" [strokeWidth]="3"></mat-progress-spinner>
        }@if (statusAlertType==='error') {
        <span class="spr-status-alert"><mat-icon>report_problem</mat-icon></span>
      }
      {{statusMsg}}
    </p>
    `,
    styles: [`:host {
    display: inline;
    text-align: left;
    font-size: var(--spr-type-caption, 13.6px);
    color: var(--spr-ink-muted, #4A6288);
  }`, `
    p {
      margin: 0;
      padding: 4px;
      white-space:nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .spr-status-alert {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: var(--spr-r-sm, 6px);
      background: var(--spr-alert, #EABAB9);
      color: var(--spr-alert-ink, #000000);
    }

    .spr-status-alert mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `, `
    mat-progress-spinner {
      --mat-progress-spinner-active-indicator-color: var(--spr-ink, #1F3044);
      display: inline-block;
    }
  `],
    standalone: false
})

export class StatusDisplay {
  @Input() statusAlertType = 'info';
  @Input() statusMsg: string;
  @Input() statusWaiting =false;

  constructor(public readonly i18n: SprTranslator) {
    this.statusMsg = this.i18n.t('spr.status.initialize');
  }
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

  @Input() statusMsg: string|null = null;

  constructor(private i18n: SprTranslator) {
  }

  private _updateSpinner(){

    let uplMsg;
    if (this._awaitNewUpload || this._value === 0) {
      this.spinnerMode = 'indeterminate'
      this.displayValue='&nbsp;&nbsp;&nbsp;&nbsp;'
      uplMsg=this.i18n.t('spr.status.uploadPreparing')
    } else {
      this.spinnerMode = 'determinate'
      this.displayValue=this._value+'%'
      if(this._value===100){
        uplMsg = this.i18n.t('spr.status.uploadComplete')
      }else {
        uplMsg = this.i18n.t('spr.status.upload', {value: this.displayValue ?? ''})
      }
    }
    if(this.status==='warn'){
      if(this.statusMsg){
        uplMsg=this.statusMsg
      }else{
        uplMsg=this.i18n.t('spr.status.uploadError')+' '+uplMsg
      }
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
  respondentAction: Action<void>;
  /** Plays the sound of the current prompt; disabled for prompts without one. */
  playPromptAction: Action<void>;

  constructor(i18n: SprTranslator = new SprTranslator()) {
    this.startAction = new Action(i18n.t('spr.transport.start'));
    this.stopAction = new Action(i18n.t('spr.transport.stop'));
    this.nextAction = new Action(i18n.t('spr.transport.next'));
    this.pauseAction = new Action(i18n.t('spr.transport.pause'));
    this.fwdNextAction = new Action(i18n.t('spr.transport.nextRecording'));
    this.fwdAction = new Action(i18n.t('spr.transport.forward'));
    this.bwdAction = new Action(i18n.t('spr.transport.backward'));
    this.stopNonrecordingAction=new Action(i18n.t('spr.transport.next'));
    this.respondentAction = new Action(i18n.t('spr.transport.respondent'));
    this.playPromptAction = new Action(i18n.t('spr.transport.playPrompt'));
    this.playPromptAction.disabled = true;

  }
}

@Component({
    selector: 'app-sprtransport',
    template: `
    @if (navigationEnabled) {
      <button id="bwdBtn"  (click)="actions.bwdAction.perform()" [disabled]="bwdDisabled()"
        mat-stroked-button class="transport-button-icon" [matTooltip]="bwdTooltip" [attr.aria-label]="bwdTooltip">
        <span><mat-icon>chevron_left</mat-icon></span>
      </button>
    }
    <button (click)="startStopNextPerform()" [disabled]="startDisabled() && stopDisabled() && nextDisabled() && stopNonrecordingDisabled()"  mat-raised-button  class="transport-button-icon spr-primary" [matTooltip]="startStopNextTooltip" [attr.aria-label]="startStopNextTooltip">
      <span><mat-icon class="transport-button-icon" [style.color]="startStopNextIconColor()">{{startStopNextIconName()}}</mat-icon>@if (!nextDisabled() || !stopNonrecordingDisabled()) {
      <mat-icon class="transport-button-icon" [style.color]="nextDisabled() ? 'var(--spr-chrome-ink-muted, rgba(255, 255, 255, 0.62))' : 'var(--spr-chrome-ink, #FFFFFF)'">chevron_right</mat-icon>
    }</span>
    @if (!screenXs) {
      <span class="transport-button-text">{{startStopNextName()}}</span>
    }
    </button>
    @if (pausingEnabled) {
      <button (click)="actions.pauseAction.perform()" [disabled]="pauseDisabled()" mat-stroked-button  class="transport-button-icon" [matTooltip]="pauseTooltip" [attr.aria-label]="pauseTooltip">
        <span><mat-icon class="transport-button-icon">pause</mat-icon></span>
        @if (!screenXs) {
          <span class="transport-button-text">{{i18n.t('spr.transport.pause')}}</span>
        }
      </button>
    }
    @if (!playPromptDisabled()) {
      <button id="playPromptBtn" (click)="actions.playPromptAction.perform()" mat-stroked-button class="transport-button-icon" [matTooltip]="playPromptTooltip" [attr.aria-label]="playPromptTooltip">
        <span><mat-icon class="transport-button-icon">volume_up</mat-icon></span>
        @if (!screenXs) {
          <span class="transport-button-text">{{i18n.t('spr.transport.playPrompt')}}</span>
        }
      </button>
    }
    @if (navigationEnabled && !screenXs) {
      <button id="fwdNextBtn" (click)="actions.fwdNextAction.perform()" [disabled]="fwdNextDisabled()" mat-stroked-button class="transport-button-icon" [matTooltip]="i18n.t('spr.transport.nextRecording')" [attr.aria-label]="i18n.t('spr.aria.nextRecording')">
        <span><mat-icon>redo</mat-icon></span>
      </button>
    }
    @if (navigationEnabled) {
      <button id="fwdBtn"  (click)="actions.fwdAction.perform()" [disabled]="fwdDisabled()" mat-stroked-button class="transport-button-icon" [matTooltip]="fwdTooltip" [attr.aria-label]="fwdTooltip">
        <span><mat-icon>chevron_right</mat-icon></span>
      </button>
    }
    @if (respondentKey) {
      <button id="respondentBtn" (click)="actions.respondentAction.perform()" mat-stroked-button class="transport-button-icon" [matTooltip]="respondentTooltip" [attr.aria-label]="respondentTooltip">
        <span><mat-icon>cast</mat-icon></span>
      </button>
    }
    
    `,
    styles: [`:host {
    flex: 20;
    align-self: center;
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    align-content: center;
    margin: 0;
    color: var(--spr-ink, #1F3044);

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
    }

    button.transport-button-icon {
      min-width: 40px;
      height: 40px;
      padding: 0 8px;
      border-radius: var(--spr-r-md, 12px);
      color: var(--spr-ink, #1F3044);
      border-color: var(--spr-border-strong, #C7D1DF);
    }

    button.spr-primary {
      min-width: 96px;
      height: 48px;
      padding: 0 18px;
      border-radius: 17px;
      background: var(--spr-primary, #2A4765);
      color: var(--spr-primary-ink, #FFFFFF);
      box-shadow: var(--spr-shadow-cta, 0 12px 22px rgba(42, 71, 101, 0.22));
    }

    button.spr-primary:disabled {
      background: var(--spr-disabled-bg, rgba(42, 71, 101, 0.06));
      color: var(--spr-ink-disabled, #6D7C98);
      box-shadow: none;
    }

    .transport-button-text{
      font-size: var(--spr-type-caption, 13.6px);
      font-weight: 700;
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
  /** Key label of the respondent display; `null` hides the transport control. */
  @Input() respondentKey: string|null = null;

  startStopNextButtonName!:string;
  startStopNextButtonIconName!:string;

    constructor(breakpointObserver: BreakpointObserver, public readonly i18n: SprTranslator) {
      super(breakpointObserver);
    }

  get bwdTooltip():string {
    return this.i18n.t('spr.transport.tooltip.backward', {key: keyLabel(KEY.BACKWARD)});
  }

  get startStopNextTooltip():string {
    return this.i18n.t('spr.transport.tooltip.startStopNext', {key: keyLabel(KEY.START_STOP)});
  }

  get pauseTooltip():string {
    return this.i18n.t('spr.transport.tooltip.pause', {key: keyLabel(KEY.PAUSE)});
  }

  get playPromptTooltip():string {
    return this.i18n.t('spr.transport.tooltip.playPrompt', {key: keyLabel(KEY.PLAY_PROMPT)});
  }

  get fwdTooltip():string {
    return this.i18n.t('spr.transport.tooltip.forward', {key: keyLabel(KEY.FORWARD)});
  }

  get respondentTooltip():string {
    return this.i18n.t('spr.transport.tooltip.respondent', {key: this.respondentKey ?? ''});
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

  /** Hidden rather than disabled: only prompts that carry a sound offer the control. */
  playPromptDisabled() {
    return !this.actions || this.actions.playPromptAction.disabled;
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
            this.startStopNextButtonName= this.i18n.t('spr.transport.next')
        }else if(!this.startDisabled()){
            this.startStopNextButtonName=this.i18n.t('spr.transport.start')
        }else if(!this.stopDisabled()) {
            this.startStopNextButtonName = this.i18n.t('spr.transport.stop')
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
            return "var(--spr-ok, #73A790)"
        }else if(!this.stopDisabled() || !this.nextDisabled()){
            return "var(--spr-caution, #D7B17C)"
        }else{
            return "var(--spr-chrome-ink-muted, rgba(255, 255, 255, 0.62))";
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

  constructor(private i18n: SprTranslator) {}

  @Input() set ready(ready:boolean){
    this._ready=ready
    this.hourGlassIconName=this._ready?'hourglass_empty':'hourglass_full'
    this.readyStateToolTip=this._ready?this.i18n.t('spr.status.datasetDone'):this.i18n.t('spr.status.datasetPending')
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
        <app-sprtransport style="flex:10 0 0" [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled" [respondentKey]="respondentKey"></app-sprtransport>
        @if (enableUploadRecordings) {
          <app-uploadstatus style="flex:0 0 0" [value]="uploadProgress"
          [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processing"></app-uploadstatus>
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
            [status]="uploadStatus" [statusMsg]="uploadStatusMsg" [awaitNewUpload]="processing"></app-uploadstatus>
          }
          <app-readystateindicator [ready]="_ready"></app-readystateindicator>
        </div>
        <app-sprtransport [readonly]="readonly" [actions]="transportActions" [navigationEnabled]="navigationEnabled" [respondentKey]="respondentKey"></app-sprtransport>
      </div>
    }
    `,
    styles: [`div {
    align-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
    color: var(--spr-ink, #1F3044);
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
  @Input() uploadStatusMsg: string|null = null;
  @Input() uploadProgress!: number;
  @Input() currentRecording: AudioBuffer| null| undefined;
  @Input() enableUploadRecordings!: boolean;
  @Input() navigationEnabled=true;
  /** Key label of the respondent display; `null` hides the control (no session to mirror). */
  @Input() respondentKey: string|null = null;

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


