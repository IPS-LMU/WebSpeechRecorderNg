/**
 * Pure mapping helpers for the inspector's editable fields (ui-spec §3.3). The component wires
 * them to `ScriptDraftService`; keeping the mappings here means the model shape they produce is
 * unit-tested without a browser, and the 412 reapply guards see plain values.
 *
 * Nothing here mutates its input: every function returns a new value, and the component hands that
 * value to `setValue`/`insert`/`remove`, which is what keeps undo/autosave/dirty state working.
 */
import {
  MediaitemUtil,
  type Bank,
  type Mediaitem,
  type Playback,
  type PrefillBankSource,
  type PromptDoc,
  type PromptItem,
} from 'speechrecorderng';
import {checkE01, checkE02, checkE05, type Draft, type Finding} from '../../core/validation';
import {isObject, itemPath} from '../../core/validation/walk';
import type {EditorGroup, EditorScript} from '../../core/script.model';

/** The prompt-media kinds of the inspector's select: the shape of `mediaitems[0]`. */
export type PromptMediaKind = 'plain' | 'formatted' | 'image' | 'nothing';

export const PROMPT_MEDIA_KINDS: ReadonlyArray<PromptMediaKind> = ['plain', 'formatted', 'image', 'nothing'];

/** The content keys a prompt mediaitem carries; the kind decides which of them survive. */
const CONTENT_KEYS = ['text', 'promptDoc', 'src', 'alt', 'defaultVirtualViewBox'] as const;

/** The `mediaitems[0]` only when it is a prompt entry; `-1` when it is absent or the audio clip. */
export function promptMediaIndex(mediaitems: ReadonlyArray<Mediaitem>): number {
  const first = mediaitems[0];
  return first === undefined || MediaitemUtil.kind(first) === 'audio' ? -1 : 0;
}

/** The index of the item's audio mediaitem (`MediaitemUtil.kind(x) === 'audio'`), or `-1`. */
export function audioMediaIndex(mediaitems: ReadonlyArray<Mediaitem>): number {
  return mediaitems.findIndex((candidate) => MediaitemUtil.kind(candidate) === 'audio');
}

/** A plain `PromptDoc` for a text typed into the formatted-text area. */
export function promptDocFromText(text: string): PromptDoc {
  if (text === '') {
    return {body: {blocks: []}};
  }
  return {
    body: {
      blocks: text.split('\n').map((line) => ({type: 'p' as const, texts: [{type: 'text' as const, text: line}]})),
    },
  };
}

function promptMedia(kind: 'plain' | 'formatted' | 'image', base: Mediaitem): Mediaitem {
  const next: Mediaitem = {...base};
  for (const key of CONTENT_KEYS) {
    delete (next as Record<string, unknown>)[key];
  }
  switch (kind) {
    case 'plain':
      next.mimetype = 'text/plain';
      next.text = typeof base.text === 'string' ? base.text : '';
      break;
    case 'formatted':
      next.mimetype = 'text/x-prompt';
      next.promptDoc = base.promptDoc ?? promptDocFromText(base.text ?? '');
      break;
    case 'image':
      next.mimetype = typeof base.mimetype === 'string' && base.mimetype.startsWith('image')
        ? base.mimetype
        : 'image/png';
      if (typeof base.src === 'string') {
        next.src = base.src;
      }
      if (typeof base.alt === 'string') {
        next.alt = base.alt;
      }
      if (base.defaultVirtualViewBox !== undefined) {
        next.defaultVirtualViewBox = base.defaultVirtualViewBox;
      }
      break;
  }
  return next;
}

/**
 * The `mediaitems` array that makes `mediaitems[0]` the requested prompt kind. Any audio mediaitem
 * elsewhere in the array is preserved untouched, as are unknown keys on the prompt entry itself;
 * `nothing` removes the prompt entry (an audio clip at index 0 is never removed).
 */
export function setPromptMediaKind(mediaitems: ReadonlyArray<Mediaitem>, kind: PromptMediaKind): Mediaitem[] {
  const index = promptMediaIndex(mediaitems);
  const copy = mediaitems.map((mediaitem) => ({...mediaitem}));
  if (kind === 'nothing') {
    return index === -1 ? copy : copy.filter((_, position) => position !== index);
  }
  const updated = promptMedia(kind, index === -1 ? {} : copy[index]);
  if (index === -1) {
    return [updated, ...copy];
  }
  return copy.map((mediaitem, position) => (position === index ? updated : mediaitem));
}

