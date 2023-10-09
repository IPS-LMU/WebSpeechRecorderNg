import {Component, EventEmitter, Input, Output} from '@angular/core'
import {Item} from './item';


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
            <mat-icon  *ngIf="item.itemDone()">done</mat-icon>
            <!--<mat-icon *ngIf="latestRecordingAvail(item)===false" style="font-size:0.6em;width:0.6em;height:0.6em">cloud_download</mat-icon>-->

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
    See https://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
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
  @Input() items: Array<Item>|undefined=undefined;
  @Input() selectedItemIdx = 0;
  @Input() enableDownload: boolean=false;
  @Output() onRowSelect = new EventEmitter<number>();
  @Output()
  set rowSelect(rowIdx:number){
    this.onRowSelect.emit(rowIdx);
  }

  @Output() onShowDoneAction = new EventEmitter<number>();
  @Output()
  set clickDone(rowIdx:number){
    if(this.items &&this.items[rowIdx] && this.items[rowIdx].recs) {
      this.onRowSelect.emit(rowIdx);
      this.onShowDoneAction.emit(rowIdx);
    }
  }

  @Output() onDownloadDoneAction = new EventEmitter<number>();
  @Output()
  set clickDownloadDone(rowIdx:number){
    if(this.items && this.items[rowIdx] && this.items[rowIdx].recs) {
      this.onRowSelect.emit(rowIdx);
      this.onDownloadDoneAction.emit(rowIdx);
    }
  }

  latestRecordingAvail(item:Item):boolean|null{
    let cached=null;
    if(item && item.recs){
      let recsLen=item.recs.length;
      if(recsLen>0){
        let rf=item.recs[recsLen-1];
        if(rf && rf.serverPersisted) {
          cached = (rf.audioDataHolder != null);
        }
      }
    }
    return cached;
  }

}
