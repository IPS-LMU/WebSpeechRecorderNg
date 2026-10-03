/**
 * Item-bank browser (plan M4 row `E4 bank browser`, ui-spec §6/§9).
 *
 * Two routes reach it (the wiring is done by the parent; this slice owns the component):
 *  - `project/{p}/bank` — the project’s banks, browsable on their own;
 *  - `project/{p}/script/{id}/bank/{groupRef}` — reached from a drawn group; the rule panel edits
 *    **that group’s** bank source and every change is emitted to the caller. The draft service is
 *    the single save path; this screen never writes a draft by hand.
 *
 * The browse filter is local to this visit and is never written to the draft (D-O); the rule filter
 * lives in the rule panel and is. Item editing, deletion and model-recording upload exist only for
 * project-owned banks (`source !== 'BUILTIN'`), which the receiver enforces with `BANK_READ_ONLY`.
 */
import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, effect, ElementRef, inject, input, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {
  ApiType,
  type Bank,
  type BankItem,
  type PrefillBankSource,
  SPEECHRECORDER_CONFIG,
} from 'speechrecorderng';
import {catchError, debounceTime, distinctUntilChanged, firstValueFrom, map, of, switchMap} from 'rxjs';
import {normaliseApiEndPoint} from '../core/api-base';
import {BankApiService} from '../core/bank-api.service';
import {MediaService} from '../core/media.service';
import {BankItemPage} from '../core/script.model';
import {ScriptDraftService, type DraftPath} from '../core/script-draft.service';
import {fillTemplate} from '../core/validation/interpolate';
import {isObject} from '../core/validation/walk';
import {DEFAULT_PROJECT} from '../editor.config';
import {drawnPlaceholder} from '../editor/markers';
import {formatSelection, parseSelection, type Selection} from '../editor/selection';
import {
  bankAudioUrl,
  EMPTY_FILTER_FIELDS,
  groupBanks,
  isFilterEmpty,
  itemQueryOf,
  ruleDefaults,
  type BankFilterFields,
  type BankItemEdit,
} from './bank-model';
import {BankFilterForm} from './bank-filter-form';
import {BankItemForm} from './bank-item-form';
import {BankItemTable} from './bank-item-table';
import {BankPicker} from './bank-picker';
import {BANK_STRINGS} from './bank-strings';
import {BankWriteService, type BankItemPatch} from './bank-write.service';
import {DrawRulePanel} from './draw-rule';

type ScreenState = 'loading' | 'ready' | 'error';
type ItemsState = 'idle' | 'loading' | 'ready' | 'error';
type GroupState = 'none' | 'loading' | 'ready' | 'missing' | 'not-drawn' | 'error';

/** Where a group’s bank source lives, or why there is none. */
type RuleLookup =
  | {status: 'found'; path: DraftPath; rule: PrefillBankSource}
  | {status: 'missing'}
  | {status: 'not-drawn'};

const PAGE_SIZE = 50;

function describeError(error: unknown, prefix: string): string {
  if (error instanceof HttpErrorResponse) {
    return `${prefix} (HTTP ${error.status})`;
  }
  return prefix;
}

function itemsOf(group: unknown): unknown[] {
  if (!isObject(group) || !Array.isArray(group['promptItems'])) {
    return [];
  }
  return group['promptItems'];
}

@Component({
  selector: 'spre-bank-browser',
  imports: [RouterLink, DrawRulePanel, BankPicker, BankFilterForm, BankItemTable, BankItemForm],
  templateUrl: './bank-browser.html',
  styleUrl: './bank-browser.scss',
  providers: [BankWriteService, MediaService],
})
export class BankBrowser {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bankApi = inject(BankApiService);
  private readonly writes = inject(BankWriteService);
  private readonly media = inject(MediaService);
  private readonly draft = inject(ScriptDraftService);
  private readonly config = inject(SPEECHRECORDER_CONFIG, {optional: true});

  readonly strings = BANK_STRINGS;

