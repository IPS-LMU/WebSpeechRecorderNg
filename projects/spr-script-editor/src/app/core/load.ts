/**
 * Editor-side script loader (plan M2, E1). The recorder's `randomize()` shuffles a script's
 * `groups`/`promptItems` into `_shuffledGroups`/`_shuffledPromptItems` before a session runs
 * (`speechrecorderng.component.ts`). The read-only editor views walk the same fields but must
 * **not** reorder anything: the draft's order is what the researcher sees and edits.
 *
 * `loadScript` therefore fills the shuffled views with the real arrays, verbatim, and leaves every
 * other key untouched — including the legacy `promptUnits` shape, where a fabricated `groups: []`
 * would silently change what the recorder runs (data-model.md §4 invariant 10, A4/D-M).
 */
import type {EditorGroup, EditorScript, EditorSection} from './script.model';

export function loadScript<T extends EditorScript>(script: T): T {
  if (!script || !Array.isArray(script.sections)) {
    return script;
  }
  for (const section of script.sections as EditorSection[]) {
    if (!section || !Array.isArray(section.groups)) {
      // Either nothing to walk, or a legacy `promptUnits` section: do not invent `groups`.
      continue;
    }
    section._shuffledGroups = section.groups;
    for (const group of section.groups as EditorGroup[]) {
      if (group && Array.isArray(group.promptItems)) {
        group._shuffledPromptItems = group.promptItems;
      }
    }
  }
  return script;
}
