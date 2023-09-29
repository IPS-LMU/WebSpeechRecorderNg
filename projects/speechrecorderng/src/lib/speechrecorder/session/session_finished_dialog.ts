
import {Component, Inject} from "@angular/core";
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from "@angular/material/legacy-dialog";

@Component({
  selector: 'spr-session-finished-dialog',
  template: `<h1 mat-dialog-title><mat-icon [style.color]="'green'">done_all</mat-icon> Session finished</h1>
  <div mat-dialog-content>

    <p>Thank you! The recording session is complete.</p>

  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="closeDialog()">OK</button>
  </div>
  `
})
export class SessionFinishedDialog{

  constructor(
    public dialogRef: MatDialogRef<SessionFinishedDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  closeDialog(): void {
    this.dialogRef.close();
  }

}
