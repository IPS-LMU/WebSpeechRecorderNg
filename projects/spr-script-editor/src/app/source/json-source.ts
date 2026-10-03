import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {catchError, firstValueFrom, forkJoin, map, of} from 'rxjs';
import type {Bank, BankItem} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {EditorFindingsService} from '../core/editor-findings.service';
import {MediaService} from '../core/media.service';
import {applyFix} from '../core/normalise';
import {ScriptApiService} from '../core/script-api.service';
import type {EditorScript, MediaEntry} from '../core/script.model';
import {ScriptDraftService} from '../core/script-draft.service';
import {parseJsonSource, type BankView, type ValidationContext} from '../core/validation';
import {fillTemplate} from '../core/validation/interpolate';
import {eachBankSource} from '../core/validation/walk';
import {ChecksPanel, type FixRequest} from '../validation/checks-panel';
import {serverFindingsFrom} from '../validation/server-findings';
import {dotsByLine, draftTextOfModel, formatSourceJson, lineNumbers, sourceParseState} from './json-source-view';
import {SOURCE_STRINGS} from './source-strings';

type ScreenState = 'loading' | 'ready' | 'error';

const BANK_ITEM_PAGE = 1000;

/**
 * The JSON source screen (ui-spec §5): the draft as formatted JSON with line numbers and gutter
 * dots on the left, the checks panel on the right. Text edits go through `ScriptDraftService` —
 * it owns the parse gate, the last-valid-model rule, the local backup and the debounced save —
 * so undo/redo and the shell's save state work here too. While the text does not parse the draft
 * keeps its last valid model and the checks below describe that model.
 */
@Component({
  selector: 'spre-json-source',
  imports: [ChecksPanel, RouterLink],
  templateUrl: './json-source.html',
  styleUrl: './json-source.scss',
})
export class JsonSource {
  private readonly route = inject(ActivatedRoute);
  private readonly scripts = inject(ScriptApiService);
  private readonly bankApi = inject(BankApiService);
  private readonly mediaApi = inject(MediaService);
  private readonly findingsStore = inject(EditorFindingsService);

  readonly draft = inject(ScriptDraftService);
  private readonly destroyRef = inject(DestroyRef);

  readonly strings = SOURCE_STRINGS;
  readonly state = signal<ScreenState>('loading');
  readonly error = signal<string | null>(null);
  readonly project = signal('');
  readonly scriptId = signal('');
  readonly publishNote = signal<string | null>(null);

  private readonly context = signal<ValidationContext>({});

  readonly sourceText = this.draft.sourceText;
  readonly model = this.draft.model;
  readonly serverFindings = this.findingsStore.server;

  readonly lines = computed(() => lineNumbers(this.sourceText()));
  readonly parse = computed(() => sourceParseState(this.sourceText()));
  private readonly lineSource = computed(() => parseJsonSource(this.sourceText()));
  /** True while the box holds text the draft has not accepted (does not parse or is not an object). */
  readonly frozen = computed(() => this.draft.sourceText() !== this.draft.text());
  /**
   * The catalogue findings from the shared store (plan M5 perf): debounced after typing,
   * recomputed at once after a discrete action (`refreshFindings`).
   */
  readonly findings = this.findingsStore.client;

  readonly dots = computed(() => dotsByLine(this.sourceText(), this.findings()));

  readonly errorText = computed<string | null>(() => {
    const parse = this.parse();
    if (parse.kind === 'syntax' && parse.error !== null) {
      return fillTemplate(this.strings.parseErrorAt, {
        message: parse.error.message,
        line: parse.error.line,
        column: parse.error.column,
      });
    }
    return parse.kind === 'shape' ? this.strings.mustBeObject : null;
  });

  readonly canPublish = computed(() =>
    this.state() === 'ready' && !this.findingsStore.gate().blocked && !this.draft.writesDisabled());

  readonly publishTitle = computed(() => {
    if (this.draft.writesDisabled()) {
      return this.strings.readOnly;
    }
    const gate = this.findingsStore.gate();
    return gate.blocked ? fillTemplate(this.strings.publishBlocked, {errors: gate.errors}) : this.strings.publish;
  });

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  private readonly gutter = viewChild<ElementRef<HTMLElement>>('gutter');

  /** The panel's line lookup reads the operator's current text, so a dot cannot drift from it. */
  readonly lineOf = (path: string): number | null => this.lineSource().lineOf(path);

