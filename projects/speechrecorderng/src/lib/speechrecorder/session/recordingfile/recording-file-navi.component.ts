import {Component, Input, OnInit} from '@angular/core';
import {Action} from "../../../action/action";

@Component({
  selector: 'app-recording-file-navi',
  template: `
        <div #controlPanel style="display:flex;flex-direction: row;">
          <div #navi style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
            <fieldset>
              <legend>Navigate</legend>
              <div  style="flex: 0;display:flex;flex-direction: row;flex-wrap: nowrap">
                <button (click)="prevAction?.perform()" [disabled]="prevAction?.disabled"
                        [style.color]="nextAction?.disabled ? 'grey' : 'green'" matTooltip="Previous recording file">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <button (click)="nextAction.perform()" [disabled]="nextAction.disabled"
                        [style.color]="nextAction.disabled ? 'grey' : 'green'" matTooltip="Next recording file">
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

  constructor() { }

  ngOnInit(): void {
  }

}
