import {Component, input} from '@angular/core';
import type {Finding} from '../core/validation';
import {BANK_STRINGS} from './bank-strings';

/** The rule’s findings (E03–E05, W04, W05), with the suspended ones marked as such. */
@Component({
  selector: 'spre-draw-rule-findings',
  templateUrl: './draw-rule-findings.html',
  styleUrl: './draw-rule-findings.scss',
})
export class DrawRuleFindings {
  readonly strings = BANK_STRINGS;
  readonly errors = input.required<ReadonlyArray<Finding>>();
  readonly suspended = input.required<ReadonlyArray<Finding>>();
  readonly warnings = input.required<ReadonlyArray<Finding>>();
}
