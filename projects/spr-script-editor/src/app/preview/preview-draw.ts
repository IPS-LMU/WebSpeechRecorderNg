/**
 * The tier-1 preview's example draw (ui-spec §4: "an editor-side mock, instant, no server").
 *
 * A drawn group in the model is a *placeholder* item whose `prefill.bank` names a bank, a filter
 * and a count; the server resolves it into real items at session creation (data-model.md §2,
 * rest-api.md §4.1). Tier 1 does not call the server, so the preview folds in a locally generated
 * example instead. The generation is a pure function of the placeholder and a seed, so the same
 * screen is shown before and after a reload, and Re-draw walks a fixed sequence of examples.
 *
 * ## Seed source
 *
 * The seed is **not** entropy: it is `EXAMPLE_DRAW_SEED` (a fixed 32-bit constant, itself the
 * compressed form of "seed") XORed with an FNV-1a hash of
 * `scriptId:sectionIndex:groupIndex:placeholderIndex:generation`.
 *
 * - `generation` starts at 0 and increments once per Re-draw press, so the first example is
 *   identical on every load and every press gives the next, stable example. No `Math.random()`,
 *   no clock, no `crypto`.
 * - Different scripts, different groups and different placeholders draw different examples, which
 *   is what makes the order list legible when a script has two drawn groups.
 *
 * Two consequences the specs pin: `exampleDraw` never mutates its inputs, and two calls with the
 * same arguments are deep-equal.
 */
import type {Mediaitem, PrefillBankSource, PromptItem, PromptItemPrefill} from 'speechrecorderng';
import {PREVIEW_STRINGS} from './preview-strings';

/**
 * Marker for the model recording of a drawn example. Tier 1 cannot know the URL the server will
 * materialise, so it never invents a plausible-looking path; the stage recognises this scheme and
 * renders a labelled chip ("Bank model recording — resolved when the session runs") instead of a
 * broken audio element or a silent gap.
 */
export const BANK_MOCK_SRC_PREFIX = 'bank:';

/** Fixed half of every seed; the other half is a hash of the draw's position (see the file docs). */
export const EXAMPLE_DRAW_SEED = 0x5eed1a11;

/** FNV-1a over a string, as an unsigned 32-bit integer. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast, deterministic PRNG. One instance per draw. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed of one example draw (documented above). */
export function drawSeed(
  scriptId: string | number | undefined,
  sectionIndex: number,
  groupIndex: number,
  placeholderIndex: number,
  generation: number,
): number {
  const key = `${scriptId ?? ''}:${sectionIndex}:${groupIndex}:${placeholderIndex}:${generation}`;
  return (EXAMPLE_DRAW_SEED ^ fnv1a(key)) >>> 0;
}

/** Fisher–Yates, driven by the seeded generator, without touching the input array. */
export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const out = values.slice();
  for (let index = out.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    const held = out[index];
    out[index] = out[swap];
    out[swap] = held;
  }
  return out;
}

/** The i-th drawn item's itemcode, exactly as `PrefillBankSource.itemcodePrefix` documents it. */
export function drawnItemcode(bank: Pick<PrefillBankSource, 'itemcodePrefix'>, index: number): string {
  return `${bank.itemcodePrefix}${String(index + 1).padStart(3, '0')}`;
}

/** One generated item plus the example entry that produced it (the order list shows the entry). */
export interface ExampleDrawnItem {
  itemcode: string;
  /** The bank entry this example stands for. */
  entry: string;
  item: PromptItem;
}

function substitute(mediaitem: Mediaitem, entry: string): Mediaitem {
  const replace = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : value.split('{entry}').join(entry);
  return {
    ...mediaitem,
    ...(mediaitem.text === undefined ? {} : {text: replace(mediaitem.text)}),
    ...(mediaitem.src === undefined ? {} : {src: replace(mediaitem.src)}),
    ...(mediaitem.alt === undefined ? {} : {alt: replace(mediaitem.alt)}),
  };
}

/** True for the placeholder item a drawn group carries (`prefill.bank` set). */
export function isDrawnPlaceholder(item: PromptItem | null | undefined): boolean {
  return !!(item && (item.prefill as PromptItemPrefill | undefined)?.bank);
}

/**
 * The example the preview folds in where `bank` sits in the script.
 *
 * `template` is the placeholder's own `mediaitems`: the generated items are the placeholder's
 * prompt with `{entry}` replaced, exactly as the server would fill it (script.ts,
 * `PromptItemPrefill.mediaitems`). When `playBankAudio` is set the example also carries the bank's
 * model recording, marked with `BANK_MOCK_SRC_PREFIX`.
 */
export function exampleDraw(
  bank: PrefillBankSource,
  scriptId: string | number | undefined,
  sectionIndex: number,
  groupIndex: number,
  placeholderIndex: number,
  generation: number,
  template: readonly Mediaitem[] = [],
): ExampleDrawnItem[] {
  const count = Math.min(999, Math.max(1, Math.trunc(bank.count) || 1));
  const pool = PREVIEW_STRINGS.exampleEntries as readonly string[];
  const random = mulberry32(drawSeed(scriptId, sectionIndex, groupIndex, placeholderIndex, generation));
  const entries = shuffle(pool, random);
  const items: ExampleDrawnItem[] = [];
  for (let index = 0; index < count; index++) {
    const entry = entries[index % entries.length];
    const mediaitems: Mediaitem[] = template.map((mediaitem) => substitute(mediaitem, entry));
    if (bank.playBankAudio) {
      mediaitems.push({
        mimetype: 'audio/wav',
        src: `${BANK_MOCK_SRC_PREFIX}${bank.bank}`,
        alt: PREVIEW_STRINGS.stageBankAudioAlt,
      });
    }
    items.push({
      itemcode: drawnItemcode(bank, index),
      entry,
      item: {
        itemcode: drawnItemcode(bank, index),
        mediaitems,
        ...(bank.itemDefaults ?? {}),
        ...(bank.playback ? {playback: bank.playback} : {}),
      },
    });
  }
  return items;
}
