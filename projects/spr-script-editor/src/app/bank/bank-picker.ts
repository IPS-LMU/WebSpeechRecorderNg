import {Component, input, output} from '@angular/core';
import type {Bank} from 'speechrecorderng';
import type {BankGroups} from './bank-model';
import {BANK_STRINGS} from './bank-strings';

/**
 * The grouped bank picker (ui-spec §6): “This project” and “Ships with SpeechRecorder”, each row
 * carrying its origin chip. Its own sheet keeps the bank screen’s component style under budget.
 */
@Component({
  selector: 'spre-bank-picker',
  templateUrl: './bank-picker.html',
  styleUrl: './bank-picker.scss',
})
export class BankPicker {
  readonly strings = BANK_STRINGS;

  readonly groups = input.required<BankGroups>();
  readonly selectedBankId = input<string | null>(null);
  readonly select = output<Bank>();
}
