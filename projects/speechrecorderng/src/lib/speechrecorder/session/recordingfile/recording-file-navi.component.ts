import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {Action} from "../../../action/action";

@Component({
  selector: 'app-recording-file-navi',
  template: `
        <div #controlPanel style="display:flex;flex-direction: row;">
          <div #navi style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
            <fieldset>
              <legend>Versions</legend>
                <select #versionSelector [disabled]="versions==null || versions.length==1" (change)="selectVersionChange($event)">
                  <option *ngFor="let v of versions; let i = index" [selected]="v===version" value="{{v}}">{{v}}<span *ngIf="i==0"> (latest)</span></option>
                </select>
            </fieldset>
            <fieldset>
              <legend>Navigate</legend>
              <mat-progress-spinner *ngIf="naviInfoLoading" mode="indeterminate" [diameter]="20"></mat-progress-spinner>
              <div *ngIf="!naviInfoLoading"  style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
                <button (click)="prevAction?.perform()" [disabled]="prevAction?.disabled" matTooltip="Previous recording file">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <button (click)="nextAction?.perform()" [disabled]="nextAction.disabled" matTooltip="Next recording file">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </fieldset>
          </div>
        </div>
          `,
  styles: [
    `:host {
        flex: 0;

      }`]
})
export class RecordingFileNaviComponent implements OnInit {

  @Input() prevAction: Action<void>;
  @Input() nextAction: Action<void>;
  @Input() selectVersion: Action<number>;
  @Input() versions: Array<number>;
  @Input() version: number=null;

  @Input() naviInfoLoading=false;

  constructor() { }

  ngOnInit(): void {
  }

  selectVersionChange(ev){
    let versionNr=parseInt(ev.target.value);
    console.debug("Change event: "+ev.target.value+ ", as Nr: "+versionNr);
      this.selectVersion.perform(versionNr)
  }

}
