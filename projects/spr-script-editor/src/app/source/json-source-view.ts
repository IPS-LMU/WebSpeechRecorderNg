/**
 * Pure helpers behind the JSON source view (ui-spec §5, D-E): line numbers for the gutter, the
 * parse gate, the gutter dots derived from the check catalogue's findings, and the canonical
 * serialisation used for Format and for pushing a fixed model back through the draft service.
 */
import {parseJsonSource, serialiseJson, type JsonLineError} from '../core/validation';
import type {EditorScript} from '../core/script.model';
import type {Finding} from '../core/validation/types';

export interface SourceParseState {
  /** `syntax` = malformed JSON; `shape` = parses but is not an object; `ok` = applies to the draft. */
  kind: 'ok' | 'syntax' | 'shape';
  error: JsonLineError | null;
  applicable: boolean;
}

/** The parse gate the source view shows; the draft service applies exactly the `ok` case. */
export function sourceParseState(text: string): SourceParseState {
  const parsed = parseJsonSource(text);
  if (!parsed.ok) {
    return {kind: 'syntax', error: parsed.error ?? {message: 'Invalid JSON', line: 1, column: 1}, applicable: false};
  }
  const value = parsed.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {kind: 'shape', error: null, applicable: false};
  }
  return {kind: 'ok', error: null, applicable: true};
}

/** The 1-based line numbers of `text`, one per logical line for the gutter. */
export function lineNumbers(text: string): number[] {
  const count = text.split('\n').length;
  return Array.from({length: count}, (_, index) => index + 1);
}

/**
 * Maps each line of `text` to the findings whose path starts on it, for the gutter dots. A path
 * that no longer resolves (the text was edited past it) contributes no dot.
 */
export function dotsByLine(text: string, findings: ReadonlyArray<Finding>): Map<number, Finding[]> {
  const parsed = parseJsonSource(text);
  const dots = new Map<number, Finding[]>();
  for (const finding of findings) {
    const line = parsed.lineOf(finding.path);
    if (line === null) {
      continue;
    }
    const list = dots.get(line);
    if (list === undefined) {
      dots.set(line, [finding]);
    } else {
      list.push(finding);
    }
  }
  return dots;
}

/** The canonical text of a JSON object, or `null` when it is not one. Used by Format. */
export function formatSourceJson(text: string): string | null {
  const parsed = parseJsonSource(text);
  const value = parsed.value;
  if (!parsed.ok || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return serialiseJson(value, {sortKeys: false, indent: '  '});
}

/**
 * Serialises a model for the draft service's `setText`, stripping the `_shuffled*` runtime mirrors
 * that `load.ts` fills (D-F): the bytes that would be PUT must never carry them.
 */
export function draftTextOfModel(model: EditorScript): string {
  const copy = structuredClone(model) as EditorScript;
  for (const section of copy.sections ?? []) {
    delete (section as Record<string, unknown>)['_shuffledGroups'];
    for (const group of section.groups ?? []) {
      delete (group as Record<string, unknown>)['_shuffledPromptItems'];
    }
  }
  return serialiseJson(copy, {sortKeys: false, indent: '  '});
}
