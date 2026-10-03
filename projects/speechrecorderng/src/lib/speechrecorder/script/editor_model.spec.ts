/**
 * The editor's model additions (D-V = C, D-W = A): the playback modifier, the bank-source schema
 * and the rule that bank sources are resolved by the server, not by the client-side prefill.
 */
import {Bank, PrefillBankSource, PromptItem, Script} from './script';
import {ScriptPrefillUtil} from './prefill';

describe('editor model additions', () => {
  it('carries the playback modifier and a bank item trace through JSON', () => {
    const item: PromptItem = {
      itemcode: 'P1',
      mediaitems: [{mimetype: 'audio/wav', src: 'media/a.wav'}],
      playback: {when: 'DURING', headphones: true, repeats: 2, gap: 300, replayable: true, maxReplays: 3},
      bankItemId: 'sv-0147',
    };
    const roundTripped = JSON.parse(JSON.stringify(item)) as PromptItem;
    expect(roundTripped.playback).toEqual({when: 'DURING', headphones: true, repeats: 2, gap: 300, replayable: true, maxReplays: 3});
    expect(roundTripped.bankItemId).toBe('sv-0147');
  });

  it('describes a bank source and a bank', () => {
    const source: PrefillBankSource = {
      bank: 'std-passages',
      bankSource: 'BUILTIN',
      filter: {category: 'sentence', words: [6, 12], tags: ['balanced']},
      count: 2,
      itemcodePrefix: 'RB',
      playBankAudio: true,
      itemDefaults: {prerecdelay: 500, recduration: 5000},
    };
    expect(source.count).toBe(2);
    expect(source.filter?.words).toEqual([6, 12]);
    const bank: Bank = {bankId: 'std-passages', title: 'Standard passages', source: 'BUILTIN', shippedWith: '3.12'};
    expect(bank.source).toBe('BUILTIN');
  });

  it('leaves bank placeholders to the server-side resolution', () => {
    const script: Script = {
      sections: [{
        mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false,
        groups: [{
          order: 'SEQUENTIAL',
          promptItems: [
            {itemcode: 'L1', mediaitems: [], prefill: {source: 'sti-wordlists', select: 'random', itemcodeFormat: '{n}', mediaitems: []}},
            {itemcode: 'RB', mediaitems: [], prefill: {bank: {bank: 'std-passages', bankSource: 'BUILTIN', count: 2, itemcodePrefix: 'RB'}}},
          ],
          _shuffledPromptItems: [],
        }],
        _shuffledGroups: [],
      }],
    };
    expect(ScriptPrefillUtil.specs(script).map((spec) => spec.itemcode)).toEqual(['L1']);
  });
});