/**
 * The `mediaitems` array with the audio entry at `src`/`mimetype` (updated in place when one
 * exists, appended otherwise). Other mediaitems, and the audio entry's other keys, are kept.
 */
export function withAudioMedia(mediaitems: ReadonlyArray<Mediaitem>, audio: {src: string; mimetype: string}): Mediaitem[] {
  const index = audioMediaIndex(mediaitems);
  if (index === -1) {
    return [...mediaitems.map((mediaitem) => ({...mediaitem})), {mimetype: audio.mimetype, src: audio.src}];
  }
  return mediaitems.map((mediaitem, position) =>
    position === index ? {...mediaitem, src: audio.src, mimetype: audio.mimetype} : {...mediaitem});
}

/** The `recinstructions` value for a typed instruction, preserving any sibling keys. */
export function withInstructions(existing: unknown, value: string): {recinstructions: string} {
  return isObject(existing) ? {...existing, recinstructions: value} : {recinstructions: value};
}

/** The item's `playback` modifier with `patch` merged in; the shipped default is `WITH_PROMPT`. */
export function withPlayback(item: PromptItem | null, patch: Partial<Playback>): Playback {
  return {...(item?.playback ?? {}), ...patch};
}

/**
 * The catalogue findings that make this item's `itemcode` invalid right now: E01 (empty), E02
 * (another item already uses it — drawn reserved codes included) and E05 (it falls inside a bank
 * source's reserved range). Re-runs the pure checks over the model, so the inline message cannot
 * disagree with the checks panel.
 */
export function itemcodeFindings(script: EditorScript | null, section: number, group: number, item: number): Finding[] {
  if (script === null) {
    return [];
  }
  const path = `${itemPath(section, group, item)}.itemcode`;
  const draft = script as Draft;
  return [...checkE01(draft), ...checkE02(draft), ...checkE05(draft)].filter((finding) => finding.path === path);
}

/** The two halves of a group Split: the first keeps the rounded-up half, the second gets the rest. */
export function splitGroupItems(group: EditorGroup | null): {first: PromptItem[]; second: PromptItem[]} {
  const items = group?.promptItems ?? [];
  const cut = Math.ceil(items.length / 2);
  return {first: items.slice(0, cut), second: items.slice(cut)};
}

/** A drawn group's placeholder item, defaulting to the first project bank (else none, E03 shows). */
export function bankPlaceholder(bankList: ReadonlyArray<Bank>): PromptItem {
  return {itemcode: '', mediaitems: [], prefill: {bank: defaultBankSource(bankList)}};
}

/** The default bank source of a freshly chosen item bank, over the first project bank (E03 if none). */
export function defaultBankSource(bankList: ReadonlyArray<Bank>): PrefillBankSource {
  const project = bankList.find((bank) => bank.source === 'PROJECT');
  return {
    bank: project?.bankId ?? '',
    bankSource: 'PROJECT',
    count: 1,
    itemcodePrefix: '',
  };
}

/** The three cases of the randomisation picker: nothing drawn, a list, or an item bank. */
export type PrefillKind = 'none' | 'list' | 'bank';

/** Which of the three cases the item's `prefill` currently is (D-W: exactly one of source/bank). */
export function prefillKindOf(item: PromptItem | null): PrefillKind {
  const prefill = item?.prefill;
  if (prefill?.bank !== undefined) {
    return 'bank';
  }
  if (prefill?.source !== undefined) {
    return 'list';
  }
  return 'none';
}

/**
 * The generated itemcodes of a list `itemcodeFormat` for the first positions, with `{n}` replaced
 * by the 1-based entry position (the model's rule, e.g. `6.{n}` → `6.1`).
 */
export function listCodePreview(itemcodeFormat: string, positions = 3): string[] {
  if (itemcodeFormat === '') {
    return [];
  }
  return Array.from({length: positions}, (_, index) => itemcodeFormat.split('{n}').join(String(index + 1)));
}

/** The items of a group converted back to a fixed list: the draw's `prefill` is dropped. */
export function fixedItemsFromDrawn(items: ReadonlyArray<PromptItem>): PromptItem[] {
  return items.map((item) => {
    const {prefill, ...rest} = item;
    return rest;
  });
}
