import {Component, Input, OnInit} from '@angular/core';
import {RecordingFile} from "./recording-file";
import {RecordingFileUtil} from "./recording-file";

@Component({
  selector: 'app-recording-file-meta',
  template: `
    <mat-card>
      <mat-card-title>Recording file ID: {{recordingFile?.recordingFileId}}</mat-card-title>
      <mat-card-content>
        <table>
          <tr><td>Itemcode:</td><td>{{recordingFile?.recording.itemcode}}</td></tr>
          <tr><td>Prompt:</td><td>{{recordingAsPlainText()}}</td></tr>
          <tr *ngIf="recordingFile?.session"><td>Session:</td><td>{{recordingFile?.session}}</td></tr>
        </table>
      </mat-card-content>
    </mat-card>
          `,
  styles: []
})
export class RecordingFileMetaComponent{

  @Input() recordingFile:RecordingFile;

  recordingAsPlainText(){
    return RecordingFileUtil.recordingAsPlainText(this.recordingFile);
  }
}