  readonly p = input<string>(DEFAULT_PROJECT);
  readonly id = input<string | null>(null);
  readonly groupRef = input<string | null>(null);

  readonly state = signal<ScreenState>('loading');
  readonly loadError = signal<string | null>(null);
  readonly banks = signal<ReadonlyArray<Bank>>([]);
  readonly selectedBankId = signal<string | null>(null);

  readonly groups = computed(() => groupBanks(this.banks()));
  readonly selectedBank = computed(() =>
    this.banks().find((bank) => bank.bankId === this.selectedBankId()) ?? null);
  readonly readOnly = computed(() => this.selectedBank()?.source === 'BUILTIN');
  readonly writesDisabled = computed(() => this.config?.apiType === ApiType.FILES);
  readonly canEdit = computed(() => !this.readOnly() && !this.writesDisabled());
  readonly originLabel = computed(() => this.selectedBank()?.source === 'BUILTIN'
    ? this.strings.picker.originBuiltin
    : this.strings.picker.originProject);

  readonly browseFields = signal<BankFilterFields>({...EMPTY_FILTER_FIELDS});
  readonly offset = signal(0);
  readonly page = signal<BankItemPage | null>(null);
  readonly itemsState = signal<ItemsState>('idle');
  readonly itemsError = signal<string | null>(null);
  private readonly refreshTick = signal(0);

  readonly pageItems = computed(() => this.page()?.items ?? []);
  readonly matchCount = computed(() => this.page()?.matchCount ?? 0);
  readonly from = computed(() => (this.pageItems().length === 0 ? 0 : this.offset() + 1));
  readonly to = computed(() => this.offset() + this.pageItems().length);
  readonly canPrev = computed(() => this.offset() > 0);
  readonly canNext = computed(() => this.to() < this.matchCount());
  readonly showUsed = computed(() =>
    this.pageItems().some((item) => 'usedInSessions' in item && typeof item.usedInSessions === 'number'));
  readonly browseEmpty = computed(() => this.itemsState() === 'ready' && this.matchCount() === 0);
  readonly filterWidened = computed(() => !isFilterEmpty(this.browseFields()));
  readonly pageText = computed(() => fillTemplate(this.strings.table.page, {
    from: this.from(),
    to: this.to(),
    match: this.matchCount(),
  }));

  readonly picker = viewChild<ElementRef<HTMLElement>>('picker');

  readonly ruleMode = computed(() => {
    const groupRef = this.groupRef();
    const scriptId = this.id();
    // The router binds an absent param as `undefined`; only real strings mean “rule route”.
    return typeof groupRef === 'string' && groupRef !== '' && typeof scriptId === 'string' && scriptId !== '';
  });
  readonly groupState = signal<GroupState>('none');
  readonly rule = signal<PrefillBankSource | null>(null);
  readonly rulePath = signal<DraftPath | null>(null);
  readonly drawsLink = computed(() => {
    const scriptId = this.id();
    return typeof scriptId === 'string' && scriptId !== ''
      ? `/project/${this.p()}/script/${scriptId}/draws`
      : null;
  });

  readonly editing = signal<BankItemEdit | null>(null);
  readonly saving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly confirmingDelete = signal<string | null>(null);
  readonly uploadingId = signal<string | null>(null);
  readonly auditionError = signal<string | null>(null);

  private readonly base = normaliseApiEndPoint(this.config ?? undefined);
  private audio: HTMLAudioElement | null = null;
  private loadedKey = '';

