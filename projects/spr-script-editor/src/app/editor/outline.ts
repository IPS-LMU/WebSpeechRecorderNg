/**
 * The outline column's flattened tree and its filter (ui-spec §3.1).
 *
 * `flattenOutline` turns the draft into rows in visual order — script, section, group, item — with
 * the label, the secondary text and the markers each row shows. A drawn group is a leaf: it lists
 * no fabricated children, only its dice marker.
 *
 * `filterOutline` narrows by itemcode and prompt text and keeps the ancestors of the matches, so a
 * match is never orphaned from the tree that explains where it is.
 */
import {PromptitemUtil, type PromptItem} from 'speechrecorderng';
import {arrayOf, isObject} from '../core/validation/walk';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {fillTemplate} from '../core/validation/interpolate';
import {drawnPlaceholder, drawnSource, hasWarning, itemPlaysMedia, type RowMarkers} from './markers';
import type {Finding} from '../core/validation';
import type {Selection} from './selection';

const S = EDITOR_STRINGS;

export interface OutlineRow {
  /** Stable key, and the ancestor link used by the filter. */
  key: string;
  parentKey: string | null;
  kind: 'script' | 'section' | 'group' | 'item';
  level: number;
  selection: Selection;
  label: string;
  secondary: string;
  markers: RowMarkers;
  /** The text the filter matches on; empty for rows that are only kept as ancestors. */
  search: string;
}

const PROMPT_CLIP = 90;

function clip(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > PROMPT_CLIP ? `${oneLine.slice(0, PROMPT_CLIP - 1)}…` : oneLine;
}

function promptText(item: PromptItem): string {
  try {
    return PromptitemUtil.toPlainTextString(item);
  } catch {
    return '';
  }
}

export interface SectionCounts {
  fixed: number;
  drawn: number;
}

/** Fixed items and per-session drawn items of a section (ui-spec §3.2's "11 items + 20 drawn"). */
export function sectionCounts(section: unknown): SectionCounts {
  let fixed = 0;
  let drawn = 0;
  for (const group of arrayOf(isObject(section) ? section['groups'] : undefined)) {
    const placeholder = drawnPlaceholder(group);
    if (placeholder !== null) {
      drawn += Number(drawnSource(placeholder)?.count ?? 0) || 0;
      continue;
    }
    fixed += arrayOf(isObject(group) ? group['promptItems'] : undefined).length;
  }
  return {fixed, drawn};
}

export interface OutlineOptions {
  /** Bank titles by id, for the dice marker ("draws 20 from <bank>"). */
  bankNames?: ReadonlyMap<string, string>;
}

/** The flattened tree, in visual order. */
export function flattenOutline(
  script: unknown,
  findings: ReadonlyArray<Finding> = [],
  options: OutlineOptions = {},
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const sections = arrayOf(isObject(script) ? script['sections'] : undefined);

  rows.push({
    key: 'script',
    parentKey: null,
    kind: 'script',
    level: 0,
    selection: {kind: 'script'},
    label: isObject(script) && typeof script['name'] === 'string' ? script['name'] : S.editor.scriptWord,
    secondary: fillTemplate(S.outline.sectionsCount, {count: sections.length}),
    markers: {warning: hasWarning(findings, '')},
    search: '',
  });

  sections.forEach((section, sectionIndex) => {
    const sectionKey = `s${sectionIndex}`;
    const counts = sectionCounts(section);
    rows.push({
      key: sectionKey,
      parentKey: 'script',
      kind: 'section',
      level: 1,
      selection: {kind: 'section', section: sectionIndex},
      label: isObject(section) && typeof section['name'] === 'string'
        ? section['name']
        : fillTemplate(S.outline.sectionLabel, {n: sectionIndex + 1}),
      secondary: fillTemplate(S.centre.counts, {fixed: counts.fixed, drawn: counts.drawn}),
      markers: {
        training: isObject(section) && section['training'] === true,
        warning: hasWarning(findings, `sections[${sectionIndex}]`),
      },
      search: '',
    });

    const groups = arrayOf(isObject(section) ? section['groups'] : undefined);
    groups.forEach((group, groupIndex) => {
      const groupKey = `${sectionKey}.g${groupIndex}`;
      const groupPath = `sections[${sectionIndex}].groups[${groupIndex}]`;
      const placeholder = drawnPlaceholder(group);
      const bank = placeholder === null ? null : drawnSource(placeholder);
      const items = arrayOf(isObject(group) ? group['promptItems'] : undefined);

      if (bank !== null) {
        const bankId = String(bank.bank ?? '');
        const bankName = options.bankNames?.get(bankId) ?? bankId;
        rows.push({
          key: groupKey,
          parentKey: sectionKey,
          kind: 'group',
          level: 2,
          selection: {kind: 'group', section: sectionIndex, group: groupIndex},
          label: S.centre.drawnGroupCaption,
          secondary: bankName,
          markers: {
            drawn: {count: Number(bank.count) || 0, bank: bankName},
            warning: hasWarning(findings, groupPath),
          },
          search: `${bank.itemcodePrefix ?? ''} ${bankName}`.toLowerCase(),
        });
        return;
      }

      rows.push({
        key: groupKey,
        parentKey: sectionKey,
        kind: 'group',
        level: 2,
        selection: {kind: 'group', section: sectionIndex, group: groupIndex},
        label: fillTemplate(S.outline.groupLabel, {n: groupIndex + 1}),
        secondary: fillTemplate(S.outline.itemsCount, {count: items.length}),
        markers: {warning: hasWarning(findings, groupPath)},
        search: '',
      });

      items.forEach((item, itemIndex) => {
        const prompt = clip(promptText(item as PromptItem));
        const itemPath = `${groupPath}.promptItems[${itemIndex}]`;
        rows.push({
          key: `${groupKey}.i${itemIndex}`,
          parentKey: groupKey,
          kind: 'item',
          level: 3,
          selection: {kind: 'item', section: sectionIndex, group: groupIndex, item: itemIndex},
          label: isObject(item) && typeof item['itemcode'] === 'string' && item['itemcode'].trim() !== ''
            ? item['itemcode']
            : S.editor.itemWord,
          secondary: prompt,
          markers: {
            playsMedia: itemPlaysMedia(item),
            warning: hasWarning(findings, itemPath),
          },
          search: `${isObject(item) ? item['itemcode'] ?? '' : ''} ${prompt}`.toLowerCase(),
        });
      });
    });
  });

  return rows;
}

/**
 * Keeps rows whose search text matches `query`, plus every ancestor of a match. An empty query
 * keeps everything. Groups and sections are never matched directly — they are the path to a match.
 */
export function filterOutline(rows: ReadonlyArray<OutlineRow>, query: string): OutlineRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...rows];
  }
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const kept = new Set<string>();
  for (const row of rows) {
    if (row.kind !== 'item' && row.kind !== 'group') {
      continue;
    }
    if (!row.search.includes(needle)) {
      continue;
    }
    let key: string | null = row.key;
    while (key !== null && !kept.has(key)) {
      kept.add(key);
      key = byKey.get(key)?.parentKey ?? null;
    }
  }
  return rows.filter((row) => kept.has(row.key));
}
