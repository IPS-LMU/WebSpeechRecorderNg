import type {PrefillBankSource} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {
  BANK_MOCK_SRC_PREFIX,
  drawSeed,
  drawnItemcode,
  exampleDraw,
  isDrawnPlaceholder,
  mulberry32,
  shuffle,
} from './preview-draw';

const BANK: PrefillBankSource = {
  bank: 'std-passages',
  bankSource: 'BUILTIN',
  count: 3,
  itemcodePrefix: 'D',
  playBankAudio: true,
  playback: {when: 'DURING', replayable: true, maxReplays: 1},
  itemDefaults: {prerecdelay: 1000, recduration: 5000, postrecdelay: 500},
};

const TEMPLATE = [{mimetype: 'text/plain', text: 'Repeat the vowel {entry} after the model.'}];

describe('preview example draw', () => {
  it('generates `count` items with the itemcode prefix the model documents', () => {
    const draw = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE);

    expect(draw.map((example) => example.itemcode)).toEqual(['D001', 'D002', 'D003']);
    expect(draw[0].item.mediaitems[0].text).toBe(`Repeat the vowel ${draw[0].entry} after the model.`);
    expect(draw[0].item.mediaitems[0].text).not.toContain('{entry}');
  });

  it('takes its entries from the shared example pool, without repeats', () => {
    const draw = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE);
    const pool = EDITOR_STRINGS.preview.exampleEntries as readonly string[];

    expect(draw.every((example) => pool.includes(example.entry))).toBe(true);
    expect(new Set(draw.map((example) => example.entry)).size).toBe(3);
  });

  it('is deterministic: the same position and generation draw the same example', () => {
    const first = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE);
    const again = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE);

    expect(again).toEqual(first);
  });

  it('re-draws: the next generation gives a different, still deterministic example', () => {
    const generation0 = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE).map((example) => example.entry);
    const generation1 = exampleDraw(BANK, 'playback', 3, 0, 0, 1, TEMPLATE).map((example) => example.entry);
    const repeat = exampleDraw(BANK, 'playback', 3, 0, 0, 1, TEMPLATE).map((example) => example.entry);

    expect(generation1).not.toEqual(generation0);
    expect(repeat).toEqual(generation1);
    expect(new Set(generation1).size).toBe(3);
  });

  it('seeds every coordinate of the draw differently', () => {
    const base = drawSeed('playback', 3, 0, 0, 0);

    expect(drawSeed('playback', 3, 0, 0, 1)).not.toBe(base);
    expect(drawSeed('playback', 3, 0, 1, 0)).not.toBe(base);
    expect(drawSeed('playback', 3, 1, 0, 0)).not.toBe(base);
    expect(drawSeed('other', 3, 0, 0, 0)).not.toBe(base);
    expect(drawSeed(undefined, 3, 0, 0, 0)).not.toBe(base);
  });

  it('leaves the placeholder template untouched', () => {
    const template = [{mimetype: 'text/plain', text: 'Item {entry}.'}];

    exampleDraw(BANK, 'playback', 3, 0, 0, 0, template);

    expect(template[0].text).toBe('Item {entry}.');
  });

  it('marks the bank model recording and carries the bank timing', () => {
    const item = exampleDraw(BANK, 'playback', 3, 0, 0, 0, TEMPLATE)[0].item;
    const audio = item.mediaitems.find((mediaitem) => mediaitem.mimetype === 'audio/wav');

    expect(audio?.src).toBe(`${BANK_MOCK_SRC_PREFIX}std-passages`);
    expect(item.prerecdelay).toBe(1000);
    expect(item.recduration).toBe(5000);
    expect(item.postrecdelay).toBe(500);
    expect(item.playback).toEqual(BANK.playback);
  });

  it('adds no model recording when the bank does not play one', () => {
    const item = exampleDraw({...BANK, playBankAudio: false}, 'playback', 3, 0, 0, 0, TEMPLATE)[0].item;

    expect(item.mediaitems.some((mediaitem) => mediaitem.mimetype === 'audio/wav')).toBe(false);
  });

  it('clamps a nonsense count to at least one item', () => {
    expect(exampleDraw({...BANK, count: 0}, 'playback', 3, 0, 0, 0, TEMPLATE)).toHaveSize(1);
    expect(exampleDraw({...BANK, count: -4}, 'playback', 3, 0, 0, 0, TEMPLATE)).toHaveSize(1);
    expect(exampleDraw({...BANK, count: 2.7}, 'playback', 3, 0, 0, 0, TEMPLATE)).toHaveSize(2);
  });

  it('wraps the pool when the draw is larger than it', () => {
    const draw = exampleDraw({...BANK, count: 12}, 'playback', 3, 0, 0, 0, TEMPLATE);

    expect(draw).toHaveSize(12);
    expect(new Set(draw.map((example) => example.entry)).size).toBe(EDITOR_STRINGS.preview.exampleEntries.length);
    expect(new Set(draw.map((example) => example.itemcode)).size).toBe(12);
  });

  it('pads itemcodes to three digits and keeps the prefix', () => {
    expect(drawnItemcode({itemcodePrefix: 'RB'}, 0)).toBe('RB001');
    expect(drawnItemcode({itemcodePrefix: ''}, 9)).toBe('010');
  });

  it('shuffles to a permutation of the input, reproducibly', () => {
    const values = ['a', 'b', 'c', 'd'];
    const shuffled = shuffle(values, mulberry32(drawSeed('x', 0, 0, 0, 0)));

    expect(shuffled).not.toBe(values);
    expect([...shuffled].sort()).toEqual([...values].sort());
    expect(shuffle(values, mulberry32(drawSeed('x', 0, 0, 0, 0)))).toEqual(shuffled);
    expect(values).toEqual(['a', 'b', 'c', 'd']);
  });

  it('recognises a bank placeholder and nothing else', () => {
    expect(isDrawnPlaceholder({mediaitems: [], prefill: {bank: BANK}})).toBe(true);
    expect(isDrawnPlaceholder({mediaitems: [], prefill: {source: 'list-1'}})).toBe(false);
    expect(isDrawnPlaceholder({mediaitems: []})).toBe(false);
    expect(isDrawnPlaceholder(null)).toBe(false);
  });
});
