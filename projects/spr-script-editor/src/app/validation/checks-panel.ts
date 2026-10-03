/**
 * The checks panel (ui-spec §5, validation.md): severity groups, one card per finding with
 * `line · subject`, the consequence, and either a deep link into the editor or the catalogue's
 * one-click fix. Server-returned `details.checks` findings (B3) render through the same cards, so
 * a publish-time race looks like any other finding.
 *
 * Shared by the JSON source screen and any editor warning surface; it holds no state of its own.
 */
import {Component, computed, input, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import type {FixOptions} from '../core/normalise';
import {fillTemplate} from '../core/validation/interpolate';
import type {Draft, Finding, Severity} from '../core/validation/types';
import {CHECKS_STRINGS} from './checks-strings';
import {cardFor, groupCards, type CardContext, type CheckCard, type FixChoice} from './panel';

export interface FixRequest {
  finding: Finding;
  options: FixOptions;
}

const SEVERITY_KEYS: Record<Severity, 'errorWord' | 'warningWord' | 'noteWord'> = {
  error: 'errorWord',
  warning: 'warningWord',
  note: 'noteWord',
};

const COUNT_KEYS: Record<Severity, 'errorsLabel' | 'warningsLabel' | 'notesLabel'> = {
  error: 'errorsLabel',
  warning: 'warningsLabel',
  note: 'notesLabel',
};

@Component({
  selector: 'spre-checks-panel',
  imports: [RouterLink],
  templateUrl: './checks-panel.html',
  styleUrl: './checks-panel.scss',
})
export class ChecksPanel {
  readonly clientFindings = input<ReadonlyArray<Finding>>([]);
  readonly serverFindings = input<ReadonlyArray<Finding>>([]);
  readonly draft = input<Draft>(null);
  readonly lineOf = input<(path: string) => number | null>(() => null);
  readonly project = input('');
  readonly scriptId = input('');

  readonly fix = output<FixRequest>();

  readonly strings = CHECKS_STRINGS;

  readonly cards = computed<CheckCard[]>(() => {
    const context = (server: boolean): CardContext => ({
      draft: this.draft(),
      lineOf: this.lineOf(),
      project: this.project(),
      scriptId: this.scriptId(),
      server,
    });
    return [
      ...this.clientFindings().map((finding) => cardFor(finding, context(false))),
      ...this.serverFindings().map((finding) => cardFor(finding, context(true))),
    ];
  });

  readonly groups = computed(() => groupCards(this.cards()));

  readonly counts = computed<Record<Severity, number>>(() => {
    const counts: Record<Severity, number> = {error: 0, warning: 0, note: 0};
    for (const card of this.cards()) {
      counts[card.severity]++;
    }
    return counts;
  });

  readonly severities: Severity[] = ['error', 'warning', 'note'];

  severityWord(severity: Severity): string {
    return this.strings[SEVERITY_KEYS[severity]];
  }

  countLabel(severity: Severity): string {
    return fillTemplate(this.strings[COUNT_KEYS[severity]], {count: this.counts()[severity]});
  }

  lineText(card: CheckCard): string {
    return card.line === null ? this.strings.noLine : fillTemplate(this.strings.lineLabel, {line: card.line});
  }

  apply(card: CheckCard, choice: FixChoice): void {
    this.fix.emit({finding: card.finding, options: choice.options});
  }
}
