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
          <td class="promptDescriptor">{{item.promptAsString}}</td>
          <td>
            <mat-icon *ngIf="item.recs && item.recs.length>0">done</mat-icon>

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
    /*flex: 0.1 0 300px;  
      min-width: 300px; */
    flex: 0.1 1 content;
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
          /*min-width: 300px; */
      
    }

    table, th, td {
      border: 1px solid lightgrey;
      padding: 0.5em;
     
    }

    `, `
      .selRow {
        background: lightblue;
      }
    `,`.promptDescriptor{
      
      max-width: 200px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }`]

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
}
