import {Component, input, output} from '@angular/core';
import type {BankItemEdit} from './bank-model';
import {BANK_STRINGS} from './bank-strings';

/** The inline item editor form (ui-spec §6, project banks only). */
@Component({
  selector: 'spre-bank-item-form',
  templateUrl: './bank-item-form.html',
  styleUrl: './bank-item-form.scss',
})
export class BankItemForm {
  readonly strings = BANK_STRINGS;

  readonly edit = input.required<BankItemEdit>();
  readonly saving = input(false);

  readonly save = output<void>();
  readonly cancel = output<void>();
  readonly field = output<{name: 'text' | 'category' | 'words' | 'tags'; value: string}>();
}
