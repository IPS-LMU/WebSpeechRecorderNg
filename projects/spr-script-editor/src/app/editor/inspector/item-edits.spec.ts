/**
 * The inspector's pure mappings (ui-spec §3.3). These are the values the component hands to
 * `ScriptDraftService`, so they are asserted without a browser: the kind transform that must keep
 * an audio mediaitem, the itemcode validation that must agree with the catalogue, and the group
 * Split that must not lose items.
 */
import type {Bank, Mediaitem, PromptItem} from 'speechrecorderng';
import type {EditorScript} from '../../core/script.model';
import {
  audioMediaIndex,
  bankPlaceholder,
  defaultBankSource,
  fixedItemsFromDrawn,
  itemcodeFindings,
  listCodePreview,
  prefillKindOf,
  promptDocFromText,
  promptMediaIndex,
  setPromptMediaKind,
  splitGroupItems,
  withAudioMedia,
  withInstructions,
  withPlayback,
} from './item-edits';

const textItem = (code: string): PromptItem => ({
  itemcode: code,
  mediaitems: [{mimetype: 'text/plain', text: `${code} prompt`}],
});

const scriptOf = (items: PromptItem[], extra: Partial<EditorScript> = {}): EditorScript => ({
  name: 'S',
  sections: [{name: 'A', mode: 'MANUAL', promptphase: 'RECORDING', groups: [{order: 'SEQUENTIAL', promptItems: items}]}],
  ...extra,
}) as unknown as EditorScript;

describe('setPromptMediaKind', () => {
  it('keeps an audio mediaitem elsewhere in the array', () => {
    const mediaitems: Mediaitem[] = [
      {mimetype: 'text/plain', text: 'Hello'},
      {mimetype: 'audio/wav', src: 'media/a.wav'},
    ];
    const next = setPromptMediaKind(mediaitems, 'image');
    expect(next.length).toBe(2);
    expect(next[0].mimetype).toBe('image/png');
    expect(next[1]).toEqual({mimetype: 'audio/wav', src: 'media/a.wav'});
  });

  it('makes the first mediaitem plain text, formatted text and an image', () => {
    const plain = setPromptMediaKind([], 'plain');
    expect(plain).toEqual([{mimetype: 'text/plain', text: ''}]);

    const formatted = setPromptMediaKind(plain, 'formatted');
    expect(formatted[0].mimetype).toBe('text/x-prompt');
    expect(formatted[0].promptDoc).toEqual(promptDocFromText(''));

    const image = setPromptMediaKind([{mimetype: 'image/png', src: 'media/p.png', alt: 'a'}], 'image');
    expect(image).toEqual([{mimetype: 'image/png', src: 'media/p.png', alt: 'a'}]);
  });

  it('drops the content keys of the previous kind but keeps unknown keys', () => {
    const next = setPromptMediaKind([{mimetype: 'text/plain', text: 'x', 'data-x': 1} as Mediaitem], 'image');
    expect(next[0].text).toBeUndefined();
    expect((next[0] as Record<string, unknown>)['data-x']).toBe(1);
  });

  it('removes the prompt entry for "nothing" and never an audio entry at index 0', () => {
    const removed = setPromptMediaKind([{mimetype: 'text/plain', text: 'x'}, {mimetype: 'audio/wav', src: 'a'}], 'nothing');
    expect(removed).toEqual([{mimetype: 'audio/wav', src: 'a'}]);
    const untouched = setPromptMediaKind([{mimetype: 'audio/wav', src: 'a'}], 'nothing');
    expect(untouched).toEqual([{mimetype: 'audio/wav', src: 'a'}]);
  });

  it('does not mutate its input', () => {
    const mediaitems: Mediaitem[] = [{mimetype: 'text/plain', text: 'x'}];
    setPromptMediaKind(mediaitems, 'image');
    expect(mediaitems[0].mimetype).toBe('text/plain');
  });
});

describe('mediaitem indices and audio attach', () => {
  it('finds the prompt and audio entries', () => {
    expect(promptMediaIndex([{mimetype: 'audio/wav'}])).toBe(-1);
    expect(promptMediaIndex([{mimetype: 'text/plain'}])).toBe(0);
    expect(audioMediaIndex([{mimetype: 'text/plain'}, {mimetype: 'audio/wav'}])).toBe(1);
    expect(audioMediaIndex([{mimetype: 'text/plain'}])).toBe(-1);
  });

  it('appends or updates the audio entry, keeping the prompt', () => {
    const appended = withAudioMedia([{mimetype: 'text/plain', text: 'x'}], {src: 'media/a.wav', mimetype: 'audio/wav'});
    expect(appended.length).toBe(2);
    expect(appended[0]).toEqual({mimetype: 'text/plain', text: 'x'});

    const updated = withAudioMedia(appended, {src: 'media/b.wav', mimetype: 'audio/mpeg'});
    expect(updated.length).toBe(2);
    expect(updated[1]).toEqual({mimetype: 'audio/mpeg', src: 'media/b.wav'});
  });
});

