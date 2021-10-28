import {Component, Input, OnInit} from '@angular/core';
import {RecordingFileUtil} from "./recording-file";
import {RecordingFile, SprRecordingFile} from "../../recording";

@Component({
  selector: 'app-recording-file-meta',
  template: `
    <mat-card>
      <mat-card-title>Recording file ID: {{recordingFile?.recordingFileId}}</mat-card-title>
      <mat-card-content>
        <table>
          <tr *ngIf="itemCode">
            <td>Itemcode:</td>
            <td>{{itemCode}}</td>
          </tr>
          <tr *ngIf="recordingFile?.date">
            <td>Date:</td>
            <td>{{recordingFile?.date}}</td>
          </tr>
          <tr *ngIf="itemCode">
            <td>Prompt:</td>
            <td>{{recordingAsPlainText()}}</td>
          </tr>

          <tr *ngIf="sessionId">
            <td>Session:</td>
            <td>{{sessionId}}</td>
          </tr>
        </table>
      </mat-card-content>
    </mat-card>
  `,
  styles: []
})
export class RecordingFileMetaComponent{


  @Input() sessionId:string | number | null=null;

  private _recordingFile:RecordingFile|null=null;

  get recordingFile(): RecordingFile | null {
    return this._recordingFile;
  }

  @Input() set recordingFile(recordingFile:RecordingFile|null){
    this._recordingFile=recordingFile;
    if(this._recordingFile instanceof SprRecordingFile){
      this.itemCode=this._recordingFile.itemCode;
    }
  }

  itemCode:string|null=null;

  recordingAsPlainText(){
    let t=null;
    if(this.recordingFile instanceof SprRecordingFile) {
      t= RecordingFileUtil.recordingAsPlainText(this.recordingFile);
    }
    return t;
  }
}
