import {Component, Input} from '@angular/core';
import {RecordingFileUtil} from "./recording-file";
import {SprRecordingFile} from "../../recording";

@Component({
  selector: 'app-recording-file-meta',
  template: `
    <mat-card>
      <mat-card-title>Recording file ID: {{recordingFile?.recordingFileId}}</mat-card-title>
      <mat-card-content>
        <mat-progress-spinner *ngIf="stateLoading" mode="indeterminate" [diameter]="20"></mat-progress-spinner>
        <table>
          <tr *ngIf="itemCode">
            <td>Itemcode:</td>
            <td>{{itemCode}}</td>
          </tr>
          <tr *ngIf="uuid && !itemCode">
            <td>UUID:</td>
            <td>{{uuid}}</td>
          </tr>
          <tr *ngIf="recordingFile?.startedDate">
            <td>Started:</td>
            <td>{{recordingFile?.startedDate}}</td>
          </tr>
          <tr *ngIf="!recordingFile?.startedDate && recordingFile?.date">
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

  private _recordingFile:SprRecordingFile|null=null;

  @Input() stateLoading:boolean=false;

  get recordingFile(): SprRecordingFile | null {
    return this._recordingFile;
  }

  @Input() set recordingFile(recordingFile:SprRecordingFile|null){
    this._recordingFile=recordingFile;
    if(this._recordingFile) {
      this.itemCode = this._recordingFile.itemCode;
      if(!this.itemCode && this._recordingFile.recording?.itemcode){
        this.itemCode=this._recordingFile.recording.itemcode;
      }
      if (this.itemCode) {

        this.uuid = null;
        //console.debug("SprRecordingFile: "+this.itemCode+ " UUID: "+this.uuid)
      } else {
        this.itemCode = null;
        this.uuid = this._recordingFile?.uuid;
        //console.debug("RecordingFile: "+this.itemCode+ " UUID: "+this.uuid)
      }
    }else{
      this.itemCode=null;
      this.uuid=null;
    }
  }

  itemCode:string|null=null;
  uuid:string|null|undefined=null;

  recordingAsPlainText(){
    let t=null;
    if(this._recordingFile) {
      t = RecordingFileUtil.recordingAsPlainText(this._recordingFile);
    }
    return t;
  }
}
