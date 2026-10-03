import type {BankItem, PrefillBankSource} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {fillTemplate} from '../core/validation/interpolate';
import {countValidation, ruleFindings, syntheticDraft, type CountsState} from './bank-rule';

const RULE: PrefillBankSource = {
  bank: 'std-passages',
  bankSource: 'BUILTIN',
  filter: {category: 'sentence'},
  count: 3,
  order: 'RANDOM',
  fixedBy: 'SESSION',
  itemcodePrefix: 'RB',
};

const ITEMS: BankItem[] = [
  {bankItemId: 'std-001', text: 'One.', category: 'sentence', words: 7, tags: ['read'], audioSrc: 'media/a.wav'},
  {bankItemId: 'std-002', text: 'Two.', category: 'sentence', words: 6, tags: ['read']},
  {bankItemId: 'std-003', text: 'Three.', category: 'sentence', words: 5, tags: ['read']},
  {bankItemId: 'std-004', text: 'Four.', category: 'sentence', words: 5, tags: ['read']},
];

const READY: CountsState = {status: 'ready', matchCount: 4, withoutAudio: 3, items: ITEMS};
const V = EDITOR_STRINGS.validation;

describe('draw rule validation', () => {
  it('flags a count below one (E09) and above the 999 cap (E11)', () => {
    expect(countValidation({...RULE, count: 0}, READY, 6).message).toBe(V.e09Count);
    expect(countValidation({...RULE, count: 1.5}, READY, 6).message).toBe(V.e09Count);
    expect(countValidation({...RULE, count: 1000}, READY, 6).message).toBe(V.e11Count);
  });

  it('suspends the check when the bank could not be read and never calls the count valid', () => {
    const suspended = countValidation(RULE, {status: 'suspended'}, 6);

    expect(suspended.kind).toBe('suspended');
    expect(suspended.message).toBe(V.e04Suspended);
    expect(countValidation(RULE, {status: 'loading'}, 6).kind).toBe('pending');
  });

  it('checks count against matchCount and shows the bank’s total', () => {
    expect(countValidation({...RULE, count: 9}, READY, 6)).toEqual({
      kind: 'error',
      message: fillTemplate(V.e04, {matchCount: 4}),
    });
    expect(countValidation(RULE, READY, 6)).toEqual({
      kind: 'ok',
      message: fillTemplate(EDITOR_STRINGS.inspector.group.countAgainst, {match: 4, total: 6}),
    });
    expect(countValidation(RULE, READY, undefined).message).toBe('matches 4 items');
  });

  it('runs the real catalogue over a synthetic draft: E03, suspended E04, W04 and E05', () => {
    const draft = syntheticDraft(RULE);
    expect(draft.sections[0].groups[0].promptItems[0].prefill.bank).toEqual(RULE);

    expect(ruleFindings(RULE, () => null).map((finding) => finding.id)).toContain('E03');

    const suspended = ruleFindings(RULE, () => undefined);
    expect(suspended.find((finding) => finding.id === 'E04')?.suspended).toBe(true);

    const withAudio = ruleFindings({...RULE, playBankAudio: true}, () => ({bankId: 'std-passages', items: ITEMS}));
    expect(withAudio.map((finding) => finding.id)).toContain('W04');

    const noPrefix = ruleFindings({...RULE, itemcodePrefix: ''}, () => ({bankId: 'std-passages', items: ITEMS}));
    expect(noPrefix.map((finding) => finding.id)).toContain('E05');
  });
});
