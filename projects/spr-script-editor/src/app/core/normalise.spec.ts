/**
 * D7 fix specs (doc/script-editor/data-model.md §6): each fix changes the draft once and is
 * idempotent — applying it to its own result changes nothing.
 */
import {applyFix} from './normalise';
import type {Finding, ValidationContext} from './validation/types';
import {bankView, context, group, item, lookupOf, script, section} from './validation/test-helpers';

function finding(fix: Finding['fix'], path: string, data?: Record<string, unknown>): Finding {
  return {id: 'X', severity: 'error', path, message: '', fix, ...(data !== undefined ? {data} : {})};
}

const ITEM0 = 'sections[0].groups[0].promptItems[0]';

describe('E02 next free code', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({itemcode: 'a'}), item({itemcode: 'a'})]})]})]});
  const target = 'sections[0].groups[0].promptItems[1].itemcode';

  it('assigns a free code and does not mutate the input', () => {
    const result = applyFix(draft, finding('next-code', target));
    expect(result.changed).toBe(true);
    expect(result.draft.sections[0].groups[0].promptItems[1].itemcode).toBe('1');
    expect(draft.sections[0].groups[0].promptItems[1].itemcode).toBe('a');
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('next-code', target));
    const twice = applyFix(once.draft, finding('next-code', target));
    expect(twice.changed).toBe(false);
    expect(twice.draft).toEqual(once.draft);
  });
});

describe('E04 clamp count', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 5, itemcodePrefix: 'S', filter: {category: 'sentence'}}}}) ]})]})]});
  const ctx: ValidationContext = context({bankLookup: lookupOf({small: bankView('small', [{bankItemId: 's1', text: 'a', category: 'sentence'}, {bankItemId: 's2', text: 'b', category: 'sentence'}])})});
  const target = `${ITEM0}.prefill.bank.count`;

  it('clamps to matchCount', () => {
    const result = applyFix(draft, finding('clamp-count', target), ctx);
    expect(result.changed).toBe(true);
    expect(result.draft.sections[0].groups[0].promptItems[0].prefill.bank.count).toBe(2);
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('clamp-count', target), ctx);
    expect(applyFix(once.draft, finding('clamp-count', target), ctx).changed).toBe(false);
  });
});

describe('E05 free prefix', () => {
  const clash = script({sections: [section({groups: [group({promptItems: [
    item({itemcode: 'A', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}}),
    item({itemcode: 'B', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}}),
  ]})]})]});
  const target = 'sections[0].groups[0].promptItems[1].prefill.bank.itemcodePrefix';

  it('frees a clashing prefix', () => {
    const result = applyFix(clash, finding('free-prefix', target));
    expect(result.changed).toBe(true);
    expect(result.draft.sections[0].groups[0].promptItems[1].prefill.bank.itemcodePrefix).not.toBe('RB');
  });

  it('is idempotent', () => {
    const once = applyFix(clash, finding('free-prefix', target));
    expect(applyFix(once.draft, finding('free-prefix', target)).changed).toBe(false);
  });

  it('frees a fixed code that sits inside a reserved range', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [
      item({itemcode: 'RB002'}),
      item({itemcode: 'RB', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 5, itemcodePrefix: 'RB'}}}),
    ]})]})]});
    const codeTarget = 'sections[0].groups[0].promptItems[0].itemcode';
    const once = applyFix(draft, finding('free-prefix', codeTarget));
    expect(once.changed).toBe(true);
    expect(applyFix(once.draft, finding('free-prefix', codeTarget)).changed).toBe(false);
  });
});

describe('N01 rename legacy key', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({prerecording: 500})]})]})]});
  const target = `${ITEM0}.prerecording`;

  it('renames to the modern key', () => {
    const result = applyFix(draft, finding('rename-modern', target));
    expect(result.draft.sections[0].groups[0].promptItems[0].prerecdelay).toBe(500);
    expect(result.draft.sections[0].groups[0].promptItems[0].prerecording).toBeUndefined();
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('rename-modern', target));
    expect(applyFix(once.draft, finding('rename-modern', target)).changed).toBe(false);
  });
});

describe('N02 replace RANDOMIZED', () => {
  const draft = script({sections: [section({order: 'RANDOMIZED'})]});

  it('replaces with RANDOM (or the chosen order)', () => {
    expect(applyFix(draft, finding('replace-order', 'sections[0].order')).draft.sections[0].order).toBe('RANDOM');
    expect(applyFix(draft, finding('replace-order', 'sections[0].order'), {}, {order: 'SEQUENTIAL'}).draft.sections[0].order).toBe('SEQUENTIAL');
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('replace-order', 'sections[0].order'));
    expect(applyFix(once.draft, finding('replace-order', 'sections[0].order')).changed).toBe(false);
  });
});

describe('N06 convert promptUnits to groups', () => {
  const draft = {name: 'Legacy', sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, promptUnits: [{itemcode: 'I0', mediaitems: [{text: 'hi'}]}]}]};

  it('converts without losing the units', () => {
    const result = applyFix(draft, finding('convert-groups', 'sections[0]'));
    expect(result.changed).toBe(true);
    expect(result.draft.sections[0].promptUnits).toBeUndefined();
    expect(result.draft.sections[0].groups[0].promptItems[0].itemcode).toBe('I0');
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('convert-groups', 'sections[0]'));
    expect(applyFix(once.draft, finding('convert-groups', 'sections[0]')).changed).toBe(false);
  });
});

describe('W08 keep the first mediaitem', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: [{text: 'a'}, {text: 'b'}]})]})]})]});
  const target = `${ITEM0}.mediaitems`;

  it('keeps the first entry', () => {
    const result = applyFix(draft, finding('keep-first-mediaitem', target));
    expect(result.draft.sections[0].groups[0].promptItems[0].mediaitems).toEqual([{text: 'a'}]);
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('keep-first-mediaitem', target));
    expect(applyFix(once.draft, finding('keep-first-mediaitem', target)).changed).toBe(false);
  });
});

describe('E08 keep one side', () => {
  const draft = script({sections: [section({groups: [group({draw: {bank: 'small', count: 1}, promptItems: [item()]})]})]});

  it('keeps the list by default and the rule on request', () => {
    const list = applyFix(draft, finding('keep-one-side', 'sections[0].groups[0]'));
    expect(list.changed).toBe(true);
    expect(list.draft.sections[0].groups[0].draw).toBeUndefined();
    const rule = applyFix(draft, finding('keep-one-side', 'sections[0].groups[0]'), {}, {keep: 'rule'});
    expect(rule.draft.sections[0].groups[0].promptItems).toEqual([]);
  });

  it('is idempotent', () => {
    const once = applyFix(draft, finding('keep-one-side', 'sections[0].groups[0]'));
    expect(applyFix(once.draft, finding('keep-one-side', 'sections[0].groups[0]')).changed).toBe(false);
  });
});
