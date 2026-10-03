/**
 * The draw-rule editor (ui-spec §6, plan M4 row `E4 rule builder`): the bank source’s fields with
 * the live `matchCount` check, the read-only filter summary, the generated itemcodes and the
 * labelled example draw (D-J).
 *
 * `source` is the rule to edit and `change` carries every edit to the caller, which owns
 * persistence — this panel implements no save path of its own. It keeps a local draft synced from
 * `source` so it can render and commit its own edits even when the caller does not echo them back
 * (the editor’s inspector and the bank screen both consume the same component). `count` is
 * validated against the bank’s `matchCount`; when the bank cannot be read the check is suspended
 * and says the count is unknown (ui-spec §9), never “valid”.
 */
import {Component, computed, effect, inject, input, output, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import type {
  Bank,
  DrawFixedBy,
  Order,
  Playback,
  PlaybackWhen,
  PrefillBankSource,
} from 'speechrecorderng';
import {catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap} from 'rxjs';
import {BankApiService} from '../core/bank-api.service';
import {EDITOR_STRINGS} from '../core/editor-strings';
import type {BankView} from '../core/validation';
import {drawnFilterWords} from '../editor/drawn-filter';
import {exampleDraw, type ExampleDrawItem} from '../editor/example-draw';
import {codeRange, drawFilterOf, fieldsOfFilter, itemQueryOf, type BankFilterFields} from './bank-model';
import {BankFilterForm} from './bank-filter-form';
import {DrawRuleExample} from './draw-rule-example';
import {DrawRuleFindings} from './draw-rule-findings';
import {countValidation, ruleFindings, type CountsState} from './bank-rule';
import {BANK_STRINGS} from './bank-strings';

/** The bank cannot return more than 999 drawn items (data-model.md §2.2, E11). */
const MAX_DRAW = 999;

@Component({
  selector: 'spre-draw-rule',
  imports: [RouterLink, BankFilterForm, DrawRuleExample, DrawRuleFindings],
  templateUrl: './draw-rule.html',
  styleUrl: './draw-rule.scss',
})
export class DrawRulePanel {
  private readonly api = inject(BankApiService);

  readonly strings = BANK_STRINGS;
  readonly catalogue = EDITOR_STRINGS;
  readonly fixedByOptions: ReadonlyArray<DrawFixedBy> = ['SESSION', 'SPEAKER', 'SCRIPT'];
  readonly whenOptions: ReadonlyArray<PlaybackWhen> = ['WITH_PROMPT', 'BEFORE', 'PRERECORDING', 'DURING', 'ONDEMAND'];

  readonly project = input.required<string>();
  readonly source = input.required<PrefillBankSource>();
  readonly banks = input<ReadonlyArray<Bank>>([]);
  readonly bank = input<Bank | null>(null);
  readonly drawsLink = input<string | null>(null);

  /** Every edit, as the whole new source. The caller persists; this panel never does. */
  readonly change = output<PrefillBankSource>();
  readonly useRule = output<PrefillBankSource>();
  readonly openPicker = output<void>();

  private readonly draft = signal<PrefillBankSource | null>(null);
  /** The rule being edited: the local draft, seeded from `source` and re-seeded when it changes. */
  readonly rule = computed(() => this.draft() ?? this.source());

  readonly counts = signal<CountsState>({status: 'idle'});
  readonly exampleOffset = signal(0);

  readonly fields = computed(() => fieldsOfFilter(this.rule().filter));
  readonly originLabel = computed(() => this.bank()?.source === 'BUILTIN'
    ? EDITOR_STRINGS.centre.bankOriginBuiltin
    : EDITOR_STRINGS.centre.bankOriginProject);
  readonly bankUnknown = computed(() =>
    this.rule().bank !== '' && !this.banks().some((bank) => bank.bankId === this.rule().bank));

  readonly countStatus = computed(() => countValidation(this.rule(), this.counts(), this.bank()?.itemCount));

  readonly codes = computed(() => codeRange(this.rule().itemcodePrefix, Number(this.rule().count)));
  readonly codesText = computed(() => {
    const range = this.codes();
    return range === null ? '' : `${range.first}…${range.last} (${range.count})`;
  });

  /** The persisted filter in words — the same implementation the centre card and inspector use. */
  readonly summary = computed(() => drawnFilterWords(this.rule()));

  private readonly bankLookup = computed(() => {
    const counts = this.counts();
    const sources = this.banks();
    const bankId = this.rule().bank;
    return (id: string): BankView | null | undefined => {
      if (id !== bankId) {
        return sources.some((bank) => bank.bankId === id) ? null : undefined;
      }
      if (sources.length === 0 || !sources.some((bank) => bank.bankId === id)) {
        return sources.length === 0 ? undefined : null;
      }
      return counts.status === 'ready' ? {bankId: id, items: counts.items} : undefined;
    };
  });

  readonly findings = computed(() => ruleFindings(this.rule(), this.bankLookup()));
  readonly errors = computed(() => this.findings()
    .filter((finding) => finding.id !== 'E04' && finding.severity === 'error' && finding.suspended !== true));
  readonly warnings = computed(() => this.findings()
    .filter((finding) => finding.id !== 'E04' && finding.severity === 'warning' && finding.suspended !== true));
  readonly suspended = computed(() => this.findings()
    .filter((finding) => finding.id !== 'E04' && finding.suspended === true));

  readonly example = computed<ExampleDrawItem[]>(() => {
    const counts = this.counts();
    if (counts.status !== 'ready' || this.rule().bank === '') {
      return [];
    }
    return exampleDraw({bankId: this.rule().bank, items: counts.items}, this.rule(), this.exampleOffset());
  });

  constructor() {
    // Re-seed the local draft whenever the caller hands over a new source.
    effect(() => this.draft.set(this.source()));

    toObservable(computed(() => ({
      bank: this.rule().bank,
      filter: JSON.stringify(this.rule().filter ?? {}),
    })))
      .pipe(
        debounceTime(120),
        distinctUntilChanged((a, b) => a.bank === b.bank && a.filter === b.filter),
        switchMap(({bank}) => {
          if (bank === '') {
            return of<CountsState>({status: 'idle'});
          }
          const query = itemQueryOf(fieldsOfFilter(this.rule().filter), {limit: MAX_DRAW});
          return this.api.items(this.project(), bank, query).pipe(
            map((page): CountsState => ({
              status: 'ready',
              matchCount: page.matchCount,
              withoutAudio: page.withoutAudio ?? 0,
              items: page.items,
            })),
            catchError(() => of<CountsState>({status: 'suspended'})),
            startWith<CountsState>({status: 'loading'}),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.counts.set(state));

    // A different bank, filter or count is a different selection; the offset only walks examples.
    effect(() => {
      this.rule();
      this.exampleOffset.set(0);
    });
  }

  private emit(patch: Partial<PrefillBankSource>): void {
    const next = {...this.rule(), ...patch};
    this.draft.set(next);
    this.change.emit(next);
  }

  fixedByLabel(option: DrawFixedBy): string {
    return EDITOR_STRINGS.inspector.group[`fixedBy${option}`];
  }

  fixedByHelp(option: DrawFixedBy): string {
    return EDITOR_STRINGS.inspector.group.fixedByHelp[option];
  }

  whenLabel(when: PlaybackWhen): string {
    return EDITOR_STRINGS.inspector.playback.whenOptions[when];
  }

  setField(name: keyof BankFilterFields, value: string): void {
    this.emit({filter: drawFilterOf({...this.fields(), [name]: value})});
  }

  setCount(value: string): void {
    const count = Number(value);
    this.emit({count: Number.isFinite(count) ? count : 0});
  }

  setOrder(value: string): void {
    this.emit({order: value as Order});
  }

  setFixedBy(value: DrawFixedBy): void {
    this.emit({fixedBy: value});
  }

  setSkipRecorded(checked: boolean): void {
    this.emit({skipRecordedBySpeaker: checked});
  }

  setPrefix(value: string): void {
    this.emit({itemcodePrefix: value});
  }

  setPlayBankAudio(checked: boolean): void {
    const playback = this.rule().playback;
    this.emit({
      playBankAudio: checked,
      playback: playback ?? (checked ? {when: 'WITH_PROMPT'} : undefined),
    });
  }

  setPlaybackWhen(value: string): void {
    this.emit({playback: {...(this.rule().playback ?? {}), when: value as PlaybackWhen}});
  }

  setPlaybackNumber(name: keyof Playback, value: string, integer = false): void {
    const parsed = Number(value);
    const number = Number.isFinite(parsed) ? (integer ? Math.trunc(parsed) : parsed) : undefined;
    this.emit({playback: {...(this.rule().playback ?? {}), [name]: number}});
  }

  setPlaybackFlag(name: 'replayable' | 'headphones', checked: boolean): void {
    this.emit({playback: {...(this.rule().playback ?? {}), [name]: checked}});
  }

  setDefault(name: 'prerecdelay' | 'recduration' | 'postrecdelay', value: string): void {
    const parsed = Number(value);
    this.emit({
      itemDefaults: {...(this.rule().itemDefaults ?? {}), [name]: Number.isFinite(parsed) ? parsed : undefined},
    });
  }

  setInstructions(value: string): void {
    // `PromptItem.recinstructions` is the shipped `Recinstructions` shape, not a bare string.
    const instructions = value.trim() === '' ? undefined : {recinstructions: value};
    this.emit({itemDefaults: {...(this.rule().itemDefaults ?? {}), recinstructions: instructions}});
  }

  drawAnother(): void {
    this.exampleOffset.update((offset) => offset + 1);
  }

  commit(): void {
    this.useRule.emit(this.rule());
  }
}
