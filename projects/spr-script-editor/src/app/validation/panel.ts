/**
 * The checks panel's view model (ui-spec §5, validation.md). Pure functions turn a `Finding` plus
 * the draft and the source line map into the card the panel renders: severity group, `line ·
 * subject`, the consequence sentence, the deep link and the one-click fix choices.
 */
import type {FixOptions} from '../core/normalise';
import type {Draft, Finding, Severity} from '../core/validation/types';
import {formatSelection, selectionFromPath, subjectOf} from './paths';

export interface FixChoice {
  /** The button label, or the radio label when more than one choice is offered. */
  label: string;
  options: FixOptions;
}

export interface CheckCard {
  finding: Finding;
  /** The group the card is listed under; a suspended error is a warning (ui-spec §9). */
  severity: Severity;
  /** 1-based line in the source text, or `null` when the path has no line. */
  line: number | null;
  subject: string;
  /** One sentence saying what goes wrong if the finding is ignored. */
  consequence: string;
  /** `routerLink` commands into the editor, or `null` when the route cannot be built. */
  link: ReadonlyArray<string> | null;
  linkQuery: Record<string, string> | null;
  /** Data fixes from `normalise.ts`; empty for the UI kinds (`focus`, `bank-picker`, `file-picker`). */
  choices: FixChoice[];
  /** True when the finding came back from the server (`details.checks`), not from the catalogue. */
  server: boolean;
}

const DATA_FIX_LABELS: Partial<Record<NonNullable<Finding['fix']>, string>> = {
  'add-group': 'Add the missing group',
  'next-code': 'Use the next free code',
  'clamp-count': 'Set count to the match count',
  'free-prefix': 'Suggest a free prefix',
  'rename-modern': 'Rename to the modern key',
  'convert-groups': 'Convert to groups',
  'keep-first-mediaitem': 'Keep the first media item',
};

/** True when `fix` is one `normalise.ts` can apply to the draft (not a UI navigation action). */
export function isDataFix(fix: Finding['fix']): boolean {
  return fix !== undefined && fix in DATA_FIX_LABELS;
}

/** The one-click fix buttons a finding offers. `replace-order`/`keep-one-side` offer a choice (D7). */
export function fixChoices(finding: Finding): FixChoice[] {
  if (finding.fix === 'replace-order') {
    return [
      {label: 'Use Random', options: {order: 'RANDOM'}},
      {label: 'Use Sequential', options: {order: 'SEQUENTIAL'}},
    ];
  }
  if (finding.fix === 'keep-one-side') {
    return [
      {label: 'Keep the fixed list', options: {keep: 'list'}},
      {label: 'Keep the draw rule', options: {keep: 'rule'}},
    ];
  }
  if (isDataFix(finding.fix)) {
    return [{label: DATA_FIX_LABELS[finding.fix as keyof typeof DATA_FIX_LABELS] ?? 'Fix', options: {}}];
  }
  return [];
}

export interface CardContext {
  draft: Draft;
  lineOf: (path: string) => number | null;
  project: string;
  scriptId: string;
  server: boolean;
}

/** Builds the card for one finding. */
export function cardFor(finding: Finding, context: CardContext): CheckCard {
  const severity: Severity = finding.suspended === true ? 'warning' : finding.severity;
  const selection = selectionFromPath(finding.path);
  const hasRoute = context.project !== '' && context.scriptId !== '';
  return {
    finding,
    severity,
    line: context.lineOf(finding.path),
    subject: subjectOf(context.draft, finding.path),
    consequence: finding.message,
    link: hasRoute ? ['/project', context.project, 'script', context.scriptId, 'edit'] : null,
    linkQuery: hasRoute ? {sel: formatSelection(selection)} : null,
    choices: fixChoices(finding),
    server: context.server,
  };
}

/** Groups cards by the group they are shown under, in error → warning → note order. */
export function groupCards(cards: ReadonlyArray<CheckCard>): Array<{severity: Severity; cards: CheckCard[]}> {
  return (['error', 'warning', 'note'] as Severity[])
    .map((severity) => ({severity, cards: cards.filter((card) => card.severity === severity)}))
    .filter((group) => group.cards.length > 0);
}
