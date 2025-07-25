import {Component, Input, OnInit} from '@angular/core';
import {Action} from "../../../action/action";

@Component({
    selector: 'app-recording-file-navi',
    template: `
        <div #controlPanel style="display:flex;flex-direction: row;">
          <div #navi style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
            <fieldset>
              <legend>Versions</legend>
              @if (naviInfoLoading) {
                <mat-progress-spinner mode="indeterminate" [diameter]="15"></mat-progress-spinner>
              }
              @if (!naviInfoLoading) {
                <select [disabled]="versions==null || versions.length==1" (change)="selectVersionChange($event)">
                  @for (v of versions; track v; let i = $index) {
                    <option [selected]="v===version" value="{{v}}">{{v}}@if (i==0) {
                      (latest)
                    }</option>
                  }
                </select>
              }
            </fieldset>
            <fieldset>
              <legend>Navigate</legend>
              @if (naviInfoLoading) {
                <mat-progress-spinner mode="indeterminate" [diameter]="15"></mat-progress-spinner>
              }
              @if (!naviInfoLoading) {
                <div  style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
                  <button (click)="firstAction?.perform()" [disabled]="!firstAction || firstAction.disabled" matTooltip="First recording file">
                    <mat-icon>first_page</mat-icon>
                  </button>
                  <button (click)="prevAction?.perform()" [disabled]="!prevAction || prevAction.disabled" matTooltip="Previous recording file">
                    <mat-icon>chevron_left</mat-icon>
                  </button>
                  <button (click)="nextAction?.perform()" [disabled]="!nextAction || nextAction.disabled" matTooltip="Next recording file">
                    <mat-icon>chevron_right</mat-icon>
                  </button>
                  <button (click)="lastAction?.perform()" [disabled]="!lastAction || lastAction.disabled" matTooltip="Last recording file">
                    <mat-icon>last_page</mat-icon>
                  </button>
                </div>
              }
              @if (items && itemPos!==null && itemPos!==undefined) {
                <p>Item {{itemPos+1}} of {{items}}</p>
              }
              <p>(List ordered by date)</p>
            </fieldset>
          </div>
        </div>
        `,
    styles: [
        `:host {
             flex: 0;
     
           }`
    ],
    standalone: false
})
export class RecordingFileNaviComponent implements OnInit {
  @Input() firstAction: Action<void>|undefined;
  @Input() prevAction: Action<void>|undefined;
  @Input() nextAction: Action<void>|undefined;
  @Input() lastAction: Action<void>|undefined;
  @Input() items:number | null|undefined;
  @Input() itemPos:number | null|undefined;
  @Input() selectVersion: Action<number>|undefined;
  @Input() versions: Array<number>|null=null;
  @Input() version: number|null=null;

  @Input() naviInfoLoading;

  constructor() {
      this.naviInfoLoading=false;
  }

  ngOnInit(): void {

  }

  selectVersionChange(ev:Event){
    //console.debug("Change event: "+ev.target.value+ ", as Nr: "+versionNr);

      const selEl = ev.target as HTMLSelectElement;
      let versionNr = parseInt(selEl.value);
      if(this.selectVersion) {
        this.selectVersion.perform(versionNr);
      }
  }

}
