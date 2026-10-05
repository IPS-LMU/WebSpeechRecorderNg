/**
 * The editor's selected node, and its `?sel=` round trip (ui-spec §1, §3).
 *
 * The selection is in the URL so a reload restores the view:
 *
 *   script | s:2 | g:2:1 | i:2:0:1
 *
 * Parsing is purely syntactic; `sanitiseSelection` resolves the indices against the draft and
 * falls back to the nearest existing ancestor (ui-spec §9's "never show something that is not
 * there"), ending at the script.
 */
import {arrayOf, isObject} from '../core/validation/walk';

export type Selection =
  | {kind: 'script'}
  | {kind: 'section'; section: number}
  | {kind: 'group'; section: number; group: number}
  | {kind: 'item'; section: number; group: number; item: number};

export const SCRIPT_SELECTION: Selection = {kind: 'script'};

/** The `?sel=` form of a selection. */
export function formatSelection(selection: Selection): string {
  switch (selection.kind) {
    case 'section':
      return `s:${selection.section}`;
    case 'group':
      return `g:${selection.section}:${selection.group}`;
    case 'item':
      return `i:${selection.section}:${selection.group}:${selection.item}`;
    default:
      return 'script';
  }
}

function index(part: string | undefined): number | null {
  if (part === undefined || part === '') {
    return null;
  }
  if (!/^\d+$/.test(part)) {
    return null;
  }
  const value = Number(part);
  return Number.isSafeInteger(value) ? value : null;
}

/** Parses `raw` without looking at the draft; `null` when it is not a known selection. */
export function parseSelection(raw: string | null | undefined): Selection | null {
  const value = (raw ?? '').trim();
  if (value === '' || value === 'script') {
    return value === 'script' ? {kind: 'script'} : null;
  }
  const parts = value.split(':');
  if (parts[0] === 's' && parts.length === 2) {
    const section = index(parts[1]);
    return section === null ? null : {kind: 'section', section};
  }
  if (parts[0] === 'g' && parts.length === 3) {
    const section = index(parts[1]);
    const group = index(parts[2]);
    return section === null || group === null ? null : {kind: 'group', section, group};
  }
  if (parts[0] === 'i' && parts.length === 4) {
    const section = index(parts[1]);
    const group = index(parts[2]);
    const item = index(parts[3]);
    return section === null || group === null || item === null
      ? null
      : {kind: 'item', section, group, item};
  }
  return null;
}

function sectionsOf(script: unknown): unknown[] {
  return arrayOf((isObject(script) ? script['sections'] : undefined));
}

function groupsOf(script: unknown, section: number): unknown[] {
  const value = sectionsOf(script)[section];
  return arrayOf(isObject(value) ? value['groups'] : undefined);
}

function itemsOf(script: unknown, section: number, group: number): unknown[] {
  const value = groupsOf(script, section)[group];
  return arrayOf(isObject(value) ? value['promptItems'] : undefined);
}

function hasSection(script: unknown, section: number): boolean {
  return section >= 0 && section < sectionsOf(script).length;
}

function hasGroup(script: unknown, section: number, group: number): boolean {
  return hasSection(script, section) && group >= 0 && group < groupsOf(script, section).length;
}

function hasItem(script: unknown, section: number, group: number, item: number): boolean {
  return hasGroup(script, section, group) && item >= 0 && item < itemsOf(script, section, group).length;
}

/**
 * Resolves a parsed selection against the draft, falling back to the nearest existing ancestor.
 * A `null` selection (or a `?sel=` that does not parse) becomes the script.
 */
export function sanitiseSelection(selection: Selection | null, script: unknown): Selection {
  if (selection === null) {
    return SCRIPT_SELECTION;
  }
  switch (selection.kind) {
    case 'script':
      return SCRIPT_SELECTION;
    case 'section':
      return hasSection(script, selection.section)
        ? {kind: 'section', section: selection.section}
        : SCRIPT_SELECTION;
    case 'group':
      if (hasGroup(script, selection.section, selection.group)) {
        return {kind: 'group', section: selection.section, group: selection.group};
      }
      return hasSection(script, selection.section)
        ? {kind: 'section', section: selection.section}
        : SCRIPT_SELECTION;
    default:
      if (hasItem(script, selection.section, selection.group, selection.item)) {
        return selection;
      }
      if (hasGroup(script, selection.section, selection.group)) {
        return {kind: 'group', section: selection.section, group: selection.group};
      }
      return hasSection(script, selection.section)
        ? {kind: 'section', section: selection.section}
        : SCRIPT_SELECTION;
  }
}

/** The `?sel=` string resolved against the draft (the value the screen should hold). */
export function selectionFromQuery(raw: string | null | undefined, script: unknown): Selection {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return SCRIPT_SELECTION;
  }
  return sanitiseSelection(parseSelection(raw), script);
}

/** The JSON path of the selected node, or `''` for the script (validation.md paths). */
export function selectionPath(selection: Selection): string {
  switch (selection.kind) {
    case 'section':
      return `sections[${selection.section}]`;
    case 'group':
      return `sections[${selection.section}].groups[${selection.group}]`;
    case 'item':
      return `sections[${selection.section}].groups[${selection.group}].promptItems[${selection.item}]`;
    default:
      return '';
  }
}

export function selectionEquals(a: Selection, b: Selection): boolean {
  return formatSelection(a) === formatSelection(b);
}
