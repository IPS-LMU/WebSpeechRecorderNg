/**
 * Bank filtering, mirroring `server/bank.mjs` exactly: `queryBank`'s `matchCount` is what E04
 * validates `count` against and `withoutAudio` is what raises W04. The semantics are frozen in
 * doc/script-editor/data-model.md §2.2 (D-O): `tags` are ANDed, `words` bounds are inclusive,
 * `category` is exact, `q` is a case-insensitive substring.
 */
import type {BankItem, DrawFilter} from 'speechrecorderng';
import type {BankView} from './types';
import {isObject} from './walk';

function promptDocText(promptDoc: unknown): string | null {
  if (!isObject(promptDoc)) {
    return null;
  }
  const body = promptDoc['body'];
  const blocks = isObject(body) ? body['blocks'] : undefined;
  const parts: string[] = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!isObject(block)) {
      continue;
    }
    for (const text of Array.isArray(block['texts']) ? block['texts'] : []) {
      const value = isObject(text) ? text['text'] : undefined;
      const nested = isObject(value) ? value['text'] : value;
      if (typeof nested === 'string') {
        parts.push(nested);
      }
    }
  }
  return parts.length === 0 ? null : parts.join('');
}

export function itemText(item: BankItem | null | undefined): string | null {
  if (typeof item?.text === 'string') {
    return item.text;
  }
  return promptDocText(item?.promptDoc);
}

export function matchesFilter(item: BankItem | null | undefined, filter: DrawFilter = {}): boolean {
  if (filter.category !== undefined && item?.category !== filter.category) {
    return false;
  }
  if (filter.words !== undefined) {
    const [min, max] = Array.isArray(filter.words) ? filter.words : [undefined, undefined];
    const words = item?.words;
    if (typeof words !== 'number' || !Number.isFinite(words)) {
      return false;
    }
    if (min !== undefined && min !== null && words < min) {
      return false;
    }
    if (max !== undefined && max !== null && words > max) {
      return false;
    }
  }
  if (filter.hasAudio !== undefined) {
    const hasAudio = item?.audioSrc !== undefined && item?.audioSrc !== null;
    if (hasAudio !== filter.hasAudio) {
      return false;
    }
  }
  if (Array.isArray(filter.tags) && filter.tags.length > 0) {
    const tags = new Set(item?.tags ?? []);
    if (!filter.tags.every((tag) => tags.has(tag))) {
      return false;
    }
  }
  if (filter.q !== undefined && String(filter.q).trim() !== '') {
    const haystack = (itemText(item) ?? '').toLowerCase();
    if (!haystack.includes(String(filter.q).trim().toLowerCase())) {
      return false;
    }
  }
  return true;
}

export interface BankQuery {
  matchCount: number;
  withoutAudio: number;
  items: BankItem[];
}

export function queryBank(bank: BankView | null | undefined, filter: DrawFilter = {}): BankQuery {
  const matching = (bank?.items ?? []).filter((item) => matchesFilter(item, filter));
  return {
    matchCount: matching.length,
    withoutAudio: matching.filter((item) => item?.audioSrc === undefined || item?.audioSrc === null).length,
    items: matching,
  };
}

/** The filter stored on a bank source, or `{}` when none is set. */
export function filterOf(bank: Record<string, unknown>): DrawFilter {
  const filter = bank['filter'];
  return isObject(filter) ? (filter as DrawFilter) : {};
}
