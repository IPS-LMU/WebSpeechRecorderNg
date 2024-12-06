
import {Component, Inject} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {RecordingFile} from "../../recording";


@Component({
    selector: 'spr-recording-file-delete-confirm-dialog',
    template: `<h1 mat-dialog-title><mat-icon [style.color]="'red'">delete_force</mat-icon> Delete recording file?</h1>
  <div mat-dialog-content>

    <p>Really delete recording file {{data.recordingFileId}}?</p>
    <p>Delete action cannot be undone.</p>
  </div>
  <div mat-dialog-actions>
    <button mat-button [mat-dialog-close]="null">Cancel</button>
    <button mat-button [style.color]="'red'" [mat-dialog-close]="data">Delete</button>
  </div>
  `,
    standalone: false
})


export class RecordingFileDeleteConfirmDialog{

  constructor(
    public dialogRef: MatDialogRef<RecordingFileDeleteConfirmDialog>,
    @Inject(MAT_DIALOG_DATA) public data: RecordingFile) { }

}
