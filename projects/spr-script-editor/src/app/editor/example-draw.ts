/**
 * The example draw shown on a drawn group (ui-spec §3.2). It is **an example**, never the
 * session's draw: the real draw is resolved once, server-side, at session creation
 * (data-model.md §2.2). What this module guarantees is that the example is deterministic — the
 * same bank, rule and offset always produce the same items — so a reload shows the same thing
 * and the "Draw another example" button walks a fixed sequence instead of a random one.
 *
 * Itemcodes use the reserved range the draw claims: `${prefix}001`, `${prefix}002`, …
 */
import type {BankItem, PrefillBankSource} from 'speechrecorderng';
import {itemText, queryBank} from '../core/validation/filter';
import type {BankView} from '../core/validation';

/** The reserved itemcode of the `position`-th drawn item (1-based). */
export function reservedCode(prefix: string, position: number): string {
  return `${prefix ?? ''}${String(position).padStart(3, '0')}`;
}

/** The codes a draw of `count` items reserves, e.g. `["RB001", "RB002"]`. */
export function previewCodes(prefix: string, count: number): string[] {
  const size = Number.isInteger(count) && count > 0 ? Math.min(count, 999) : 0;
  return Array.from({length: size}, (_, index) => reservedCode(prefix, index + 1));
}

export interface ExampleDrawItem {
  itemcode: string;
  text: string;
  bankItemId: string;
}

/** A documented PRNG (mulberry32) so the example is reproducible across reloads. */
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: ReadonlyArray<T>, random: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Up to four example items for the rule, in draw order. Deterministic per
 * `(bankId, itemcodePrefix, offset)`: changing `offset` selects the next example, it never
 * resolves the actual session draw.
 */
export function exampleDraw(
  bank: BankView | null | undefined,
  source: PrefillBankSource,
  offset = 0,
): ExampleDrawItem[] {
  const matching = queryBank(bank, source.filter ?? {}).items;
  const ordered = source.order === 'RANDOM'
    ? shuffled(matching, mulberry32(hashSeed(`${bank?.bankId ?? ''}:${source.itemcodePrefix ?? ''}:${offset}`)))
    : matching;
  const wanted = Math.max(0, Math.min(Number(source.count) || 0, matching.length, 4));
  return ordered.slice(0, wanted).map((item: BankItem, index: number) => ({
    itemcode: reservedCode(source.itemcodePrefix, index + 1),
    text: itemText(item) ?? item.bankItemId,
    bankItemId: item.bankItemId,
  }));
}
