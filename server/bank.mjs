/**
 * Item banks: filtering, querying, CSV import and id/copy helpers.
 *
 * Filter semantics are **frozen** (doc/script-editor/data-model.md §2.2, decision D-O): `tags` are
 * ANDed, `hasAudio: false` selects items **without** a model recording, `words` bounds are
 * inclusive, `category` is an exact match and `q` is a case-insensitive substring over the item
 * text. `matchCount` is what the draw/bank source validates `count` against (E04); `withoutAudio`
 * raises W04 when the rule plays bank audio.
 */

/** The plain text an item shows, or null. */
export function itemText(item) {
  if (typeof item?.text === 'string') {
    return item.text;
  }
  return promptDocText(item?.promptDoc);
}

function promptDocText(promptDoc) {
  const parts = [];
  for (const block of promptDoc?.body?.blocks ?? []) {
    for (const text of block?.texts ?? []) {
      const value = typeof text?.text === 'string' ? text.text : text?.text?.text;
      if (typeof value === 'string') {
        parts.push(value);
      }
    }
  }
  return parts.length === 0 ? null : parts.join('');
}

/** True when the item satisfies every clause of the filter. */
export function matchesFilter(item, filter = {}) {
  if (filter.category !== undefined && item?.category !== filter.category) {
    return false;
  }
  if (filter.words !== undefined) {
    const [min, max] = Array.isArray(filter.words) ? filter.words : [undefined, undefined];
    const words = item?.words;
    if (!Number.isFinite(words)) {
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

/** The query answer: matching count, the missing-audio count and one page of items. */
export function queryBank(bank, filter = {}, {limit = 50, offset = 0} = {}) {
  const matching = (bank?.items ?? []).filter((item) => matchesFilter(item, filter));
  return {
    matchCount: matching.length,
    withoutAudio: matching.filter((item) => item?.audioSrc === undefined || item?.audioSrc === null).length,
    offset,
    items: matching.slice(offset, offset + limit),
  };
}

/** A bank id derived from a title, unique among the taken ids. */
export function bankIdFor(title, taken = new Set()) {
  const base = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bank';
  let id = base;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

/** Minimal RFC-4180 CSV: quoted fields, doubled quotes, CRLF or LF rows. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

const CSV_HEADER = ['text', 'category', 'words', 'tags', 'audio'];

/**
 * Turns the documented CSV (`text,category,words,tags,audio`) into bank items; the header row is
 * optional. Every row that cannot be imported produces one `{line, message}` error, so the caller
 * returns `{imported, skipped, errors}` unchanged.
 */
export function csvToItems(text, bank) {
  const rows = parseCsv(text);
  const first = rows[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  const hasHeader = CSV_HEADER.every((column, index) => first[index] === column);
  const body = hasHeader ? rows.slice(1) : rows;
  let sequence = 0;
  for (const item of bank?.items ?? []) {
    const match = /^item-(\d+)$/.exec(String(item.bankItemId ?? ''));
    if (match !== null) {
      sequence = Math.max(sequence, Number(match[1]));
    }
  }
  const existing = new Set((bank?.items ?? []).map((item) => String(item.bankItemId)));
  const items = [];
  const errors = [];
  body.forEach((row, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const [rawText, rawCategory, rawWords, rawTags, rawAudio] = row.map((value) => (value ?? '').trim());
    if (rawText === '') {
      errors.push({line, message: 'text is required'});
      return;
    }
    let id;
    do {
      id = `item-${String(++sequence).padStart(4, '0')}`;
    } while (existing.has(id));
    existing.add(id);
    const item = {bankItemId: id, text: rawText};
    if (rawCategory !== '') {
      item.category = rawCategory;
    }
    if (rawWords !== '') {
      const words = Number(rawWords);
      if (Number.isFinite(words) && words >= 0) {
        item.words = words;
      } else {
        errors.push({line, message: `words "${rawWords}" is not a number`});
        return;
      }
    }
    if (rawTags !== '') {
      item.tags = rawTags.split(/[|;]/).map((tag) => tag.trim()).filter((tag) => tag !== '');
    }
    if (rawAudio !== '') {
      item.audioSrc = rawAudio;
    }
    items.push(item);
  });
  return {items, errors};
}
