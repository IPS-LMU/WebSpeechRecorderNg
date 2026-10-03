/**
 * The D7 one-click fixes (doc/script-editor/data-model.md §6, validation.md). `applyFix` takes one
 * finding the panel shows and returns a new draft plus the findings that fix touched. Fixes run
 * **only on request**, never on load, and every one of them is idempotent: applying the same fix to
 * its own result changes nothing.
 */
import type {Draft, Finding, ValidationContext} from './validation/types';
import {eachBankSource, eachItem, isObject} from './validation/walk';
import {filterOf, queryBank} from './validation/filter';

export interface FixOptions {
  /** E08: which side of an unrepresentable group to keep. Default `list`. */
  keep?: 'list' | 'rule';
  /** N02: the order to replace `RANDOMIZED` with. Default `RANDOM`. */
  order?: 'RANDOM' | 'SEQUENTIAL';
}

export interface FixResult {
  draft: Draft;
  /** The findings this fix addressed (usually just the one it was given). */
  findings: Finding[];
  changed: boolean;
}

type Token = string | number;

const TOKEN = /([^.[\]]+)|\[(\d+)\]/g;

function parsePath(path: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(path)) !== null) {
    tokens.push(match[2] !== undefined ? Number(match[2]) : match[1]);
  }
  return tokens;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parentOf(root: Draft, tokens: Token[]): {parent: Draft; key: Token} | null {
  let node: Draft = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    node = node?.[tokens[i]];
    if (node === undefined || node === null) {
      return null;
    }
  }
  return {parent: node, key: tokens[tokens.length - 1]};
}

function valueAt(root: Draft, tokens: Token[]): unknown {
  let node: Draft = root;
  for (const token of tokens) {
    if (node === undefined || node === null) {
      return node;
    }
    node = node[token];
  }
  return node;
}

function trimPath(path: string, suffix: string): string {
  return path.endsWith(suffix) ? path.slice(0, -suffix.length) : path;
}

function itemCodes(draft: Draft, exceptPath: string | null): string[] {
  const codes: string[] = [];
  for (const ref of eachItem(draft)) {
    if (exceptPath !== null && ref.itemPath === exceptPath) {
      continue;
    }
    const code = ref.item['itemcode'];
    if (typeof code === 'string' && code.trim() !== '') {
      codes.push(code.trim());
    }
  }
  return codes;
}

interface Range {
  prefix: string;
  count: number;
}

function ranges(draft: Draft): Range[] {
  const out: Range[] = [];
  for (const ref of eachBankSource(draft)) {
    const prefix = ref.bank['itemcodePrefix'];
    const count = Number(ref.bank['count']);
    if (prefix !== undefined && prefix !== null && String(prefix) !== '' && Number.isInteger(count) && count >= 1) {
      out.push({prefix: String(prefix), count});
    }
  }
  return out;
}

