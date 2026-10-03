/**
 * One `describe` per error id (E01–E11), each with the clean case and the triggering case
 * (doc/script-editor/validation.md).
 */
import {
  checkE01, checkE02, checkE03, checkE04, checkE05, checkE06, checkE07, checkE08,
  checkE09, checkE10, checkE11, runChecks,
} from './index';
import {bankView, context, group, ids, item, lookupOf, paths, script, section} from './test-helpers';

const ITEM0 = 'sections[0].groups[0].promptItems[0]';
const BASE = `${ITEM0}.prefill.bank`;

describe('E01 itemcode required', () => {
  it('is clean when the itemcode is set', () => {
    expect(checkE01(script())).toEqual([]);
  });
  it('flags an empty or whitespace itemcode', () => {
    const findings = checkE01(script({sections: [section({groups: [group({promptItems: [item({itemcode: '  '})]})]})]}));
    expect(ids(findings)).toEqual(['E01']);
    expect(paths(findings)).toEqual([`${ITEM0}.itemcode`]);
    expect(findings[0].fix).toBe('focus');
  });
});

describe('E02 duplicate itemcode', () => {
  it('is clean when codes are distinct', () => {
    expect(checkE02(script({sections: [section({groups: [group({promptItems: [item({itemcode: 'a'}), item({itemcode: 'b'})]})]})]}))).toEqual([]);
  });
  it('flags the second occurrence', () => {
    const findings = checkE02(script({sections: [section({groups: [group({promptItems: [item({itemcode: 'a'}), item({itemcode: 'a'})]})]})]}));
    expect(ids(findings)).toEqual(['E02']);
    expect(paths(findings)).toEqual(['sections[0].groups[0].promptItems[1].itemcode']);
    expect(findings[0].fix).toBe('next-code');
  });
});

describe('E03 bank chosen', () => {
  it('is clean when the bank resolves', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}})]})]})]});
    expect(checkE03(draft, context({bankLookup: lookupOf({small: bankView('small', [])})}))).toEqual([]);
  });
  it('flags a bank source that names no bank', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: '', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}})]})]})]});
    const findings = checkE03(draft);
    expect(paths(findings)).toEqual([`${BASE}.bank`]);
    expect(findings[0].fix).toBe('bank-picker');
  });
  it('flags a bank that does not exist', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'ghost', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}})]})]})]});
    expect(ids(checkE03(draft, context({bankLookup: lookupOf({})})))).toEqual(['E03']);
  });
});

describe('E04 count exceeds matchCount', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({itemcode: 'S', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 5, itemcodePrefix: 'S', filter: {category: 'sentence'}}}}) ]})]})]});
  const banks = {small: bankView('small', [{bankItemId: 's1', text: 'ett', category: 'sentence'}, {bankItemId: 's2', text: 'två', category: 'sentence'}])};
  it('is clean when the count fits the filter', () => {
    const fits = script({sections: [section({groups: [group({promptItems: [item({itemcode: 'S', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 2, itemcodePrefix: 'S', filter: {category: 'sentence'}}}}) ]})]})]});
    expect(checkE04(fits, context({bankLookup: lookupOf(banks)}))).toEqual([]);
  });
  it('flags a count above the matchCount', () => {
    const findings = checkE04(draft, context({bankLookup: lookupOf(banks)}));
    expect(ids(findings)).toEqual(['E04']);
    expect(paths(findings)).toEqual([`${BASE}.count`]);
    expect(findings[0].message).toContain('2');
    expect(findings[0].fix).toBe('clamp-count');
  });
  it('suspends when the bank cannot be read', () => {
    const findings = checkE04(draft, context({bankLookup: () => undefined}));
    expect(findings.length).toBe(1);
    expect(findings[0].suspended).toBe(true);
    expect(findings[0].severity).toBe('warning');
  });
});

