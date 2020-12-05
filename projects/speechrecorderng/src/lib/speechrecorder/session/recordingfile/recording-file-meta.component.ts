import {Component, Input, OnInit} from '@angular/core';
import {RecordingFileUtil} from "./recording-file";
import {RecordingFile} from "../../recording";

@Component({
  selector: 'app-recording-file-meta',
  template: `
    <mat-card>
      <mat-card-title>Recording file ID: {{recordingFile?.recordingFileId}}</mat-card-title>
      <mat-card-content>
        <table>
          <tr>
            <td>Itemcode:</td>
            <td>{{recordingFile?.recording.itemcode}}</td>
          </tr>
          <tr *ngIf="recordingFile?.date">
            <td>Date:</td>
            <td>{{recordingFile?.date}}</td>
          </tr>
          <tr>
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

  @Input() sessionId:string | number | null;
  @Input() recordingFile:RecordingFile;

  recordingAsPlainText(){
    return RecordingFileUtil.recordingAsPlainText(this.recordingFile);
  }
}
