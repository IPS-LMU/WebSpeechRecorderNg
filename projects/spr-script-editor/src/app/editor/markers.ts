/**
 * The markers an outline row shows after its label and secondary text (ui-spec §3.1), derived from
 * the draft and the check catalogue: a dice for a drawn group, a speaker for an item that plays
 * media, a Training chip, a warning triangle where a finding's path applies.
 *
 * Everything here is a pure function of the draft and the findings, so the outline's markers
 * cannot disagree with the checks panel.
 */
import {MediaitemUtil, type PrefillBankSource, type PromptItem} from 'speechrecorderng';
import {findingsUnder, type Finding} from '../core/validation';

export interface RowMarkers {
  /** Dice marker: the draw rule, when the group is drawn. */
  drawn?: {count: number; bank: string};
  /** Speaker marker: the item plays media. */
  playsMedia?: boolean;
  /** Training chip: the section is training. */
  training?: boolean;
  /** Warning triangle: a finding's path applies to this row or its subtree. */
  warning?: boolean;
}

/** The item's bank source, or `null` when it is not a drawn placeholder. */
export function drawnSource(item: unknown): PrefillBankSource | null {
  const prefill = (item as PromptItem | null | undefined)?.prefill;
  const bank = prefill?.bank;
  return bank ?? null;
}

/** True when the group holds a placeholder drawing from a bank. */
export function isDrawnGroup(group: unknown): boolean {
  const items = (group as {promptItems?: unknown[]} | null | undefined)?.promptItems;
  return Array.isArray(items) && items.some((item) => drawnSource(item) !== null);
}

/** The first placeholder of a drawn group, which carries the draw rule. */
export function drawnPlaceholder(group: unknown): PromptItem | null {
  const items = (group as {promptItems?: PromptItem[]} | null | undefined)?.promptItems;
  return Array.isArray(items) ? items.find((item) => drawnSource(item) !== null) ?? null : null;
}

/** True when any of the item's mediaitems is audio (ui-spec §3.1's speaker marker). */
export function itemPlaysMedia(item: unknown): boolean {
  const mediaitems = (item as PromptItem | null | undefined)?.mediaitems;
  return Array.isArray(mediaitems) && mediaitems.some((mediaitem) => MediaitemUtil.kind(mediaitem) === 'audio');
}

/** Whether any finding's path is `path` or a descendant of it (validation.md's outline marking). */
export function hasWarning(findings: ReadonlyArray<Finding>, path: string): boolean {
  return findingsUnder(findings, path).length > 0;
}
