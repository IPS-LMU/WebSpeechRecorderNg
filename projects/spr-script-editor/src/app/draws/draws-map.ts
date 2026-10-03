/**
 * Pure mapping for the resolved-draws screen (ui-spec §7).
 *
 * The receiver is the only thing that resolves a draw (plan D-U); this module never does. It turns
 * the two shapes the receiver returns into the shapes the screen renders and the CSV exports:
 *
 * - `GET project/{p}/script/{id}/draws` → rows, one per drawn session (`parseDrawPage`);
 * - `GET project/{p}/session/{s}/draws` → the trace: the seed inputs, the flags and the items
 *   actually materialised (`parseSessionTrace`).
 *
 * Everything here is pure, so the trace→table/detail mapping, the CSV derivation and the re-draw
 * enablement rule are pinned by specs without a browser or a server.
 */
import type {BankSource, DrawFilter, DrawFixedBy} from 'speechrecorderng';
import type {DrawItem, DrawPage, DrawRow, SessionDrawTrace} from '../core/script.model';

/** One drawn item as the trace and the record carry it; `text` is resolved separately, never here. */
export interface DrawItemModel {
  itemcode: string;
  bankItemId: string | null;
  /** `null` when the shape has no recording flag (the session trace); the record sets it. */
  recorded: boolean | null;
}

/** One `Session.bankDraws` entry (data-model §2.4). */
export interface BankDraw {
  kind: 'bank';
  placeholderItemcode: string | null;
  bank: string;
  bankSource: BankSource | null;
  filter: DrawFilter;
  count: number | null;
  fixedBy: DrawFixedBy;
  /** The PRNG key the server drew with, e.g. `session:2042#1`. */
  key: string | null;
  itemcodePrefix: string;
  items: DrawItemModel[];
  refilled: boolean;
  skippedRecorded: boolean;
  speakerFallback: boolean;
  drawnForVersion: number | null;
}

/** A list-source entry of `Session.prefills` (the shipped prefill mechanism, D-W). */
export interface ListDraw {
  kind: 'list';
  placeholderItemcode: string;
  source: string;
  list: string;
}

/** The session trace, normalised. */
export interface SessionTraceModel {
  sessionId: string;
  script: string | null;
  scriptVersion: number | null;
  drawnDate: string | null;
  redraw: number;
  listDraws: ListDraw[];
  bankDraws: BankDraw[];
}

/** One row of the draw record, normalised. */
export interface DrawRowModel {
  sessionId: string;
  speaker: string | null;
  status: string;
  preview: boolean;
  scriptVersion: number | null;
  drawnDate: string | null;
  bank: string | null;
  bankSource: BankSource | null;
  drawn: number;
  recorded: number;
  items: DrawItemModel[];
}

export type RedrawReason = 'created' | 'started' | 'readOnly';

export type StatusKind = 'created' | 'loaded' | 'training' | 'started' | 'completed' | 'unknown';

function itemsOf(items: DrawItem[] | undefined, recordedKnown: boolean): DrawItemModel[] {
  return (items ?? [])
    .filter((item) => item !== null && item !== undefined && item.itemcode !== null && item.itemcode !== undefined)
    .map((item) => ({
      itemcode: String(item.itemcode),
      bankItemId: item.bankItemId === null || item.bankItemId === undefined ? null : String(item.bankItemId),
      recorded: recordedKnown ? item.recorded === true : null,
    }));
}

/** A draw record page (`rest-api §4.2`) into rows; missing fields stay `null`, never guessed. */
export function parseDrawPage(page: DrawPage | null | undefined): DrawRowModel[] {
  return (page?.rows ?? []).map((row: DrawRow) => {
    const items = itemsOf(row.items, true);
    return {
      sessionId: String(row.sessionId),
      speaker: row.speaker ?? null,
      status: row.status ?? 'UNKNOWN',
      preview: row.preview === true,
      scriptVersion: row.scriptVersion ?? null,
      drawnDate: row.drawnDate ?? null,
      bank: row.bank ?? null,
      bankSource: row.bankSource ?? null,
      drawn: row.drawn ?? items.length,
      recorded: row.recorded ?? items.filter((item) => item.recorded === true).length,
      items,
    };
  });
}

