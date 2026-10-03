/**
 * JSON-path support for the checks panel (ui-spec §5, validation.md): the finding's `path` drives
 * the deep link into the editor and the `line · subject` card header.
 *
 * The selection format is the editor's `?sel=` grammar (ui-spec §1) — `script | s:2 | g:2:1 |
 * i:2:0:1`. It is re-declared here (not imported from `app/editor/selection.ts`) so the shared
 * validation UI does not depend on the editor screen.
 */
import {isObject} from '../core/validation/walk';
import type {Draft, Severity} from '../core/validation/types';

export type NodeSelection =
  | {kind: 'script'}
  | {kind: 'section'; section: number}
  | {kind: 'group'; section: number; group: number}
  | {kind: 'item'; section: number; group: number; item: number};

const TOKEN = /([^.[\]]+)|\[(\d+)\]/g;

/** Splits a JSON path into its tokens, mirroring `core/normalise.ts` and `json-lines.ts`. */
export function parsePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(path)) !== null) {
    tokens.push(match[2] !== undefined ? Number(match[2]) : match[1]);
  }
  return tokens;
}

/** The deepest node a finding's path addresses, or `script` for a script-level path. */
export function selectionFromPath(path: string): NodeSelection {
  const match = /^sections(?:\[(\d+)\](?:\.groups(?:\[(\d+)\](?:\.promptItems\[(\d+)\])?)?)?)?/.exec(path);
  if (match === null) {
    return {kind: 'script'};
  }
  const section = match[1] === undefined ? null : Number(match[1]);
  const group = match[2] === undefined ? null : Number(match[2]);
  const item = match[3] === undefined ? null : Number(match[3]);
  if (section === null) {
    return {kind: 'script'};
  }
  if (group === null) {
    return {kind: 'section', section};
  }
  if (item === null) {
    return {kind: 'group', section, group};
  }
  return {kind: 'item', section, group, item};
}

/** The `?sel=` value for a selection (ui-spec §1). */
export function formatSelection(selection: NodeSelection): string {
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

function nodeAt(draft: Draft, tokens: Array<string | number>): {label: string; consumed: number} {
  const section = tokens[1];
  const group = tokens[3];
  const item = tokens[5];
  if (typeof section !== 'number') {
    return {label: 'Script', consumed: 1};
  }
  if (typeof group !== 'number') {
    return {label: `Section ${section + 1}`, consumed: 2};
  }
  if (typeof item !== 'number') {
    return {label: `Group ${section + 1}.${group + 1}`, consumed: 4};
  }
  const entry = draft?.sections?.[section]?.groups?.[group]?.promptItems?.[item];
  const code = isObject(entry) && typeof entry['itemcode'] === 'string' ? entry['itemcode'].trim() : '';
  const label = code !== '' ? `Item ${code}` : `Item ${section + 1}.${group + 1}.${item + 1}`;
  return {label, consumed: 6};
}

/**
 * A compact label for a finding: the node it applies to, then the field within it. This is the
 * `subject` half of the card's `line · subject` header.
 */
export function subjectOf(draft: Draft, path: string): string {
  const tokens = parsePath(path);
  if (tokens[0] !== 'sections') {
    return path === '' ? 'Script' : `Script · ${path}`;
  }
  const {label, consumed} = nodeAt(draft, tokens);
  const field = tokens.slice(consumed).join('.');
  return field === '' ? label : `${label} · ${field}`;
}

/** The severity a server finding implies when its body omits one. E→error, W→warning, N→note. */
export function severityOfId(id: string): Severity {
  switch (id.charAt(0).toUpperCase()) {
    case 'E':
      return 'error';
    case 'W':
      return 'warning';
    case 'N':
      return 'note';
    default:
      return 'warning';
  }
}