function insideRange(code: string, range: Range): boolean {
  const escaped = range.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escaped}(\\d{3,})$`).exec(code);
  return match !== null && Number(match[1]) <= range.count;
}

function nextFreeCode(draft: Draft, exceptPath: string | null): string {
  const taken = new Set(itemCodes(draft, exceptPath));
  const reserved = ranges(draft);
  for (let n = 1; n < 1_000_000; n++) {
    const code = String(n);
    if (!taken.has(code) && !reserved.some((range) => insideRange(code, range))) {
      return code;
    }
  }
  throw new Error('No free itemcode available');
}

function prefixIsFree(draft: Draft, bankPath: string, prefix: string, count: number): boolean {
  if (prefix === '') {
    return false;
  }
  for (const ref of eachBankSource(draft)) {
    const other = ref.bank['itemcodePrefix'];
    if (ref.bankPath !== bankPath && other !== undefined && other !== null && String(other) === prefix) {
      return false;
    }
  }
  return !itemCodes(draft, null).some((code) => insideRange(code, {prefix, count}));
}

function freePrefix(draft: Draft, bankPath: string, count: number): string {
  const candidates: string[] = [];
  for (let i = 0; i < 26; i++) {
    candidates.push(String.fromCharCode(65 + i));
  }
  for (let i = 1; i < 100; i++) {
    candidates.push(`P${i}`);
  }
  for (const candidate of candidates) {
    if (prefixIsFree(draft, bankPath, candidate, count)) {
      return candidate;
    }
  }
  throw new Error('No free itemcode prefix available');
}

/**
 * Applies the fix named by `finding.fix` to the draft at `finding.path`. Unfixable UI kinds
 * (`focus`, `bank-picker`, `file-picker`) return the draft unchanged.
 */
export function applyFix(
  draft: Draft,
  finding: Finding,
  context: ValidationContext = {},
  options: FixOptions = {},
): FixResult {
  const next = clone(draft);
  const tokens = parsePath(finding.path);
  const target = parentOf(next, tokens);
  const leaf = tokens[tokens.length - 1];
  const unchanged = (): FixResult => ({draft: next, findings: [finding], changed: false});
  const done = (): FixResult => ({draft: next, findings: [finding], changed: true});

  switch (finding.fix) {
    case 'next-code': {
      if (target === null || leaf !== 'itemcode') {
        return unchanged();
      }
      const current = target.parent[target.key];
      const all = itemCodes(next, null);
      if (typeof current !== 'string' || all.filter((code) => code === current.trim()).length <= 1) {
        return unchanged();
      }
      target.parent[target.key] = nextFreeCode(next, trimPath(finding.path, '.itemcode'));
      return done();
    }
    case 'clamp-count': {
      if (target === null || leaf !== 'count') {
        return unchanged();
      }
      const bank = valueAt(next, tokens.slice(0, -1));
      if (!isObject(bank)) {
        return unchanged();
      }
      const bankId = bank['bank'];
      const view = typeof bankId === 'string' ? context.bankLookup?.(bankId) : null;
      if (view === undefined || view === null) {
        return unchanged();
      }
      const {matchCount} = queryBank(view, filterOf(bank));
      const current = Number(bank['count']);
      if (!Number.isInteger(current) || current <= matchCount) {
        return unchanged();
      }
      bank['count'] = matchCount;
      return done();
    }
    case 'free-prefix': {
      if (target === null) {
        return unchanged();
      }
      if (leaf === 'itemcodePrefix') {
        const bank = valueAt(next, tokens.slice(0, -1));
        if (!isObject(bank)) {
          return unchanged();
        }
        const current = bank['itemcodePrefix'];
        const count = Number(bank['count']);
        const span = Number.isInteger(count) && count >= 1 ? count : 1;
        const bankPath = trimPath(finding.path, '.itemcodePrefix');
        if (typeof current === 'string' && prefixIsFree(next, bankPath, current, span)) {
          return unchanged();
        }
        bank['itemcodePrefix'] = freePrefix(next, bankPath, span);
        return done();
      }
      if (leaf === 'itemcode') {
        const current = target.parent[target.key];
        if (typeof current === 'string' && !ranges(next).some((range) => insideRange(current.trim(), range))) {
          return unchanged();
        }
        target.parent[target.key] = nextFreeCode(next, trimPath(finding.path, '.itemcode'));
        return done();
      }
      return unchanged();
    }
    case 'rename-modern': {
      const modern = leaf === 'prerecording' ? 'prerecdelay' : leaf === 'postrecording' ? 'postrecdelay' : null;
      if (target === null || modern === null) {
        return unchanged();
      }
      const owner = valueAt(next, tokens.slice(0, -1));
      const legacyValue = target.parent[target.key];
      if (!isObject(owner) || legacyValue === undefined || legacyValue === null
        || (owner[modern] !== undefined && owner[modern] !== null)) {
        return unchanged();
      }
      owner[modern] = legacyValue;
      delete target.parent[target.key];
      return done();
    }
    case 'replace-order': {
      if (target === null || leaf !== 'order' || target.parent[target.key] !== 'RANDOMIZED') {
        return unchanged();
      }
      target.parent[target.key] = options.order ?? 'RANDOM';
      return done();
    }
    case 'convert-groups': {
      const section = valueAt(next, tokens);
      if (!isObject(section) || section['promptUnits'] === undefined || section['promptUnits'] === null) {
        return unchanged();
      }
      const groups = section['groups'];
      if (Array.isArray(groups) && groups.length > 0) {
        return unchanged();
      }
      const order = section['order'] === 'RANDOM' ? 'RANDOM' : 'SEQUENTIAL';
      section['groups'] = [{order, promptItems: section['promptUnits']}];
      delete section['promptUnits'];
      return done();
    }
    case 'keep-first-mediaitem': {
      const mediaitems = valueAt(next, tokens);
      if (target === null || !Array.isArray(mediaitems) || mediaitems.length <= 1) {
        return unchanged();
      }
      target.parent[target.key] = mediaitems.slice(0, 1);
      return done();
    }
    case 'keep-one-side': {
      const group = valueAt(next, tokens);
      if (!isObject(group)) {
        return unchanged();
      }
      const list = group['promptItems'];
      const hasList = Array.isArray(list) && list.length > 0;
      const hasRule = group['draw'] !== undefined && group['draw'] !== null;
      if (!hasList || !hasRule) {
        return unchanged();
      }
      if ((options.keep ?? 'list') === 'rule') {
        group['promptItems'] = [];
      } else {
        delete group['draw'];
      }
      return done();
    }
    case 'add-group': {
      if (finding.path === 'sections') {
        const sections = next['sections'];
        if (Array.isArray(sections) && sections.length > 0) {
          return unchanged();
        }
        next['sections'] = [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, groups: [{order: 'SEQUENTIAL', promptItems: []}]}];
        return done();
      }
      if (target === null || leaf !== 'groups') {
        return unchanged();
      }
      const groups = target.parent[target.key];
      if (Array.isArray(groups) && groups.length > 0) {
        return unchanged();
      }
      target.parent[target.key] = [{order: 'SEQUENTIAL', promptItems: []}];
      return done();
    }
    default:
      return unchanged();
  }
}
