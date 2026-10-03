/**
 * The draw rule’s live validation, kept pure so the specs can pin it without a component.
 *
 * Two rules from ui-spec §9 are encoded here:
 *  - when `matchCount` cannot be fetched the check is **suspended**, never passed: the message says
 *    the count is unknown and `count` is not treated as valid (the server re-checks at publish);
 *  - the count’s own bounds (E09) and the 999-item cap (E11) are read from the same catalogue as
 *    the checks panel, so the two never disagree.
 *
 * The findings come from the real catalogue functions, run over a one-item synthetic draft built
 * from the bank source — the same functions the editor and the server use, so E03/E04/E05/W04/W05
 * read identically here and in the checks panel.
 */
import type {BankItem, PrefillBankSource} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {
  checkE03,
  checkE04,
  checkE05,
  checkW04,
  checkW05,
  type BankLookup,
  type Draft,
  type Finding,
} from '../core/validation';
import {fillTemplate} from '../core/validation/interpolate';
import {BANK_STRINGS} from './bank-strings';

const V = EDITOR_STRINGS.validation;

/** What the panel knows about the drawn bank’s match for the current filter. */
export type CountsState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'ready'; matchCount: number; withoutAudio: number; items: BankItem[]}
  | {status: 'suspended'};

export interface CountValidation {
  kind: 'ok' | 'error' | 'suspended' | 'pending' | 'idle';
  message: string;
}

/** A one-item draft carrying the source, so `checkE04`/`checkW04`/`checkW05` can grade it. */
export function syntheticDraft(source: PrefillBankSource): Draft {
  return {
    sections: [{
      groups: [{
        promptItems: [{
          itemcode: `${source.itemcodePrefix}001`,
          mediaitems: [],
          prefill: {bank: source},
        }],
      }],
    }],
  };
}

/** E03, E04, E05, W04 and W05 for one bank source, with the catalogue’s exact wording/suspension. */
export function ruleFindings(source: PrefillBankSource, bankLookup: BankLookup): Finding[] {
  const draft = syntheticDraft(source);
  const context = {bankLookup};
  return [
    ...checkE03(draft, context),
    ...checkE04(draft, context),
    ...checkE05(draft),
    ...checkW04(draft, context),
    ...checkW05(draft, context),
  ];
}

/**
 * The live count line under the `count` field. `total` is the bank’s `itemCount` when the list
 * carries it; it is omitted (not invented) when it does not.
 */
export function countValidation(
  source: PrefillBankSource,
  counts: CountsState,
  total: number | undefined,
): CountValidation {
  const count = Number(source.count);
  if (!Number.isInteger(count) || count < 1) {
    return {kind: 'error', message: V.e09Count};
  }
  if (count > 999) {
    return {kind: 'error', message: V.e11Count};
  }
  switch (counts.status) {
    case 'idle':
      return {kind: 'idle', message: ''};
    case 'loading':
      return {kind: 'pending', message: BANK_STRINGS.rule.countPending};
    case 'suspended':
      // Never “valid”: the count is unknown, so the check is suspended (ui-spec §9).
      return {kind: 'suspended', message: V.e04Suspended};
    default:
      if (count > counts.matchCount) {
        return {kind: 'error', message: fillTemplate(V.e04, {matchCount: counts.matchCount})};
      }
      return {
        kind: 'ok',
        message: total === undefined
          ? fillTemplate(BANK_STRINGS.rule.countAgainstNoTotal, {match: counts.matchCount})
          : fillTemplate(EDITOR_STRINGS.inspector.group.countAgainst, {match: counts.matchCount, total}),
      };
  }
}
