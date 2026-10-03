import {Component, input, output} from '@angular/core';
import type {BankItem} from 'speechrecorderng';
import {bankItemText, usedInSessions} from './bank-model';
import {BANK_STRINGS} from './bank-strings';

/**
 * The bank item table with its pagination footer (ui-spec §6). It owns no data: the browser passes
 * the page and receives edit/delete/audition/upload intents, so the write path stays in one place.
 */
@Component({
  selector: 'spre-bank-item-table',
  templateUrl: './bank-item-table.html',
  styleUrl: './bank-item-table.scss',
})
export class BankItemTable {
  readonly strings = BANK_STRINGS;

  readonly items = input.required<ReadonlyArray<BankItem>>();
  readonly pageText = input.required<string>();
  readonly canPrev = input(false);
  readonly canNext = input(false);
  readonly showUsed = input(false);
  readonly canEdit = input(false);
  readonly uploadingId = input<string | null>(null);
  readonly auditionError = input<string | null>(null);
  readonly confirmingDelete = input<string | null>(null);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly edit = output<BankItem>();
  readonly remove = output<BankItem>();
  readonly cancelDelete = output<void>();
  readonly audition = output<BankItem>();
  readonly upload = output<{item: BankItem; file: File}>();

  readonly itemText = bankItemText;
  readonly usedCount = usedInSessions;

  onUpload(item: BankItem, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const file = event.target.files?.[0];
    if (file !== undefined) {
      this.upload.emit({item, file});
    }
  }
}
