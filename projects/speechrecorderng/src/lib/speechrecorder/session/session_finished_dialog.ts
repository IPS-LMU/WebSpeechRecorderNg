import {Component, Inject} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {SprTranslator} from "../../i18n/translate";

/**
 * Data handed to the completion dialog. A session that may export its recordings passes
 * `exportRecordings`; it resolves to `'exported'` (a download happened), `'none'` (nothing to
 * export) and rejects on failure.
 */
export interface SessionFinishedDialogData {
  exportRecordings?: () => Promise<'exported' | 'none'>;
}

@Component({
    selector: 'spr-session-finished-dialog',
    template: `<h1 mat-dialog-title class="spr-dialog-title"><span class="spr-dialog-icon ok"><mat-icon>done_all</mat-icon></span> {{i18n.t('spr.session.finishedTitle')}}</h1>
  <div mat-dialog-content>

    <p>{{i18n.t('spr.session.finishedBody')}}</p>

    @if (exportStatus === 'done') {
      <p class="spr-session-export-status">{{i18n.t('spr.session.exportDone')}}</p>
    }
    @if (exportStatus === 'none') {
      <p class="spr-session-export-status">{{i18n.t('spr.session.exportNone')}}</p>
    }
    @if (exportStatus === 'error') {
      <p class="spr-session-export-status spr-session-export-error">{{i18n.t('spr.session.exportError')}}</p>
    }

  </div>
  <div mat-dialog-actions>
    @if (data.exportRecordings) {
      <button mat-stroked-button (click)="exportRecordings()" [disabled]="exportStatus === 'exporting'">
        {{ exportStatus === 'exporting' ? i18n.t('spr.session.exportInProgress') : i18n.t('spr.session.exportRecordings') }}
      </button>
    }
    <button mat-flat-button color="primary" (click)="closeDialog()">{{i18n.t('spr.dialog.ok')}}</button>
  </div>
  `,
    styles: [`:host {
    display: block;
    color: var(--spr-ink, #1F3044);
  }`, `
    .spr-dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--spr-type-section, 17.28px);
      font-weight: 700;
      color: var(--spr-ink-strong, #1C3660);
    }

    .spr-dialog-icon {
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
      width: 32px;
      height: 32px;
      border-radius: var(--spr-r-md, 12px);
    }

    /* Ink on the complement colours is black (Umeå brand rule). */
    .spr-dialog-icon.ok {
      background: var(--spr-ok, #73A790);
      color: var(--spr-ok-ink, #000000);
    }

    .spr-dialog-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .spr-session-export-status {
      margin: 8px 0 0;
      color: var(--spr-ink-muted, #4A6288);
      font-size: var(--spr-type-caption, 13.6px);
    }

    .spr-session-export-error {
      color: var(--spr-alert-ink, #000000);
    }
  `],
    standalone: false
})
export class SessionFinishedDialog{

  exportStatus: 'idle' | 'exporting' | 'done' | 'none' | 'error' = 'idle';

  constructor(
    public dialogRef: MatDialogRef<SessionFinishedDialog>,
    @Inject(MAT_DIALOG_DATA) public data: SessionFinishedDialogData,
    public readonly i18n: SprTranslator) {}

  closeDialog(): void {
    this.dialogRef.close();
  }

  async exportRecordings(): Promise<void> {
    if (this.exportStatus === 'exporting' || !this.data?.exportRecordings) {
      return;
    }
    this.exportStatus = 'exporting';
    try {
      const result = await this.data.exportRecordings();
      this.exportStatus = result === 'none' ? 'none' : 'done';
    } catch {
      this.exportStatus = 'error';
    }
  }

}