  constructor() {
    // The catalogue is debounced (plan M5 perf): any model or context change only arms the timer;
    // a discrete action goes through `refreshFindings` and is reflected at once.
    effect(() => {
      const model = this.model();
      const context = this.context();
      if (model === null) {
        this.findingsStore.setClient([]);
        return;
      }
      this.findingsStore.scheduleClient(model, context);
    });

    // A queued run must not outlive its screen (route change to the editor, teardown).
    this.destroyRef.onDestroy(() => this.findingsStore.cancelPending());

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const project = params.get('p') ?? '';
      const id = params.get('id') ?? '';
      this.project.set(project);
      this.scriptId.set(id);
      void this.load(project, id);
    });
  }

  /** Recomputes the catalogue now, for an edit that is a discrete action (plan M5 perf). */
  private refreshFindings(): void {
    const model = this.model();
    if (model !== null) {
      this.findingsStore.refresh(model, this.context());
    }
  }

  private async load(project: string, id: string): Promise<void> {
    this.state.set('loading');
    this.error.set(null);
    this.publishNote.set(null);
    this.findingsStore.clearServer();
    try {
      await this.draft.load(project, id);
    } catch (error) {
      this.error.set(this.describeError(error));
      this.state.set('error');
      return;
    }
    const model = this.draft.model();
    if (model === null) {
      this.error.set(this.strings.loadErrorBody);
      this.state.set('error');
      return;
    }
    this.state.set('ready');
    void this.loadContext(project, model);
  }

  /** Loads the bank and media inputs the catalogue needs (E04/W04/W05/W10/W11); best effort. */
  private async loadContext(project: string, draft: EditorScript): Promise<void> {
    const bankIds = [...new Set(eachBankSource(draft).map((ref) => ref.bankId).filter((bankId) => bankId !== ''))];
    try {
      const {bankList, banks, media, version} = await firstValueFrom(forkJoin({
        bankList: this.bankApi.list(project).pipe(catchError(() => of<Bank[]>([]))),
        banks: bankIds.length === 0
          ? of<Array<{bankId: string; items: BankItem[] | null}>>([])
          : forkJoin(bankIds.map((bankId) => this.bankApi.items(project, bankId, {limit: BANK_ITEM_PAGE}).pipe(
            map((page) => ({bankId, items: page.items as BankItem[] | null})),
            catchError(() => of({bankId, items: null})),
          ))),
        media: this.mediaApi.list(project).pipe(catchError(() => of<MediaEntry[] | null>(null))),
        version: this.scripts.version().pipe(catchError(() => of(null))),
      }));
      const views = new Map<string, BankView>();
      for (const {bankId, items} of banks) {
        if (items !== null) {
          const title = bankList.find((bank) => bank.bankId === bankId)?.title;
          views.set(bankId, {bankId, items, ...(title === undefined ? {} : {title})});
        }
      }
      const bankLookup = (bankId: string): BankView | null | undefined => {
        const view = views.get(bankId);
        if (view !== undefined) {
          return view;
        }
        return bankList.some((bank) => bank.bankId === bankId) ? undefined : null;
      };
      this.context.set({
        bankLookup,
        mediaIndex: media === null ? null : media.map((entry) => entry.src),
        recorderVersion: version?.recorderVersion,
      });
    } catch {
      this.context.set({});
    }
    // A freshly loaded draft shows its findings at once, not one debounce later.
    this.refreshFindings();
  }

  onInput(event: Event): void {
    this.draft.setText((event.target as HTMLTextAreaElement).value);
    this.publishNote.set(null);
  }

  onScroll(): void {
    const area = this.textarea()?.nativeElement;
    const gutter = this.gutter()?.nativeElement;
    if (area !== undefined && gutter !== undefined) {
      gutter.scrollTop = area.scrollTop;
    }
  }

  dotCount(line: number): number {
    return this.dots().get(line)?.length ?? 0;
  }

  dotTitle(line: number): string {
    return (this.dots().get(line) ?? []).map((finding) => `${finding.id}: ${finding.message}`).join('\n');
  }

  format(): void {
    const formatted = formatSourceJson(this.sourceText());
    if (formatted !== null) {
      this.draft.setText(formatted);
      this.refreshFindings();
    }
  }

  async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) {
      return;
    }
    this.draft.setText(await file.text());
    input.value = '';
    this.refreshFindings();
  }

  download(): void {
    const text = this.sourceText();
    const blob = new Blob([text], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `script-${this.scriptId()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Applies a catalogue fix to the model and pushes it back through the draft service. */
  onFix(request: FixRequest): void {
    const model = this.model();
    if (model === null) {
      return;
    }
    const result = applyFix(model, request.finding, this.context(), request.options);
    if (!result.changed) {
      return;
    }
    this.draft.setText(draftTextOfModel(result.draft));
    this.findingsStore.clearServer();
    this.refreshFindings();
  }

  async publish(): Promise<void> {
    // The publish attempt is a discrete action: re-run the catalogue now so the gate is never stale.
    this.findingsStore.recompute();
    if (!this.canPublish()) {
      return;
    }
    this.publishNote.set(null);
    this.findingsStore.clearServer();
    try {
      await this.draft.flush();
      const result = await firstValueFrom(
        this.scripts.publish(this.project(), this.scriptId(), {fromDraftEtag: this.draft.etag() ?? ''}),
      );
      this.publishNote.set(fillTemplate(this.strings.publishDone, {version: result.version}));
    } catch (error) {
      const returned = error instanceof HttpErrorResponse ? serverFindingsFrom(error.error) : [];
      if (returned.length > 0) {
        this.findingsStore.setServer(returned);
        this.publishNote.set(this.messageOf(error));
      } else {
        this.publishNote.set(fillTemplate(this.strings.publishFailed, {message: this.messageOf(error)}));
      }
    }
  }

  private messageOf(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as {message?: unknown; error?: unknown} | null;
      if (body !== null && typeof body === 'object') {
        if (typeof body.message === 'string' && body.message !== '') {
          return body.message;
        }
        if (typeof body.error === 'string' && body.error !== '') {
          return body.error;
        }
      }
      return `HTTP ${error.status}`;
    }
    return this.strings.publishUnknown;
  }

  private describeError(error: unknown): string {
    return error instanceof HttpErrorResponse ? `HTTP ${error.status}` : this.strings.loadErrorBody;
  }
}
