import {Component, EventEmitter, Input, Output} from '@angular/core'
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
            (click)="rowSelect=itIdx" [class.selRow]="itIdx===selectedItemIdx"
            [scrollIntoViewToBottom]="itIdx===selectedItemIdx">
          <td>{{itIdx}}</td>
          <td>{{item.promptAsString}}</td>
          <td>
            <mat-icon *ngIf="item.recs && item.recs.length>0"
                      [matBadge]="item.recs.length"
                      [matBadgeHidden]="!item.recs || item.recs.length<2"
                      matBadgeOverlap="false"
                      matBadgeSize="small"
                      matBadgePosition="below after"
                      [matBadgeDisabled]="!(itIdx===selectedItemIdx)"
            >done</mat-icon>

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
      min-width: 220px;
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
          /* Tables do not have a natural min size */
          min-width: 200px;
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
  @Input() enableDownload: boolean;
  @Output() onRowSelect = new EventEmitter<number>();
  @Output()
  set rowSelect(rowIdx:number){
    this.onRowSelect.emit(rowIdx);
  }

  @Output() onShowDoneAction = new EventEmitter<number>();
  @Output()
  set clickDone(rowIdx:number){
    if(this.items[rowIdx] && this.items[rowIdx].recs) {
      this.onRowSelect.emit(rowIdx);
      this.onShowDoneAction.emit(rowIdx);
    }
  }

  @Output() onDownloadDoneAction = new EventEmitter<number>();
  @Output()
  set clickDownloadDone(rowIdx:number){
    if(this.items[rowIdx] && this.items[rowIdx].recs) {
      this.onRowSelect.emit(rowIdx);
      this.onDownloadDoneAction.emit(rowIdx);
    }
  }

  itemRecsVersions(idx:number):number{
    if(this.items){
      let item=this.items[idx]
      if(item.recs){
        return item.recs.length
      }
    }
    return 0;
  }
}