/** The session trace (`rest-api §4.2`) into the model the detail panel renders. */
export function parseSessionTrace(raw: SessionDrawTrace | null | undefined): SessionTraceModel {
  const prefills = raw?.prefills ?? {};
  return {
    sessionId: String(raw?.sessionId ?? ''),
    script: raw?.script === null || raw?.script === undefined ? null : String(raw.script),
    scriptVersion: raw?.scriptVersion ?? null,
    drawnDate: raw?.drawnDate ?? null,
    redraw: raw?.redraw ?? 0,
    listDraws: Object.entries(prefills).map(([placeholderItemcode, choice]) => ({
      kind: 'list' as const,
      placeholderItemcode,
      source: choice?.source ?? '',
      list: choice?.list ?? '',
    })),
    bankDraws: (raw?.bankDraws ?? []).map((draw) => ({
      kind: 'bank' as const,
      placeholderItemcode: draw.placeholderItemcode ?? null,
      bank: draw.bank ?? '',
      bankSource: draw.bankSource ?? null,
      filter: draw.filter ?? {},
      count: draw.count ?? null,
      fixedBy: draw.fixedBy ?? 'SESSION',
      key: draw.key ?? null,
      itemcodePrefix: draw.itemcodePrefix ?? '',
      items: itemsOf(draw.items, false),
      refilled: draw.refilled === true,
      skippedRecorded: draw.skippedRecorded === true,
      speakerFallback: draw.speakerFallback === true,
      drawnForVersion: draw.drawnForVersion ?? null,
    })),
  };
}

/** The receiver's statuses (`Session.Status`) collapsed to the label keys of the strings module. */
export function statusKind(status: string | null | undefined): StatusKind {
  switch (status) {
    case 'CREATED':
      return 'created';
    case 'LOADED':
      return 'loaded';
    case 'STARTED_TRAINING':
      return 'training';
    case 'STARTED':
      return 'started';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'unknown';
  }
}

/**
 * Re-draw is a write against `POST …/draws/_redraw`, which the receiver refuses `409` for anything
 * but a `CREATED` session (`rest-api §4.3`). The action is disabled with the reason instead of
 * letting the request fail (ui-spec §7). `readOnly` covers the fixture mode, where no server can
 * answer the write at all.
 */
export function redrawEnablement(
  status: string | null | undefined,
  options: {readOnly?: boolean} = {},
): {enabled: boolean; reason: RedrawReason} {
  if (options.readOnly === true) {
    return {enabled: false, reason: 'readOnly'};
  }
  return status === 'CREATED'
    ? {enabled: true, reason: 'created'}
    : {enabled: false, reason: 'started'};
}

/** `RB001, RB002 +3` — as many codes as fit, never the whole list. */
export function firstItemcodes(items: ReadonlyArray<DrawItemModel>, limit = 4): string {
  if (items.length === 0) {
    return '';
  }
  const shown = items.slice(0, limit).map((item) => item.itemcode).join(', ');
  const rest = items.length - Math.min(limit, items.length);
  return rest > 0 ? `${shown} +${rest}` : shown;
}

/** Structured filter parts so the template can label them without parsing a sentence. */
export function filterParts(filter: DrawFilter): Array<{key: string; value: string}> {
  const parts: Array<{key: string; value: string}> = [];
  if (filter.category !== undefined && filter.category !== '') {
    parts.push({key: 'category', value: filter.category});
  }
  if (Array.isArray(filter.words) && filter.words.length === 2) {
    parts.push({key: 'words', value: `${filter.words[0]}\u2013${filter.words[1]}`});
  }
  if (filter.hasAudio === true) {
    parts.push({key: 'audio', value: 'with'});
  } else if (filter.hasAudio === false) {
    parts.push({key: 'audio', value: 'without'});
  }
  if (filter.q !== undefined && filter.q !== '') {
    parts.push({key: 'q', value: filter.q});
  }
  if (Array.isArray(filter.tags) && filter.tags.length > 0) {
    parts.push({key: 'tags', value: filter.tags.join(', ')});
  }
  return parts;
}

/** Codes for the "this session's case" notes; the template turns them into sentences. */
export function traceNotes(trace: SessionTraceModel): string[] {
  const notes: string[] = [];
  if (trace.bankDraws.some((draw) => draw.skippedRecorded)) {
    notes.push('skippedRecorded');
  }
  if (trace.bankDraws.some((draw) => draw.refilled)) {
    notes.push('refilled');
  }
  if (trace.bankDraws.some((draw) => draw.speakerFallback)) {
    notes.push('speakerFallback');
  }
  if (trace.redraw > 0) {
    notes.push('redrawn');
  }
  return notes;
}

/** The receiver's `csvField` (server/api.mjs): quote only when the value needs it. */
export function csvField(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The CSV the Download action produces: one row per drawn item, exactly the rows the table shows,
 * in the receiver's byte format (`sessionId,speaker,itemcode,bankItemId,recorded`, LF, trailing
 * newline) so an export and a server-side `Accept: text/csv` download agree.
 */
export function toCsv(rows: ReadonlyArray<DrawRowModel>): string {
  const lines = ['sessionId,speaker,itemcode,bankItemId,recorded'];
  for (const row of rows) {
    for (const item of row.items) {
      lines.push(
        [
          row.sessionId,
          row.speaker ?? '',
          item.itemcode,
          item.bankItemId ?? '',
          item.recorded === true ? 'true' : 'false',
        ]
          .map(csvField)
          .join(','),
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
