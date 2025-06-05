import {Component, Inject} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

@Component({
    selector: 'msg-dialog',
    template: `<h1 mat-dialog-title>@if (data.type==='error') {
  <mat-icon [style.color]="'red'">error</mat-icon>
}
@if (data.type==='warning') {
  <mat-icon [style.color]="'yellow'">warning</mat-icon>
}{{data.title}}</h1>
<div mat-dialog-content>

  <p>{{data.msg}}</p>
  <p>{{data.advice}}</p>

</div>
<div mat-dialog-actions>
  <button mat-button (click)="closeDialog()">OK</button>
</div>
`,
    standalone: false
})
export class MessageDialog{

  constructor(
    public dialogRef: MatDialogRef<MessageDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  closeDialog(): void {
    this.dialogRef.close();
  }

}
