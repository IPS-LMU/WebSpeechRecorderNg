import {Component, Input} from '@angular/core'
import {Item} from './sessionmanager';


@Component({

  selector: 'app-sprprogress',

  template: `

    <table class="mat-typography">
      <thead>
      <tr>
        <th>#</th><!--<th>Code</th>-->
        <th>Prompt</th>
        <th>Status</th>
      </tr>
      </thead>
      <tbody>
      <ng-container *ngIf="items">

        <tr *ngFor="let item of items; let itIdx=index;"
            [class.selRow]="itIdx===selectedItemIdx" [scrollIntoView]="itIdx===selectedItemIdx">
          <td>{{itIdx}}</td>
          <td>{{item.promptAsString}}</td>
          <td>
            <md-icon *ngIf="item.recs && item.recs.length>0">done</md-icon>
          </td>
        </tr>
      </ng-container>

      </tbody>
    </table>
  `,
  styles: [`:host {
    overflow-x: hidden;
    overflow-y: scroll;
    padding: 10pt;
    flex: 1;
    background: white;
    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    /* min-height:0px; */
    min-height: 1px;

  }`,
      `table {
      min-height: 1px;
      border-collapse: collapse;
    }

    table, th, td {
      border: 1px solid lightgrey;
      padding: 0.5em;
    }

    `, `
      .selRow {
        background: lightblue;
      }
    `]

})
export class Progress {
  @Input() items: Array<Item>;
  @Input() selectedItemIdx = 0;
}
