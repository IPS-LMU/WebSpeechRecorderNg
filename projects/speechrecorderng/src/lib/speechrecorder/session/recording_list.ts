import {AfterViewInit, Component, EventEmitter, Input, Output} from "@angular/core";
import {RecordingFile, SprRecordingFile} from "../recording";
import {MediaUtils} from "../../media/utils";
import {MatTable, MatTableDataSource} from "@angular/material/table";
import {Observable, Subject} from "rxjs";
import {RecFilesCache} from "./recording_file_cache";
import {AudioDataHolder} from "../../audio/audio_data_holder";

@Component({

  selector: 'app-recordinglist',

  template: `
    <mat-card>
        <mat-card-header>
          <h2>Recording list</h2>
        </mat-card-header>
      <mat-card-content>
    <table mat-table [dataSource]="recordingListDataSource" class="mat-elevation-z0">
      <tr mat-header-row *matHeaderRowDef="cols;sticky:true"></tr>
      <tr mat-row *matRowDef="let element; columns: cols;" [scrollIntoViewToBottom]="element.uuid===selectedRecordingFile?.uuid"></tr>
      <ng-container matColumnDef="index">
        <th mat-header-cell *matHeaderCellDef mat-header>#</th>
        <td mat-cell class="monospaced" *matCellDef="let element;let i = index">{{recordingListDataSource.data.length-i}}</td>
      </ng-container>
      <ng-container matColumnDef="startedDate">
        <th mat-header-cell *matHeaderCellDef mat-header>Started</th>
        <td mat-cell class="monospaced" *matCellDef="let element">{{element.startedDate | date:'YYYY-MM-dd HH:mm:ss'}}</td>
      </ng-container>
      <ng-container matColumnDef="length">
        <th mat-header-cell *matHeaderCellDef mat-header>Length</th>
        <td mat-cell class="monospaced" *matCellDef="let element">{{lengthTimeFormatted(element)}}</td>
      </ng-container>
      <ng-container matColumnDef="action">
        <th mat-header-cell *matHeaderCellDef>Action</th>
        <td mat-cell *matCellDef="let element"><button mat-stroked-button color="primary" (click)="selectRecordingFile(element)" [disabled]="selectDisabled || element.uuid===selectedRecordingFile?.uuid"><mat-icon>edit_attributes</mat-icon> Select</button></td>
      </ng-container>
    </table>
      </mat-card-content>
    </mat-card>

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
  //private recordingList:Array<RecordingFile>=new Array<RecordingFile>();
  private recordingList:RecFilesCache=new RecFilesCache();
  //recordingListSubject:Subject<Array<RecordingFile>> = new Subject<Array<RecordingFile>>();
  recordingListDataSource:MatTableDataSource<RecordingFile>;
  //cols=['index','length','samples','samplerate','action'];
  cols=['index','startedDate','length','action'];
  @Input() selectDisabled:boolean=false;
  @Output() selectedRecordingFileChanged = new EventEmitter<RecordingFile>();
  @Input() selectedRecordingFile:RecordingFile|null=null;

  constructor() {
    this.recordingListDataSource=new MatTableDataSource<RecordingFile>();
  }

  ngAfterViewInit() {
    this.buildDataSource();
  }

  private buildDataSource(){
    this.recordingList.recFiles.sort((a, b) => {
      let cmp:number=0;
      let aD:Date|null=null;
      let bD:Date|null=null;
      if(a._startedAsDateObj && b._startedAsDateObj){
        aD=a._startedAsDateObj
        bD=b._startedAsDateObj
      }else if(a.startedDate && b.startedDate){
        aD=new Date(a.startedDate);
        bD=new Date(b.startedDate);
      }else if(a.date && b.date) {
        aD=new Date(a.date);
        bD=new Date(b.date);
      }
      if(aD!==null && bD!==null){
        cmp=bD.getTime()-aD.getTime();
      }
      return cmp;
    });
    this.recordingListDataSource.data=this.recordingList.recFiles;
  }

  addRecFile(rf:RecordingFile){
    this.recordingList.addRecFile(rf);
    this.buildDataSource();
  }

  setRecFileAudioData(recFile:RecordingFile, adh:AudioDataHolder|null) {
    this.recordingList.setRecFileAudioData(recFile,adh);
  }

  selectRecordingFile(rf:RecordingFile){
    this.selectedRecordingFileChanged.emit(rf);
  }

  selectTop() {
    if (this.recordingList.recFiles.length > 0) {
      this.selectRecordingFile(this.recordingList.recFiles[0]);
    }
  }

  lengthTimeFormatted(rf:RecordingFile){
    let str='--:--:--';
    let tl=null;
    if(rf.timeLength){
      tl=rf.timeLength;
    }else if(rf.frames && rf.audioDataHolder) {
      tl=rf.frames / rf.audioDataHolder?.sampleRate
    }
    if(tl) {
      str = MediaUtils.toMediaTime(tl);
    }
    return str;
  }
}