describe('recinstructions and playback modifiers', () => {
  it('writes the modern object form and keeps sibling keys', () => {
    expect(withInstructions(undefined, 'Read aloud')).toEqual({recinstructions: 'Read aloud'});
    const merged: Record<string, unknown> = {...withInstructions({recinstructions: 'old', 'data-x': 2}, 'new')};
    expect(merged).toEqual({recinstructions: 'new', 'data-x': 2});
  });

  it('merges a playback patch over the existing modifier', () => {
    const item: PromptItem = {mediaitems: [], playback: {when: 'BEFORE', repeats: 2}};
    expect(withPlayback(item, {headphones: true})).toEqual({when: 'BEFORE', repeats: 2, headphones: true});
    expect(withPlayback(null, {when: 'DURING'})).toEqual({when: 'DURING'});
  });
});

describe('itemcodeFindings', () => {
  it('is empty for a clean code', () => {
    const script = scriptOf([textItem('a'), textItem('b')]);
    expect(itemcodeFindings(script, 0, 0, 0)).toEqual([]);
  });

  it('flags the edited item for E01 and E02', () => {
    const empty = scriptOf([textItem('  ')]);
    expect(itemcodeFindings(empty, 0, 0, 0).map((finding) => finding.id)).toEqual(['E01']);

    const duplicate = scriptOf([textItem('a'), textItem('a')]);
    const second = itemcodeFindings(duplicate, 0, 0, 1);
    expect(second.map((finding) => finding.id)).toEqual(['E02']);
    expect(second[0].path).toBe('sections[0].groups[0].promptItems[1].itemcode');
  });

  it('flags a fixed code inside a drawn range with E05', () => {
    const drawn: PromptItem = {
      itemcode: 'RB',
      mediaitems: [],
      prefill: {bank: {bank: 'B', bankSource: 'PROJECT', count: 3, itemcodePrefix: 'RB'}},
    };
    const script = scriptOf([drawn, textItem('RB002')]);
    // The drawn placeholder at index 0 is fine; the fixed item at index 1 is inside its range.
    expect(itemcodeFindings(script, 0, 0, 0)).toEqual([]);
    expect(itemcodeFindings(script, 0, 0, 1).map((finding) => finding.id)).toEqual(['E05']);
  });
});

describe('group Split', () => {
  it('splits into rounded-up halves without losing items', () => {
    const group = {order: 'SEQUENTIAL' as const, promptItems: [textItem('a'), textItem('b'), textItem('c')]};
    const {first, second} = splitGroupItems(group);
    expect(first.map((item) => item.itemcode)).toEqual(['a', 'b']);
    expect(second.map((item) => item.itemcode)).toEqual(['c']);
  });

  it('has an empty second half for a single item', () => {
    expect(splitGroupItems({promptItems: [textItem('a')]}).second).toEqual([]);
    expect(splitGroupItems(null)).toEqual({first: [], second: []});
  });
});

describe('group kind conversion', () => {
  it('builds a placeholder on the first project bank', () => {
    const banks: Bank[] = [
      {bankId: 'builtin-1', title: 'Builtin', source: 'BUILTIN'},
      {bankId: 'words', title: 'Words', source: 'PROJECT'},
    ];
    expect(bankPlaceholder(banks)).toEqual({
      itemcode: '',
      mediaitems: [],
      prefill: {bank: {bank: 'words', bankSource: 'PROJECT', count: 1, itemcodePrefix: ''}},
    });
    expect(bankPlaceholder([]).prefill?.bank?.bank).toBe('');
  });

  it('drops the draw rule when converting back to a fixed list', () => {
    const drawn: PromptItem = {
      itemcode: 'RB',
      mediaitems: [{mimetype: 'text/plain', text: 'x'}],
      prefill: {bank: {bank: 'B', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}},
    };
    const fixed = fixedItemsFromDrawn([drawn]);
    expect(fixed[0].prefill).toBeUndefined();
    expect(fixed[0].itemcode).toBe('RB');
  });
});

describe('randomised-items prefill (D-W)', () => {
  it('names the three cases of the prefill declaration', () => {
    expect(prefillKindOf(null)).toBe('none');
    expect(prefillKindOf(textItem('a'))).toBe('none');
    expect(prefillKindOf({itemcode: 'a', mediaitems: [], prefill: {source: 'words', select: 'random', itemcodeFormat: '{n}'}})).toBe('list');
    expect(prefillKindOf({
      itemcode: 'R',
      mediaitems: [],
      prefill: {bank: {bank: 'b', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'R'}},
    })).toBe('bank');
  });

  it('defaults a new bank source to the first project bank, else empty (E03)', () => {
    const banks: Bank[] = [
      {bankId: 'builtin-1', title: 'Builtin', source: 'BUILTIN'},
      {bankId: 'words', title: 'Words', source: 'PROJECT'},
    ];
    expect(defaultBankSource(banks)).toEqual({bank: 'words', bankSource: 'PROJECT', count: 1, itemcodePrefix: ''});
    expect(defaultBankSource([]).bank).toBe('');
  });

  it('replaces {n} with the 1-based entry position in the code preview', () => {
    expect(listCodePreview('6.{n}')).toEqual(['6.1', '6.2', '6.3']);
    expect(listCodePreview('W{n}')).toEqual(['W1', 'W2', 'W3']);
    expect(listCodePreview('')).toEqual([]);
  });
});