describe('E05 reserved ranges', () => {
  it('is clean when no fixed code falls in the range', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({itemcode: 'X9', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 2, itemcodePrefix: 'RB'}}})]})]})]});
    expect(checkE05(draft)).toEqual([]);
  });
  it('flags a fixed code inside the reserved range', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({itemcode: 'RB002'}), item({itemcode: 'RB', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 5, itemcodePrefix: 'RB'}}})]})]})]});
    const findings = checkE05(draft);
    expect(paths(findings)).toContain('sections[0].groups[0].promptItems[0].itemcode');
  });
  it('flags two bank sources sharing a prefix', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [
      item({itemcode: 'A', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}}),
      item({itemcode: 'B', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}}),
    ]})]})]});
    expect(paths(checkE05(draft))).toEqual(['sections[0].groups[0].promptItems[1].prefill.bank.itemcodePrefix']);
  });
});

describe('E06 playback without a file', () => {
  it('is clean when the playback has an audio mediaitem', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}, mediaitems: [{mimetype: 'audio/wav', src: 'media/a.wav'}]})]})]})]});
    expect(checkE06(draft)).toEqual([]);
  });
  it('flags playback with no audio mediaitem', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}})]})]})]});
    expect(paths(checkE06(draft))).toEqual([`${ITEM0}.playback`]);
  });
});

describe('E07 empty item', () => {
  it('is clean when the first mediaitem shows something', () => {
    expect(checkE07(script())).toEqual([]);
  });
  it('flags an item that shows nothing and plays nothing', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: []})]})]})]});
    expect(paths(checkE07(draft))).toEqual([`${ITEM0}.mediaitems`]);
  });
});

describe('E08 retired', () => {
  it('never fires (D-W made the condition unrepresentable)', () => {
    expect(checkE08()).toEqual([]);
  });
});

describe('E09 timing and count', () => {
  it('is clean for non-negative numbers', () => {
    expect(checkE09(script({sections: [section({groups: [group({promptItems: [item({prerecdelay: 0, recduration: 100})]})]})]}))).toEqual([]);
  });
  it('flags a negative delay and a non-numeric duration', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prerecdelay: -1, recduration: '8000'})]})]})]});
    expect(paths(checkE09(draft))).toEqual([`${ITEM0}.prerecdelay`, `${ITEM0}.recduration`]);
  });
  it('flags a draw count below one', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 0, itemcodePrefix: 'RB'}}})]})]})]});
    expect(paths(checkE09(draft))).toEqual([`${BASE}.count`]);
  });
});

describe('E10 sections and groups', () => {
  it('is clean with one section and one group', () => {
    expect(checkE10(script())).toEqual([]);
  });
  it('flags a script with no section', () => {
    expect(paths(checkE10({sections: []}))).toEqual(['sections']);
  });
  it('flags a section with no group', () => {
    const draft = script({sections: [section({groups: []})]});
    expect(paths(checkE10(draft))).toEqual(['sections[0].groups']);
  });
});

describe('E11 playback and view-box bounds', () => {
  it('is clean for sane numbers', () => {
    const draft = script({virtualViewBox: {height: 720}, sections: [section({groups: [group({promptItems: [item({playback: {repeats: 1, gap: 0, maxReplays: 0}})]})]})]});
    expect(checkE11(draft)).toEqual([]);
  });
  it('flags repeats below one and a negative gap', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {repeats: 0, gap: -5}})]})]})]});
    expect(paths(checkE11(draft))).toEqual([`${ITEM0}.playback.repeats`, `${ITEM0}.playback.gap`]);
  });
  it('flags a non-positive view box height', () => {
    expect(paths(checkE11(script({virtualViewBox: {height: 0}})))).toEqual(['virtualViewBox.height']);
  });
  it('flags a draw count above 999', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1000, itemcodePrefix: 'RB'}}})]})]})]});
    expect(paths(checkE11(draft))).toEqual([`${BASE}.count`]);
  });
});

describe('the clean script', () => {
  it('produces no findings at all', () => {
    expect(runChecks(script())).toEqual([]);
  });
});
