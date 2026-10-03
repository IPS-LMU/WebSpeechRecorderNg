import type {PrefillBankSource} from 'speechrecorderng';
import type {BankView} from '../core/validation';
import {exampleDraw, previewCodes, reservedCode} from './example-draw';

const bank: BankView = {
  bankId: 'std',
  title: 'Standard',
  items: [
    {bankItemId: 's1', text: 'one', category: 'sentence'},
    {bankItemId: 's2', text: 'two', category: 'sentence'},
    {bankItemId: 's3', text: 'three', category: 'sentence'},
    {bankItemId: 's4', text: 'four', category: 'sentence'},
    {bankItemId: 's5', text: 'five', category: 'sentence'},
    {bankItemId: 's6', text: 'six', category: 'vowel'},
    {bankItemId: 's7', text: 'seven', category: 'sentence'},
    {bankItemId: 's8', text: 'eight', category: 'sentence'},
  ],
};

const source = (over: Partial<PrefillBankSource> = {}): PrefillBankSource => ({
  bank: 'std',
  bankSource: 'BUILTIN',
  count: 3,
  itemcodePrefix: 'RB',
  order: 'SEQUENTIAL',
  ...over,
});

describe('example draw: reserved codes', () => {
  it('pads to three digits', () => {
    expect(reservedCode('RB', 1)).toBe('RB001');
    expect(reservedCode('RB', 42)).toBe('RB042');
    expect(reservedCode('', 7)).toBe('007');
  });

  it('previews the codes a count reserves, capped at 999', () => {
    expect(previewCodes('RB', 3)).toEqual(['RB001', 'RB002', 'RB003']);
    expect(previewCodes('RB', 1000).length).toBe(999);
    expect(previewCodes('RB', 0)).toEqual([]);
  });
});

describe('example draw: determinism', () => {
  it('is deterministic for a sequential rule', () => {
    const first = exampleDraw(bank, source(), 0);
    const second = exampleDraw(bank, source(), 0);
    expect(first).toEqual(second);
    expect(first.map((item) => item.itemcode)).toEqual(['RB001', 'RB002', 'RB003']);
    expect(first.map((item) => item.text)).toEqual(['one', 'two', 'three']);
  });

  it('ignores the offset for a sequential rule', () => {
    expect(exampleDraw(bank, source(), 5)).toEqual(exampleDraw(bank, source(), 0));
  });

  it('is deterministic for a random rule and moves with the offset', () => {
    const rule = source({order: 'RANDOM'});
    expect(exampleDraw(bank, rule, 0)).toEqual(exampleDraw(bank, rule, 0));
    const first = exampleDraw(bank, rule, 0).map((item) => item.bankItemId);
    const next = exampleDraw(bank, rule, 1).map((item) => item.bankItemId);
    expect(next).not.toEqual(first);
    expect(new Set([...first, ...next]).size).toBeLessThanOrEqual(bank.items.length);
  });

  it('shows at most four items however large the draw is', () => {
    expect(exampleDraw(bank, source({count: 8})).length).toBe(4);
  });

  it('never draws more than the filter matches', () => {
    const example = exampleDraw(bank, source({count: 5, filter: {category: 'vowel'}}));
    expect(example.map((item) => item.text)).toEqual(['six']);
    expect(example.map((item) => item.itemcode)).toEqual(['RB001']);
  });

  it('returns nothing when the bank could not be read', () => {
    expect(exampleDraw(null, source())).toEqual([]);
    expect(exampleDraw(undefined, source())).toEqual([]);
  });
});
