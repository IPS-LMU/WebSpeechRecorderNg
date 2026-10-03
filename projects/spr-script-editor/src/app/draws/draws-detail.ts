import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {type BankItem, type DrawFilter} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {filterParts, statusKind, traceNotes, type DrawRowModel, type SessionTraceModel} from './draws-map';
import {speakerLabel} from './draws-speaker';
import {DRAWS_STRINGS} from './draws-strings';

/** One page big enough to resolve every bank id a session might have drawn. */
const BANK_PAGE_LIMIT = 2000;

export type DrawTraceState = 'idle' | 'loading' | 'ready' | 'error';

interface BankTextState {
  status: 'ready' | 'error';
  items: Record<string, string | null>;
}

/** `bankItemId → what the library shows for it`, `null` when the item has no displayable text. */
function itemsByText(items: BankItem[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const item of items) {
    const text = item.text ?? item.src ?? (item.promptDoc === undefined ? null : DRAWS_STRINGS.textFormatted);
    map[String(item.bankItemId)] = text ?? null;
  }
  return map;
}

/**
 * The detail panel of the resolved-draws screen (ui-spec §7): the selected session's trace — the
 * seed inputs and flags, the materialised items and the session-case notes — over the record row
 * the table already holds.
 *
 * The trace records bank item ids only, so the text column resolves them against the bank as it
 * stands now (`ui-spec §7`'s "text"); when the bank cannot be read the ids remain and the column
 * says so, because the ids, not the text, are the record.
 */
@Component({
  selector: 'spre-draws-detail',
  standalone: true,
  imports: [],
  templateUrl: './draws-detail.html',
  styleUrl: './draws-detail.scss',
})
export class DrawsDetail {
  private readonly banks = inject(BankApiService);

  readonly strings = DRAWS_STRINGS;
  readonly statusKind = statusKind;
  readonly speakerLabel = speakerLabel;
  /** Static string-keyed lookup (data-model §2.2). */
  readonly fixedByLabels: Record<string, string> = {
    SESSION: DRAWS_STRINGS.fixedBySession,
    SPEAKER: DRAWS_STRINGS.fixedBySpeaker,
    SCRIPT: DRAWS_STRINGS.fixedByScript,
  };

  readonly projectId = input.required<string>();
  readonly row = input<DrawRowModel | null>(null);
  readonly trace = input<SessionTraceModel | null>(null);
  readonly state = input<DrawTraceState>('idle');
  readonly error = input<string | null>(null);

  readonly bankText = signal<Record<string, BankTextState>>({});
  readonly notes = computed(() => {
    const trace = this.trace();
    return trace === null ? [] : traceNotes(trace);
  });
  /** Itemcodes the record marks recorded; the trace itself does not carry the flag. */
  readonly recordedCodes = computed(() => {
    const row = this.row();
    return new Set((row?.items ?? []).filter((item) => item.recorded === true).map((item) => item.itemcode));
  });

  constructor() {
    // Bank item texts: the trace records ids; the current text is a courtesy lookup (ui-spec §7).
    effect((onCleanup) => {
      const trace = this.trace();
      if (trace === null) {
        this.bankText.set({});
        return;
      }
      const project = this.projectId();
      const banks = [...new Set(trace.bankDraws.map((draw) => draw.bank).filter((bank) => bank !== ''))];
      this.bankText.set({});
      const subscriptions = banks.map((bank) =>
        this.banks.items(project, bank, {limit: BANK_PAGE_LIMIT}).subscribe({
          next: (page) => this.bankText.update((current) => ({...current, [bank]: {status: 'ready', items: itemsByText(page.items)}})),
          error: () => this.bankText.update((current) => ({...current, [bank]: {status: 'error', items: {}}})),
        }),
      );
      onCleanup(() => subscriptions.forEach((subscription) => subscription.unsubscribe()));
    });
  }

  itemText(bank: string, bankItemId: string | null): string {
    if (bankItemId === null) {
      return this.strings.unrecorded;
    }
    const entry = this.bankText()[bank];
    if (entry === undefined) {
      return '';
    }
    if (entry.status === 'error') {
      return this.strings.textUnavailable;
    }
    const text = entry.items[bankItemId];
    return text === undefined || text === null ? this.strings.textUnknown : text;
  }

  bankUnreachable(bank: string): boolean {
    return this.bankText()[bank]?.status === 'error';
  }

  noteText(code: string): string {
    switch (code) {
      case 'skippedRecorded':
        return this.strings.noteSkipped;
      case 'refilled':
        return this.strings.noteRefilled;
      case 'speakerFallback':
        return this.strings.seedFallback;
      case 'redrawn':
        return this.strings.noteRedrawn;
      default:
        return '';
    }
  }

  filterLabel(key: string): string {
    switch (key) {
      case 'category':
        return this.strings.filterCategory;
      case 'words':
        return this.strings.filterWords;
      case 'audio':
        return this.strings.filterAudioWith;
      case 'q':
        return this.strings.filterQ;
      case 'tags':
        return this.strings.filterTags;
      default:
        return key;
    }
  }

  /** `filterParts` values are structured; the audio part is the only one with two readings. */
  filterValue(part: {key: string; value: string}): string {
    if (part.key !== 'audio') {
      return part.value;
    }
    return part.value === 'with' ? this.strings.filterAudioWith : this.strings.filterAudioWithout;
  }

  parts(filter: DrawFilter): Array<{key: string; value: string}> {
    return filterParts(filter);
  }
}
