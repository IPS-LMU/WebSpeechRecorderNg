import {Group, Mediaitem, PromptItem, PromptItemPrefill, Recinstructions, Script, Section} from "./script";

/**
 * One word (or sentence) list of a prefill source.
 */
export interface PrefillSourceList {
  /** Identifier of the list; stored in the session record for traceability. */
  id: string;
  /** The entries, presented one per generated prompt item. */
  entries: Array<string>;
}

/**
 * The document a prefill source resolves to:
 *
 * ```json
 * {
 *   "lists": [
 *     {"id": "1", "entries": ["apa", "bil", ... ]},
 *     ...
 *   ]
 * }
 * ```
 */
export interface PrefillSource {
  lists: Array<PrefillSourceList>;
}

/**
 * A resolved draw: which list of which source fills one prompt item. Persisted on the session
 * (`Session.prefills`) so the session can be traced back to the drawn lists and a reload
 * reproduces the same prompt items (and therefore matches already recorded files).
 */
export interface PrefillChoice {
  source: string;
  list: string;
}

/** Per item code the drawn list, keyed by the placeholder item's code. */
export type PrefillChoices = Record<string, PrefillChoice>;

/** A placeholder item and its prefill declaration, in script order. */
export interface PrefillSpec {
  itemcode: string;
  spec: PromptItemPrefill & {source: string};
}

const ENTRY_TOKEN = '{entry}';
const POSITION_TOKEN = '{n}';

/**
 * Resolves the prefill declarations of a script: replaces each placeholder prompt item by one
 * generated item per entry of the drawn list. Pure and deterministic — the draw (which list
 * fills which item) is passed in, the caller decides between the stored session choice and a
 * fresh random draw.
 */
export class ScriptPrefillUtil {

  /** The prefill declarations of a script, in script order, keyed by placeholder item code. */
  static specs(script: Script): Array<PrefillSpec> {
    const found: Array<PrefillSpec> = [];
    for (const section of script.sections ?? []) {
      for (const group of section.groups ?? []) {
        for (const item of group.promptItems ?? []) {
          if (item.prefill != null && item.prefill.source != null && item.itemcode != null) {
            found.push({itemcode: item.itemcode, spec: {...item.prefill, source: item.prefill.source}});
          }
        }
      }
    }
    return found;
  }

  /** The item code of the n-th generated item (`{n}` is the 1-based position). */
  static itemcodeOf(format: string, n: number): string {
    return format.split(POSITION_TOKEN).join(String(n));
  }

  /**
   * Draws a list of the source: the list of `choice` when it exists in the source, a random
   * list otherwise. `null` when the source holds no lists.
   */
  static drawList(source: PrefillSource, choice: PrefillChoice | null | undefined): PrefillSourceList | null {
    const lists = source?.lists ?? [];
    if (choice != null) {
      const stored = lists.find((list) => list.id === choice.list);
      if (stored !== undefined) {
        return stored;
      }
    }
    if (lists.length === 0) {
      return null;
    }
    return lists[Math.floor(Math.random() * lists.length)];
  }

  /**
   * The stored choice for a declaration, or `null`: a choice drawn for a different source is
   * stale (the script changed) and must not pin a list by its id alone.
   */
  static choiceFor(sourceId: string, choice: PrefillChoice | null | undefined): PrefillChoice | null {
    return choice != null && choice.source === sourceId ? choice : null;
  }

  /**
   * Replaces every placeholder prompt item by one generated item per entry of the drawn list.
   * `sources` maps a source id to its document, `choices` the drawn list per placeholder item
   * code. Throws when a declaration cannot be resolved so a half-filled script never reaches
   * the stage.
   */
  static expand(script: Script, sources: Map<string, PrefillSource>, choices: PrefillChoices): Script {
    const sections = script.sections.map((section) => ScriptPrefillUtil.expandSection(section, sources, choices));
    return {...script, sections};
  }

  private static expandSection(section: Section, sources: Map<string, PrefillSource>, choices: PrefillChoices): Section {
    const groups = section.groups.map((group) => ScriptPrefillUtil.expandGroup(group, sources, choices));
    return {...section, groups};
  }

  private static expandGroup(group: Group, sources: Map<string, PrefillSource>, choices: PrefillChoices): Group {
    const promptItems: Array<PromptItem> = [];
    for (const item of group.promptItems ?? []) {
      const spec = item.prefill;
      if (spec == null || spec.source == null) {
        // No prefill, or a bank source: the server resolves those at session creation (D-W).
        promptItems.push(item);
        continue;
      }
      const itemcode = item.itemcode ?? '';
      const source = sources.get(spec.source);
      if (source == null) {
        throw new Error(`prefill of item ${itemcode}: source '${spec.source}' was not fetched`);
      }
      const list = ScriptPrefillUtil.drawList(source, ScriptPrefillUtil.choiceFor(spec.source, choices[itemcode]));
      if (list == null) {
        throw new Error(`prefill of item ${itemcode}: source '${spec.source}' holds no lists`);
      }
      const {prefill: _prefill, mediaitems: _mediaitems, itemcode: _itemcode, ...template} = item;
      for (let n = 0; n < list.entries.length; n++) {
        promptItems.push(ScriptPrefillUtil.generatedItem(template, spec, list.entries[n], n + 1));
      }
    }
    return {...group, promptItems};
  }

  private static generatedItem(template: Omit<PromptItem, 'prefill' | 'mediaitems' | 'itemcode'>, spec: PromptItemPrefill, entry: string, n: number): PromptItem {
    const item: PromptItem = {
      ...template,
      itemcode: ScriptPrefillUtil.itemcodeOf(spec.itemcodeFormat ?? '{n}', n),
      mediaitems: (spec.mediaitems ?? []).map((mediaitem) => ScriptPrefillUtil.fillMediaitem(mediaitem, entry)),
    };
    if (spec.recinstructions !== undefined && spec.recinstructions !== null) {
      const recinstructions: Recinstructions = {recinstructions: spec.recinstructions};
      item.recinstructions = recinstructions;
    }
    return item;
  }

  /** Replaces `{entry}` in the template fields of a media item; other fields are untouched. */
  static fillMediaitem(mediaitem: Mediaitem, entry: string): Mediaitem {
    const filled: Mediaitem = {...mediaitem};
    if (typeof mediaitem.text === 'string') {
      filled.text = mediaitem.text.split(ENTRY_TOKEN).join(entry);
    }
    if (typeof mediaitem.src === 'string') {
      filled.src = mediaitem.src.split(ENTRY_TOKEN).join(entry);
    }
    if (typeof mediaitem.alt === 'string') {
      filled.alt = mediaitem.alt.split(ENTRY_TOKEN).join(entry);
    }
    return filled;
  }
}
