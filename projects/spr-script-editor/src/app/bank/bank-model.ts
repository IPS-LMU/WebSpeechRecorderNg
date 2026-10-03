/**
 * Pure helpers shared by the bank browser and the draw-rule editor: the tri-state filter model and
 * its two serialisations, the bank grouping, the generated itemcode range and the model-recording
 * URL.
 *
 * The filter semantics are frozen (data-model.md §2.2, D-O): `tags` are ANDed, `hasAudio:false`
 * means items **without** a model recording, word bounds are inclusive, `category` is exact and `q`
 * is a case-insensitive substring. `drawFilterOf` is the persisted `Draw.filter`; `itemQueryOf` is
 * the wire query for `GET …/bank/{b}/item` (rest-api.md §3.2) — the two must agree, which is why
 * they are produced here rather than inline in a template.
 */
import type {Bank, BankItem, DrawFilter, Order, PrefillBankSource} from 'speechrecorderng';
import {projectPath} from '../core/api-base';
import type {BankItemQuery} from '../core/script.model';

/** The audio clause as a control shows it; the API takes a boolean only when it is not `any`. */
export type AudioFilter = 'any' | 'with' | 'without';

/** The filter as the form edits it: numbers stay strings so a half-typed value is not lost. */
export interface BankFilterFields {
  category: string;
  minWords: string;
  maxWords: string;
  audio: AudioFilter;
  tags: string;
  q: string;
}

export const EMPTY_FILTER_FIELDS: BankFilterFields = {
  category: '',
  minWords: '',
  maxWords: '',
  audio: 'any',
  tags: '',
  q: '',
};

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}

function numberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** The persisted `Draw.filter`; empty clauses are omitted so an old rule is not rewritten. */
export function drawFilterOf(fields: BankFilterFields): DrawFilter {
  const filter: DrawFilter = {};
  const category = fields.category.trim();
  if (category !== '') {
    filter.category = category;
  }
  const min = numberOrUndefined(fields.minWords);
  const max = numberOrUndefined(fields.maxWords);
  if (min !== undefined || max !== undefined) {
    // The receiver reads an `undefined` bound as open (`server/bank.mjs` `matchesFilter`, built by
    // `filterFromQuery` from the separate `minWords`/`maxWords` params), but the library’s
    // `DrawFilter.words` is typed `[number, number]` — narrower than the wire format — so the open
    // end is `undefined` exactly as the receiver writes it. (Reported as a doc/type disagreement.)
    filter.words = [min, max] as [number, number];
  }
  if (fields.audio === 'with') {
    filter.hasAudio = true;
  } else if (fields.audio === 'without') {
    filter.hasAudio = false;
  }
  const tags = parseTags(fields.tags);
  if (tags.length > 0) {
    filter.tags = tags;
  }
  const q = fields.q.trim();
  if (q !== '') {
    filter.q = q;
  }
  return filter;
}

/** The wire query for `GET …/bank/{b}/item`. */
export function itemQueryOf(fields: BankFilterFields, page: {limit?: number; offset?: number} = {}): BankItemQuery {
  const query: BankItemQuery = {};
  const category = fields.category.trim();
  if (category !== '') {
    query.category = category;
  }
  const min = numberOrUndefined(fields.minWords);
  const max = numberOrUndefined(fields.maxWords);
  if (min !== undefined) {
    query.minWords = min;
  }
  if (max !== undefined) {
    query.maxWords = max;
  }
  if (fields.audio === 'with') {
    query.hasAudio = true;
  } else if (fields.audio === 'without') {
    query.hasAudio = false;
  }
  const tags = parseTags(fields.tags);
  if (tags.length > 0) {
    query.tags = tags;
  }
  const q = fields.q.trim();
  if (q !== '') {
    query.q = q;
  }
  if (page.limit !== undefined) {
    query.limit = page.limit;
  }
  if (page.offset !== undefined) {
    query.offset = page.offset;
  }
  return query;
}

/** The controls’ view of a stored filter; the inverse of `drawFilterOf`. */
export function fieldsOfFilter(filter: DrawFilter | undefined): BankFilterFields {
  if (filter === undefined) {
    return {...EMPTY_FILTER_FIELDS};
  }
  const words = filter.words;
  return {
    category: filter.category ?? '',
    minWords: words === undefined ? '' : String(words[0]),
    maxWords: words === undefined ? '' : String(words[1]),
    audio: filter.hasAudio === true ? 'with' : filter.hasAudio === false ? 'without' : 'any',
    tags: Array.isArray(filter.tags) ? filter.tags.join(', ') : '',
    q: filter.q ?? '',
  };
}

/** True when every clause is empty, i.e. the filter selects the whole bank. */
export function isFilterEmpty(fields: BankFilterFields): boolean {
  return fields.category.trim() === ''
    && fields.minWords.trim() === ''
    && fields.maxWords.trim() === ''
    && fields.audio === 'any'
    && parseTags(fields.tags).length === 0
    && fields.q.trim() === '';
}

/** The playable URL of a bank item’s model recording (`audioSrc` is a project resource). */
export function bankAudioUrl(base: string, projectId: string, audioSrc: string): string {
  const segments = audioSrc.split('/').filter((segment) => segment !== '');
  return projectPath(base, projectId, ...segments);
}

export interface BankGroups {
  project: Bank[];
  builtin: Bank[];
}

/** The picker’s two groups (ui-spec §6); order is kept stable inside each group. */
export function groupBanks(banks: ReadonlyArray<Bank>): BankGroups {
  const project: Bank[] = [];
  const builtin: Bank[] = [];
  for (const bank of banks) {
    (bank.source === 'BUILTIN' ? builtin : project).push(bank);
  }
  return {project, builtin};
}

/** The generated codes of a draw: `${prefix}001`…, zero-padded to three digits (max 999). */
export function codeRange(prefix: string, count: number): {first: string; last: string; count: number} | null {
  if (prefix === '' || !Number.isInteger(count) || count < 1) {
    return null;
  }
  const size = Math.min(count, 999);
  return {first: `${prefix}001`, last: `${prefix}${String(size).padStart(3, '0')}`, count: size};
}

const DEFAULT_ORDER: Order = 'RANDOM';

/** The inline item form’s state; `id === null` means a new item. */
export interface BankItemEdit {
  id: string | null;
  text: string;
  category: string;
  words: string;
  tags: string;
  audioSrc?: string;
  audioMimetype?: string;
}

/** What an item row shows, falling back in the same order the browser always has. */
export function bankItemText(item: BankItem): string {
  if (item.text !== undefined && item.text !== '') {
    return item.text;
  }
  if (item.src !== undefined) {
    return item.src;
  }
  return item.bankItemId;
}

/** `usedInSessions` is optional on the wire; the column is hidden when it is absent. */
export function usedInSessions(item: BankItem): number | null {
  return 'usedInSessions' in item && typeof item.usedInSessions === 'number' ? item.usedInSessions : null;
}

/** A fresh bank source for a group whose placeholder has none yet (or a different bank). */
export function ruleDefaults(bank?: Bank | null): PrefillBankSource {
  return {
    bank: bank?.bankId ?? '',
    bankSource: bank?.source ?? 'PROJECT',
    filter: {},
    count: 1,
    order: DEFAULT_ORDER,
    fixedBy: 'SESSION',
    skipRecordedBySpeaker: false,
    itemcodePrefix: '',
    playBankAudio: false,
  };
}
