/**
 * Shared types for the editor's check catalogue (doc/script-editor/validation.md).
 *
 * A `Finding` is what every check returns and what the checks panel renders: the `id` is the
 * stable catalogue key shared with `server/validate.mjs` and the corpus fixtures, `path` is a JSON
 * path into the draft (`sections[2].groups[0].promptItems[1].itemcode`), and `fix` names the
 * one-click repair `normalise.ts` can apply.
 */
import type {BankItem, DrawFilter} from 'speechrecorderng';

export type Severity = 'error' | 'warning' | 'note';

/**
 * The one-click fixes of D7 (doc/script-editor/data-model.md §6, validation.md). Only the data
 * fixes have an implementation in `normalise.ts`; the rest are UI actions the panel performs
 * (`focus`, `bank-picker`, `file-picker`).
 */
export type FixKind =
  | 'focus'
  | 'bank-picker'
  | 'file-picker'
  | 'add-group'
  | 'next-code'
  | 'clamp-count'
  | 'free-prefix'
  | 'rename-modern'
  | 'replace-order'
  | 'convert-groups'
  | 'keep-first-mediaitem'
  | 'keep-one-side';

export interface Finding {
  id: string;
  severity: Severity;
  /** JSON path into the script. */
  path: string;
  message: string;
  fix?: FixKind;
  /**
   * True when the check could not read the data it needs (E04, W05, W11): the finding must not
   * block publishing and the panel shows the count as unknown instead of claiming the draft is
   * valid (ui-spec §9).
   */
  suspended?: boolean;
  /** Inputs a fix needs (e.g. the first duplicate's path, the matched bank count). */
  data?: Record<string, unknown>;
}

/** What a check needs from the item bank; `items` follows the frozen `BankItem` shape. */
export interface BankView {
  bankId: string;
  items: ReadonlyArray<BankItem>;
  title?: string;
}

/**
 * Looks a bank up. `null` means the bank definitively does not exist; `undefined` means it could
 * not be read (offline, FILES mode without a bank fixture) and the dependent check is suspended
 * rather than passed.
 */
export type BankLookup = (bankId: string) => BankView | null | undefined;

/** The project's media paths. `null`/absent means the index could not be fetched (W11 suspended). */
export type MediaIndex = ReadonlyArray<string> | null;

/**
 * Per-bank clip durations, keyed by bank item id. `undefined` means the durations are unknown, so
 * W05 on a drawn group is suspended (validation.md's closing note).
 */
export type ClipDurations = (bankId: string) => ReadonlyMap<string, number> | undefined;

export interface ValidationContext {
  /** Bank lookup for E03, E04, W04 and W05. */
  bankLookup?: BankLookup;
  /** Clip durations for W05 on a drawn group. */
  clipDurations?: ClipDurations;
  /** The project's media list for W11. */
  mediaIndex?: MediaIndex;
  /** The version this deployment's recorder reports (W10, N04). */
  recorderVersion?: string;
  /** The draft before the edit, so N04 can tell whether the floor was lifted. */
  previousDraft?: unknown;
}

/**
 * A draft as read from the wire: untrusted JSON, possibly legacy (`promptUnits` and no `groups`)
 * or malformed. Checks must never assume the typed `Script` shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Draft = any;
