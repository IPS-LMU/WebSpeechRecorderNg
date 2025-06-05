import {Component, Input} from '@angular/core';
import {RecordingFileUtil} from "./recording-file";
import {SprRecordingFile} from "../../recording";

@Component({
    selector: 'app-recording-file-meta',
    template: `
    <mat-card appearance="outlined">
      <mat-card-title>Recording file ID: {{recordingFile?.recordingFileId}}</mat-card-title>
      <mat-card-content>
        @if (stateLoading) {
          <mat-progress-spinner mode="indeterminate" [diameter]="20"></mat-progress-spinner>
        }
        <table>
          @if (itemCode) {
            <tr>
              <td>Itemcode:</td>
              <td>{{itemCode}}</td>
            </tr>
          }
          @if (uuid && !itemCode) {
            <tr>
              <td>UUID:</td>
              <td>{{uuid}}</td>
            </tr>
          }
          @if (recordingFile?.startedDate) {
            <tr>
              <td>Started:</td>
              <td>{{recordingFile?.startedDate}}</td>
            </tr>
          }
          @if (!recordingFile?.startedDate && recordingFile?.date) {
            <tr>
              <td>Date:</td>
              <td>{{recordingFile?.date}}</td>
            </tr>
          }
          @if (itemCode) {
            <tr>
              <td>Prompt:</td>
              <td>{{recordingAsPlainText()}}</td>
            </tr>
          }
    
          @if (sessionId) {
            <tr>
              <td>Session:</td>
              <td>{{sessionId}}</td>
            </tr>
          }
        </table>
      </mat-card-content>
    </mat-card>
    `,
    styles: [],
    standalone: false
})
export class RecordingFileMetaComponent{


  @Input() sessionId:string | number | null=null;

  private _recordingFile:SprRecordingFile|null=null;

  @Input() stateLoading:boolean;

  constructor() {
    this.stateLoading=false;
  }

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