  constructor() {
    effect(() => {
      const key = `${this.p()}|${this.id() ?? ''}|${this.groupRef() ?? ''}`;
      if (key === this.loadedKey) {
        return;
      }
      this.loadedKey = key;
      void this.init();
    });

    // A different bank (or filter) starts back at page one.
    effect(() => {
      this.selectedBankId();
      JSON.stringify(this.browseFields());
      this.offset.set(0);
    });

    toObservable(computed(() => ({
      bank: this.selectedBankId(),
      filter: JSON.stringify(this.browseFields()),
      offset: this.offset(),
      tick: this.refreshTick(),
    })))
      .pipe(
        debounceTime(120),
        distinctUntilChanged((a, b) =>
          a.bank === b.bank && a.filter === b.filter && a.offset === b.offset && a.tick === b.tick),
        switchMap(({bank, offset}) => {
          if (bank === null) {
            this.page.set(null);
            this.itemsState.set('idle');
            return of(null);
          }
          this.itemsState.set('loading');
          this.itemsError.set(null);
          return this.bankApi.items(this.p(), bank, itemQueryOf(this.browseFields(), {
            limit: PAGE_SIZE,
            offset,
          })).pipe(
            map((page) => {
              this.page.set(page);
              this.itemsState.set('ready');
              return page;
            }),
            catchError((error: unknown) => {
              this.page.set(null);
              this.itemsState.set('error');
              this.itemsError.set(describeError(error, this.strings.table.errorPrefix));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private async init(): Promise<void> {
    this.state.set('loading');
    this.loadError.set(null);
    this.groupState.set(this.ruleMode() ? 'loading' : 'none');
    this.banks.set([]);
    this.selectedBankId.set(null);
    this.rule.set(null);
    this.rulePath.set(null);
    this.editing.set(null);
    try {
      this.banks.set(await firstValueFrom(this.bankApi.list(this.p())));
      this.state.set('ready');
    } catch (error) {
      this.state.set('error');
      this.loadError.set(describeError(error, this.strings.table.errorPrefix));
      return;
    }
    if (this.ruleMode()) {
      await this.loadRule();
    }
    this.selectInitialBank();
  }

  /** Reads the group’s bank source out of the draft; the draft service owns loading and saving. */
  private async loadRule(): Promise<void> {
    const scriptId = this.id();
    if (typeof scriptId !== 'string' || scriptId === '') {
      this.groupState.set('none');
      return;
    }
    try {
      await this.draft.load(this.p(), scriptId);
    } catch {
      this.groupState.set('error');
      return;
    }
    const selection = parseSelection(this.groupRef());
    const found = this.locateRule(selection, this.draft.model());
    if (found.status !== 'found') {
      this.groupState.set(found.status);
      return;
    }
    this.rulePath.set(found.path);
    this.rule.set(found.rule);
    this.groupState.set('ready');
  }

  /** The placeholder’s bank source and the JSON path a change must be written to. */
  private locateRule(selection: Selection | null, model: unknown): RuleLookup {
    if (selection === null || (selection.kind !== 'group' && selection.kind !== 'item')) {
      return {status: 'missing'};
    }
    const sections = isObject(model) && Array.isArray(model['sections']) ? model['sections'] : [];
    const section = sections[selection.section];
    const groups = isObject(section) && Array.isArray(section['groups']) ? section['groups'] : [];
    const group = groups[selection.group];
    if (group === undefined) {
      return {status: 'missing'};
    }
    const items = itemsOf(group);
    const base: DraftPath = ['sections', selection.section, 'groups', selection.group, 'promptItems'];
    const placeholder = drawnPlaceholder(group);
    if (placeholder === null) {
      // A placeholder without a bank yet: the group still says so and a bank can be chosen (§9).
      const prefillIndex = items.findIndex((item) => isObject(item) && item['prefill'] !== undefined);
      return prefillIndex < 0
        ? {status: 'not-drawn'}
        : {status: 'found', path: bankPath(base, prefillIndex), rule: ruleDefaults()};
    }
    const index = items.indexOf(placeholder);
    return index < 0
      ? {status: 'not-drawn'}
      : {status: 'found', path: bankPath(base, index), rule: placeholder.prefill?.bank ?? ruleDefaults()};
  }

  /** Deep-link first (`?bank=`), then the rule’s bank, then the first project bank. */
  private selectInitialBank(): void {
    const banks = this.banks();
    if (banks.length === 0) {
      this.selectedBankId.set(null);
      return;
    }
    const wanted = [
      this.route.snapshot.queryParamMap.get('bank'),
      this.rule()?.bank ?? null,
      this.groups().project[0]?.bankId ?? null,
      banks[0]?.bankId ?? null,
    ];
    const id = wanted.find((candidate) => candidate !== null && banks.some((bank) => bank.bankId === candidate));
    this.selectedBankId.set(id ?? null);
  }

  selectBank(bank: Bank): void {
    this.selectedBankId.set(bank.bankId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {bank: bank.bankId},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const rule = this.rule();
    if (rule !== null && this.ruleMode() && rule.bank !== bank.bankId) {
      this.applyRule({...rule, bank: bank.bankId, bankSource: bank.source});
    }
  }

  /** The rule panel emits the whole new source; the draft service persists it (single save path). */
  onRuleChange(source: PrefillBankSource): void {
    const previousBank = this.rule()?.bank ?? null;
    this.rule.set(source);
    if (source.bank !== previousBank && this.banks().some((bank) => bank.bankId === source.bank)) {
      this.selectedBankId.set(source.bank);
    }
    this.persistRule(source);
  }

  onUseRule(source: PrefillBankSource): void {
    this.applyRule(source);
    void this.draft.flush().finally(() => this.backToEditor());
  }

  private applyRule(source: PrefillBankSource): void {
    this.rule.set(source);
    this.persistRule(source);
  }

  private persistRule(source: PrefillBankSource): void {
    const path = this.rulePath();
    if (path === null) {
      return;
    }
    this.draft.setValue('bank-rule', path, source);
  }

  backToEditor(): void {
    const scriptId = this.id();
    if (typeof scriptId !== 'string' || scriptId === '') {
      void this.router.navigate(['/project', this.p(), 'bank']);
      return;
    }
    const selection = parseSelection(this.groupRef());
    void this.router.navigate(['/project', this.p(), 'script', scriptId, 'edit'], {
      queryParams: selection === null ? {} : {sel: formatSelection(selection)},
    });
  }

  setBrowseField(name: keyof BankFilterFields, value: string): void {
    this.browseFields.update((fields) => ({...fields, [name]: value}));
  }

  widenFilter(): void {
    this.browseFields.set({...EMPTY_FILTER_FIELDS});
  }

  goPrev(): void {
    this.offset.update((offset) => Math.max(0, offset - PAGE_SIZE));
  }

  goNext(): void {
    this.offset.update((offset) => offset + PAGE_SIZE);
  }

  /** Re-runs the screen’s load (the error state’s retry). */
  retry(): void {
    void this.init();
  }

  /** Re-fetches the item table for the current bank and filter. */
  refresh(): void {
    this.refreshTick.update((tick) => tick + 1);
  }

  focusPicker(): void {
    this.picker()?.nativeElement.querySelector<HTMLButtonElement>('.bank-row')?.focus();
  }

  bankAudioUrl(item: BankItem): string {
    return bankAudioUrl(this.base, this.p(), item.audioSrc ?? '');
  }

  audition(item: BankItem): void {
    if (item.audioSrc === undefined || item.audioSrc === '') {
      return;
    }
    this.auditionError.set(null);
    if (typeof Audio === 'undefined') {
      this.auditionError.set(item.bankItemId);
      return;
    }
    if (this.audio !== null) {
      this.audio.pause();
    }
    const audio = new Audio(this.bankAudioUrl(item));
    this.audio = audio;
    audio.play().catch(() => this.auditionError.set(item.bankItemId));
  }

  startAdd(): void {
    this.actionError.set(null);
    this.editing.set({id: null, text: '', category: '', words: '', tags: ''});
  }

  startEdit(item: BankItem): void {
    this.actionError.set(null);
    this.confirmingDelete.set(null);
    this.editing.set({
      id: item.bankItemId,
      text: item.text ?? '',
      category: item.category ?? '',
      words: item.words === undefined ? '' : String(item.words),
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      audioSrc: item.audioSrc,
      audioMimetype: item.audioMimetype,
    });
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.saving.set(false);
  }

  onField(name: 'text' | 'category' | 'words' | 'tags', value: string): void {
    this.editing.update((edit) => (edit === null ? edit : {...edit, [name]: value}));
  }

  async saveItem(): Promise<void> {
    const edit = this.editing();
    const bank = this.selectedBank();
    if (edit === null || bank === null) {
      return;
    }
    if (edit.text.trim() === '') {
      this.actionError.set(this.strings.item.required);
      return;
    }
    const patch: BankItemPatch = {
      text: edit.text,
      category: edit.category.trim() === '' ? undefined : edit.category.trim(),
      tags: edit.tags.trim() === ''
        ? undefined
        : edit.tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== ''),
      words: edit.words.trim() === '' ? undefined : Number(edit.words),
    };
    if (edit.audioSrc !== undefined) {
      patch.audioSrc = edit.audioSrc;
      patch.audioMimetype = edit.audioMimetype;
    }
    this.saving.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.writes.saveItem(this.p(), bank.bankId, patch, edit.id));
      this.saving.set(false);
      this.editing.set(null);
      await this.reloadBank();
    } catch (error) {
      this.saving.set(false);
      this.actionError.set(describeError(error, this.strings.item.saveFailed));
    }
  }

  async deleteItem(item: BankItem): Promise<void> {
    const bank = this.selectedBank();
    if (bank === null) {
      return;
    }
    if (this.confirmingDelete() !== item.bankItemId) {
      this.confirmingDelete.set(item.bankItemId);
      return;
    }
    this.actionError.set(null);
    try {
      await firstValueFrom(this.writes.deleteItem(this.p(), bank.bankId, item.bankItemId));
      this.confirmingDelete.set(null);
      await this.reloadBank();
    } catch (error) {
      this.actionError.set(describeError(error, this.strings.item.deleteFailed));
    }
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  async uploadRecording(item: BankItem, file: File): Promise<void> {
    const bank = this.selectedBank();
    if (bank === null) {
      return;
    }
    this.uploadingId.set(item.bankItemId);
    this.actionError.set(null);
    this.auditionError.set(null);
    try {
      const upload = await firstValueFrom(this.media.upload(this.p(), file, file.name));
      await firstValueFrom(this.writes.saveItem(this.p(), bank.bankId, {
        audioSrc: upload.src,
        audioMimetype: upload.mimetype,
      }, item.bankItemId));
      await this.reloadBank();
    } catch (error) {
      this.actionError.set(describeError(error, this.strings.item.uploadFailed));
    } finally {
      this.uploadingId.set(null);
    }
  }

  async copyToProject(): Promise<void> {
    const bank = this.selectedBank();
    if (bank === null) {
      return;
    }
    this.actionError.set(null);
    try {
      const copy = await firstValueFrom(this.writes.create(this.p(), {copyFrom: bank.bankId}));
      await this.reloadBankList();
      if (this.banks().some((entry) => entry.bankId === copy.bankId)) {
        this.selectedBankId.set(copy.bankId);
      }
    } catch (error) {
      this.actionError.set(describeError(error, this.strings.item.saveFailed));
    }
  }

  /** Banks carry no validator: the screen reloads after every write (rest-api.md §3.3). */
  private async reloadBank(): Promise<void> {
    await this.reloadBankList();
    this.refreshTick.update((tick) => tick + 1);
  }

  private async reloadBankList(): Promise<void> {
    try {
      this.banks.set(await firstValueFrom(this.bankApi.list(this.p())));
    } catch {
      // The item write succeeded; a failed list refresh must not claim otherwise.
    }
  }
}

/** The draft path of the bank source on the `index`-th item of a group. */
function bankPath(base: DraftPath, index: number): DraftPath {
  return [...base, index, 'prefill', 'bank'];
}
