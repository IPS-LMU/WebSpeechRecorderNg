import {AfterViewInit, Component, EventEmitter, Input, Output} from "@angular/core";
import {RecordingFile, SprRecordingFile} from "../recording";
import {MediaUtils} from "../../media/utils";
import {MatTable, MatTableDataSource} from "@angular/material/table";
import {Observable, Subject} from "rxjs";

@Component({

  selector: 'app-recordinglist',

  template: `
    <h2>Recording list</h2>
    <table mat-table [dataSource]="recordingListDataSource" class="mat-elevation-z0">
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let recordingList; columns: cols;"></tr>
      <ng-container matColumnDef="index">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>#</th>
        <td mat-cell class="monospaced" *matCellDef="let element;let i = index">{{i}}</td>
      </ng-container>
      <ng-container matColumnDef="length">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Length</th>
        <td mat-cell class="monospaced" *matCellDef="let element">{{lengthTimeFormatted(element)}}</td>
      </ng-container>
      <ng-container matColumnDef="samples">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Sample count</th>
        <td mat-cell *matCellDef="let element">{{element.audioBuffer?.length}}</td>
      </ng-container>
      <ng-container matColumnDef="samplerate">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Samplerate</th>
        <td mat-cell *matCellDef="let element">{{element.audioBuffer?.sampleRate}}Hz</td>
      </ng-container>
      <ng-container matColumnDef="action">
        <th mat-header-cell *matHeaderCellDef>Action</th>
        <td mat-cell *matCellDef="let element"><button mat-stroked-button color="primary" (click)="selectRecordingFile(element)" [disabled]="element.uuid===selectedRecordingFile?.uuid"><mat-icon>edit_attributes</mat-icon> Select</button></td>
      </ng-container>
      <!--
      <tr mat-header-row><th>#</th><th>Length</th><th>Samples</th><th>Samplerate</th><th>Action</th></tr>
      <tr *ngFor="let rf of recordingList; let i = index;" mat-row  [className]="(rf.uuid===selectedRecordingFile?.uuid)?'selected':'unselected'">
        <td>{{i}}</td>
        <td>{{lengthTimeFormatted(rf)}}</td>
        <td>{{rf.frames}}</td>
        <td>{{rf.audioBuffer?.sampleRate}}Hz</td>
        <td><button *ngIf="recordingList.length>1" mat-stroked-button  color="primary" (click)="selectRecordingFile(rf)" [disabled]="rf.uuid===selectedRecordingFile?.uuid"><mat-icon>edit_attributes</mat-icon> Select</button></td>
      </tr>
      -->
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
  `],
  styleUrls: ['../../speechrecorder_mat.scss']

})
export class RecordingList implements AfterViewInit{
  recordingList:Array<RecordingFile>=new Array<RecordingFile>();
  //recordingListSubject:Subject<Array<RecordingFile>> = new Subject<Array<RecordingFile>>();
  recordingListDataSource:MatTableDataSource<RecordingFile>;
  cols=['index','length','samples','samplerate','action'];
  @Output() selectedRecordingFileChanged = new EventEmitter<RecordingFile>();
  @Input() selectedRecordingFile:RecordingFile|null=null;

  @Input() audioSignalCollapsed: boolean=true;

  constructor() {
    this.recordingListDataSource=new MatTableDataSource<RecordingFile>();
  }

  ngAfterViewInit() {
    this.recordingListDataSource.data=this.recordingList;
  }

  push(rf:RecordingFile){
    this.recordingList.push(rf);
    this.recordingListDataSource.data=this.recordingList;
  }

  selectRecordingFile(rf:RecordingFile){
    this.selectedRecordingFileChanged.emit(rf);
  }

  lengthTimeFormatted(rf:RecordingFile){
    let str='--:--:--';
    if(rf.frames && rf.audioBuffer) {
      str=MediaUtils.toMediaTime(rf.frames / rf.audioBuffer?.sampleRate);
    }
    return str;
  }
}
