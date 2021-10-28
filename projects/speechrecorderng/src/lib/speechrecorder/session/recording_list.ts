import {Component, EventEmitter, Input, Output} from "@angular/core";
import {RecordingFile, SprRecordingFile} from "../recording";

@Component({

  selector: 'app-recordinglist',

  template: `
    <h2>Recording list</h2>
    <table>
      <tr *ngFor="let rf of recordingList" [className]="(rf.uuid===selectedRecordingFile?.uuid)?'selected':'unselected'"><td>{{rf.uuid}}</td><td><button *ngIf="recordingList.length>1" mat-stroked-button  color="primary" (click)="selectRecordingFile(rf)" [disabled]="rf.uuid===selectedRecordingFile?.uuid"><mat-icon>edit_attributes</mat-icon> Select</button></td></tr>
    </table>



  `,
  styles: [`:host {
    position: relative;
    margin: 0;
    padding: 0;
    background: lightgrey;
    width: 100%; /* use all horizontal available space */
    flex: 1; /* ... and fill rest of vertical available space (other components have flex 0) */
    overflow-y: auto;

    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    min-height: 0px;

  }`,`
    .selected{
      font-weight: bold;
    }
  `]

})
export class RecordingList{
  recordingList:Array<RecordingFile>=new Array<RecordingFile>();

  @Output() selectedRecordingFileChanged = new EventEmitter<RecordingFile>();
  @Input() selectedRecordingFile:RecordingFile|null=null;

  @Input() audioSignalCollapsed: boolean=true;

  selectRecordingFile(rf:RecordingFile){
    this.selectedRecordingFileChanged.emit(rf);
  }
}
