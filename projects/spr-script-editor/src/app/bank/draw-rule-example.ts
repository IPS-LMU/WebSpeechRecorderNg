import {Component, input, output} from '@angular/core';
import {EDITOR_STRINGS} from '../core/editor-strings';
import type {ExampleDrawItem} from '../editor/example-draw';
import {BANK_STRINGS} from './bank-strings';

/** The labelled example draw (ui-spec §6, D-J): an example, never the session’s draw. */
@Component({
  selector: 'spre-draw-rule-example',
  templateUrl: './draw-rule-example.html',
  styleUrl: './draw-rule-example.scss',
})
export class DrawRuleExample {
  readonly strings = BANK_STRINGS;
  readonly catalogue = EDITOR_STRINGS;

  readonly example = input.required<ReadonlyArray<ExampleDrawItem>>();
  readonly drawAnother = output<void>();
}
