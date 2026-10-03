import {Component, input, output} from '@angular/core';
import type {BankFilterFields} from './bank-model';
import {BANK_STRINGS} from './bank-strings';

/**
 * The bank filter controls (ui-spec §6), shared by the browse filter and the rule filter so their
 * markup and styling cannot drift. `variant` (`browse-filter` / `rule-filter`) marks which one it
 * is, and `idPrefix` keeps the two sets of field ids apart when both are on screen.
 */
@Component({
  selector: 'spre-bank-filter',
  templateUrl: './bank-filter-form.html',
  styleUrl: './bank-filter-form.scss',
})
export class BankFilterForm {
  readonly strings = BANK_STRINGS;

  readonly legend = input.required<string>();
  readonly hint = input<string>('');
  readonly fields = input.required<BankFilterFields>();
  readonly variant = input<string>('');
  readonly idPrefix = input.required<string>();
  readonly showClear = input(false);

  readonly fieldChange = output<{name: keyof BankFilterFields; value: string}>();
  readonly clear = output<void>();

  set(name: keyof BankFilterFields, value: string): void {
    this.fieldChange.emit({name, value});
  }
}
