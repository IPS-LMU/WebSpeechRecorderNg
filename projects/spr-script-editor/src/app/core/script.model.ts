/**
 * The editor's view of a script and the shapes of the read endpoints.
 *
 * The model itself lives in the library (`speechrecorderng`), a single definition shared with the
 * recorder. The editor adds only what it needs: the library-list summary (rest-api.md §2.1) and
 * the loose view of a script whose unknown keys must survive a round trip (data-model.md §6):
 * the recorder writes `speakerDisplay`, `sectionPosition` and the like, and the editor must not
 * drop them. `EditorSection.groups` is therefore optional — a legacy section carries `promptUnits`
 * instead (invariant 10, N06).
 */
import type {
  BankItem,
  BankSource,
  DrawFilter,
  DrawFixedBy,
  Group,
  Mediaitem,
  Mode,
  Order,
  Playback,
  PromptItem,
  PromptPhase,
  Script,
  VirtualViewBox,
} from 'speechrecorderng';

export type ScriptStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SessionCounts {
  total: number;
  started: number;
  byVersion: Record<string, number>;
}

/** One row of `GET project/{p}/script`. */
export interface ScriptSummary {
  scriptId: string | number;
  name: string;
  status: ScriptStatus;
  publishedVersion?: number | null;
  draftVersion?: number;
  sections?: number;
  fixedItems?: number;
  drawnItems?: number;
  /**
   * The codes a search can find in this script (rest-api §2.1): its fixed itemcodes plus each drawn
   * placeholder's prefix. The library's filter matches these, which is what makes ui-spec §2's
   * "search by name, id or itemcode" true.
   */
  itemcodes?: readonly string[];
  sessions?: SessionCounts;
  modified?: string;
  modifiedBy?: string;
  archived?: boolean;
}

/** `GET {api}version` (rest-api.md §1.1). */
export interface RecorderVersion {
  recorderVersion: string;
}

/** One group, as loaded: `_shuffledPromptItems` is filled by `load.ts`, never by the server. */
export interface EditorGroup {
  order?: Order;
  promptItems?: PromptItem[];
  _shuffledPromptItems?: PromptItem[];
  [key: string]: unknown;
}

/**
 * One section, as loaded. `promptUnits` is the legacy shape (data-model.md §4 invariant 10); a
 * section with `promptUnits` and no `groups` is left untouched by `load.ts`.
 */
export interface EditorSection {
  name?: string;
  mode?: Mode;
  promptphase?: PromptPhase;
  order?: Order;
  training?: boolean;
  groups?: EditorGroup[];
  promptUnits?: PromptItem[];
  _shuffledGroups?: EditorGroup[];
  [key: string]: unknown;
}

/** A script as loaded, preserving keys the editor does not model. */
export interface EditorScript {
  type?: string;
  scriptId?: string | number;
  name?: string;
  minRecorderVersion?: string;
  virtualViewBox?: VirtualViewBox;
  sections?: EditorSection[];
  [key: string]: unknown;
}

export interface BankItemQuery {
  category?: string;
  minWords?: number;
  maxWords?: number;
  hasAudio?: boolean;
  tags?: string[];
  q?: string;
  limit?: number;
  offset?: number;
}

/** `GET project/{p}/bank/{b}/item` (rest-api.md §3.2). */
export interface BankItemPage {
  matchCount: number;
  withoutAudio?: number;
  offset?: number;
  items: BankItem[];
}

export interface DrawItem {
  itemcode: string;
  bankItemId?: string | null;
  recorded?: boolean;
}

/** One row of the draw record (rest-api.md §4.2). */
export interface DrawRow {
  sessionId: string | number;
  speaker?: string | null;
  status: string;
  /** `true` for a `type: "TEST"` dry run; the receiver sets it (`rest-api.md` §4.2). */
  preview?: boolean;
  scriptVersion?: number | null;
  drawnDate?: string | null;
  bank?: string | null;
  bankSource?: BankSource | null;
  drawn?: number;
  recorded?: number;
  items?: DrawItem[];
}

export interface DrawPage {
  total: number;
  rows: DrawRow[];
}

/** One `Session.bankDraws` entry (data-model.md §2.4) as the trace returns it. */
export interface TraceBankDraw {
  kind?: string;
  placeholderItemcode?: string | null;
  bank?: string;
  bankSource?: BankSource | null;
  filter?: DrawFilter;
  count?: number;
  fixedBy?: DrawFixedBy;
  /** The PRNG key the server drew with. */
  key?: string;
  itemcodePrefix?: string;
  items?: DrawItem[];
  refilled?: boolean;
  skippedRecorded?: boolean;
  speakerFallback?: boolean;
  drawnForVersion?: number | null;
}

/** `Session.prefills` (the shipped prefill mechanism) as the trace carries it. */
export interface TracePrefill {
  source?: string;
  list?: string;
}

/** The session trace `GET project/{p}/session/{s}/draws` returns (data-model.md §2.4). */
export interface SessionDrawTrace {
  sessionId?: string | number;
  /** The original script id (`scriptSource ?? script`). */
  script?: string | number | null;
  scriptVersion?: number | null;
  drawnDate?: string | null;
  redraw?: number;
  /** One entry per placeholder itemcode for list sources. */
  prefills?: Record<string, TracePrefill>;
  bankDraws?: TraceBankDraw[];
  [key: string]: unknown;
}

export interface MediaUsedBy {
  scriptId: string | number;
  version?: number;
  draft?: boolean;
}

/** `GET project/{p}/media` (rest-api.md §5). */
export interface MediaEntry {
  src: string;
  mimetype?: string;
  durationMs?: number | null;
  bytes?: number;
  usedBy?: MediaUsedBy[];
}

export type {
  Group,
  Mediaitem,
  Playback,
  PromptItem,
  Script,
};
