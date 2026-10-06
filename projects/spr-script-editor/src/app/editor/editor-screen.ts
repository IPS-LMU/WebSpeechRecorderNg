import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {catchError, forkJoin, map, of} from 'rxjs';
import type {Bank, BankItem} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {BankApiService} from '../core/bank-api.service';
import {EditorFindingsService} from '../core/editor-findings.service';
import {MediaService} from '../core/media.service';
import {ScriptApiService, type ScriptVersion} from '../core/script-api.service';
import {ScriptDraftService} from '../core/script-draft.service';
import type {EditorScript, MediaEntry, ScriptSummary} from '../core/script.model';
import {type BankView, type ValidationContext} from '../core/validation';
import {eachBankSource} from '../core/validation/walk';
import {EditorCentre} from './centre/editor-centre';
import {EditorInspector} from './inspector/editor-inspector';
import {EditorOutline} from './outline/editor-outline';
import {formatSelection, selectionFromQuery, type Selection} from './selection';

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

const BANK_ITEM_PAGE = 1000;

/**
 * The editor screen (ui-spec §3): outline, centre and inspector, driven by the selection in
 * `?sel=`. From M3 the draft comes from `ScriptDraftService` (undo/redo, autosave, conflict) and
 * every edit re-runs the check catalogue, so the outline markers, the warning count in the shell
 * and the checks panel cannot disagree. Banks, media and the deployment version are the injected
 * validation context; a load failure blocks editing rather than showing an empty script as if it
 * were real (ui-spec §9).
 */
@Component({
  selector: 'spr-editor-screen',
  imports: [EditorOutline, EditorCentre, EditorInspector],
  templateUrl: './editor-screen.html',
  styleUrl: './editor-screen.scss',
})
export class EditorScreen {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scripts = inject(ScriptApiService);
  private readonly bankApi = inject(BankApiService);
  private readonly mediaApi = inject(MediaService);
  private readonly draft = inject(ScriptDraftService);
  private readonly editorFindings = inject(EditorFindingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly strings = EDITOR_STRINGS;

  readonly state = signal<ScreenState>('loading');
  readonly error = signal<string | null>(null);
  /** True when the server answered 404 for the draft: a published script the editor can start. */
  readonly draftMissing = signal(false);
  private readonly bankViewsSignal = signal<ReadonlyMap<string, BankView>>(new Map());
  private readonly bankListSignal = signal<ReadonlyArray<Bank>>([]);
  private readonly mediaSignal = signal<ReadonlyArray<MediaEntry>>([]);
  private readonly recorderVersion = signal<string | undefined>(undefined);
  readonly versions = signal<ReadonlyArray<ScriptVersion>>([]);
  private readonly summary = signal<ScriptSummary | null>(null);

  /** The server draft as loaded; N04 compares the edited draft against it (a lifted floor). */
  private readonly baseline = signal<EditorScript | null>(null);

  readonly bankViews = this.bankViewsSignal.asReadonly();
  readonly bankList = this.bankListSignal.asReadonly();
  readonly media = this.mediaSignal.asReadonly();

  /** The draft the columns edit, straight from the draft service. */
  readonly script = computed<EditorScript | null>(() => this.draft.model());

  private readonly rawSel = signal<string | null>(null);
  readonly project = signal('');
  readonly scriptId = signal('');

  readonly selection = computed<Selection>(() => selectionFromQuery(this.rawSel(), this.script()));

  readonly bankNames = computed(() => new Map(this.bankList().map((bank) => [bank.bankId, bank.title])));

  /** `sessions.byVersion` of the library row, keyed by version number (D5's panel). */
  readonly versionSessions = computed<ReadonlyMap<number, number>>(() => {
    const byVersion = this.summary()?.sessions?.byVersion ?? {};
    const counts = new Map<number, number>();
    for (const [version, sessions] of Object.entries(byVersion)) {
      const number = Number(version);
      if (Number.isFinite(number)) {
        counts.set(number, Number(sessions));
      }
    }
    return counts;
  });

  private readonly context = computed<ValidationContext>(() => {
    const views = this.bankViewsSignal();
    const bankList = this.bankListSignal();
    const mediaIndex = this.mediaSignal();
    return {
      bankLookup: (bankId) => {
        const view = views.get(bankId);
        if (view !== undefined) {
          return view;
        }
        return bankList.some((bank) => bank.bankId === bankId) ? undefined : null;
      },
      mediaIndex: mediaIndex.map((entry) => entry.src),
      recorderVersion: this.recorderVersion(),
      previousDraft: this.baseline() ?? undefined,
    };
  });

  /**
   * The findings the columns and the shell read, computed by the findings service (plan M5 perf):
   * debounced after typing, recomputed at once after a discrete action (`refreshFindings`).
   */
  readonly findings = this.editorFindings.client;

  private currentProject = '';
  private currentId = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const project = params.get('p') ?? '';
      const id = params.get('id') ?? '';
      if (project === this.currentProject && id === this.currentId) {
        return;
      }
      this.currentProject = project;
      this.currentId = id;
      this.project.set(project);
      this.scriptId.set(id);
      void this.start(project, id);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.rawSel.set(params.get('sel'));
    });

    // The catalogue is debounced (plan M5 perf): any model or context change only arms the timer;
    // a discrete action goes through `refreshFindings` and is reflected at once.
    effect(() => {
      const model = this.script();
      const context = this.context();
      if (model === null) {
        this.editorFindings.setClient([]);
        return;
      }
      this.editorFindings.scheduleClient(model, context);
    });

    // A queued run must not outlive its screen (route change to the source screen, teardown).
    this.destroyRef.onDestroy(() => this.editorFindings.cancelPending());
  }

  /** Recomputes the catalogue now, for an edit that is a discrete action (plan M5 perf). */
  private refreshFindings(): void {
    const model = this.script();
    if (model !== null) {
      this.editorFindings.refresh(model, this.context());
    }
  }

  select(selection: Selection): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {sel: formatSelection(selection)},
      queryParamsHandling: 'merge',
    });
  }

  /** The script inspector's Restore: copies a published version into the draft (rest-api §2.5). */
  restoreVersion(version: number): void {
    void this.draft.restoreVersion(version).then(() => this.refreshFindings());
  }

  /** A drawn group chose a bank: load its items so E04/W04 are live rather than suspended. */
  requestBank(bankId: string): void {
    if (bankId === '' || this.bankViewsSignal().has(bankId)) {
      return;
    }
    this.bankApi.items(this.currentProject, bankId, {limit: BANK_ITEM_PAGE}).pipe(
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (page === null) {
        return;
      }
      const title = this.bankListSignal().find((bank) => bank.bankId === bankId)?.title;
      const next = new Map(this.bankViewsSignal());
      next.set(bankId, {bankId, items: page.items, ...(title === undefined ? {} : {title})});
      this.bankViewsSignal.set(next);
      this.refreshFindings();
    });
  }

  /** Media was uploaded or deleted: refresh the index so W11 and the picker see it. */
  refreshMedia(): void {
    this.mediaApi.list(this.currentProject).pipe(
      catchError(() => of<MediaEntry[] | null>(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((media) => {
      if (media !== null) {
        this.mediaSignal.set(media);
        this.refreshFindings();
      }
    });
  }

  /** Adds the section E10 asks for (the empty-state action and nothing more). */
  addSection(): void {
    const sections = this.script()?.sections ?? [];
    this.draft.insert('section.add', ['sections'], sections.length, {
      name: `${this.strings.editor.addSection} ${sections.length + 1}`,
      mode: 'MANUAL',
      groups: [{order: 'SEQUENTIAL', promptItems: []}],
    });
    this.refreshFindings();
  }

  private async start(project: string, id: string): Promise<void> {
    this.state.set('loading');
    this.error.set(null);
    this.draftMissing.set(false);
    this.baseline.set(null);
    this.bankViewsSignal.set(new Map());
    this.bankListSignal.set([]);
    this.mediaSignal.set([]);
    this.versions.set([]);
    this.summary.set(null);
    if (id === '') {
      this.error.set(this.strings.editor.loadErrorBody);
      this.state.set('error');
      return;
    }

    try {
      await this.draft.load(project, id);
    } catch (error) {
      // A 404 on this URL is the server saying the script has no draft, not that it is missing: a
      // script the receiver's legacy migration left with published versions and nothing to edit.
      this.draftMissing.set(error instanceof HttpErrorResponse && error.status === 404);
      this.error.set(this.describeError(error));
      this.state.set('error');
      return;
    }

    const model = this.draft.model();
    if (model === null) {
      this.error.set(this.strings.editor.loadErrorBody);
      this.state.set('error');
      return;
    }
    this.baseline.set(structuredClone(model) as EditorScript);
    this.loadContext(project, id, model);
  }

  /** Re-runs the load that failed; a 404 offers the start action instead (see below). */
  async retryLoad(): Promise<void> {
    await this.start(this.currentProject, this.currentId);
  }

  /**
   * The escape from a load failure the server describes as "no draft": create one from the newest
   * published version, then re-run the load that was interrupted. ui-spec's state table requires the
   * failure to block editing, not to strand the operator.
   */
  async startDraftFromPublished(): Promise<void> {
    await this.draft.startDraftFromPublished();
    if (this.draft.model() !== null) {
      await this.start(this.currentProject, this.currentId);
      return;
    }
    this.error.set(this.draft.lastError() ?? this.strings.editor.loadErrorBody);
  }

  private loadContext(project: string, id: string, model: EditorScript): void {
    const bankIds = [...new Set(eachBankSource(model).map((ref) => ref.bankId).filter((bankId) => bankId !== ''))];
    const bankCalls = bankIds.length === 0
      ? of([])
      : forkJoin(bankIds.map((bankId) => this.bankApi.items(project, bankId, {limit: BANK_ITEM_PAGE}).pipe(
        map((page) => ({bankId, items: page.items})),
        catchError(() => of({bankId, items: null})),
      )));

    forkJoin({
      bankList: this.bankApi.list(project).pipe(catchError(() => of<Bank[]>([]))),
      banks: bankCalls,
      media: this.mediaApi.list(project).pipe(catchError(() => of<MediaEntry[] | null>(null))),
      version: this.scripts.version().pipe(catchError(() => of(null))),
      versions: this.scripts.versions(project, id).pipe(catchError(() => of<ScriptVersion[] | null>(null))),
      summaries: this.scripts.list(project).pipe(catchError(() => of<ScriptSummary[] | null>(null))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({bankList, banks, media, version, versions, summaries}) => {
        const views = new Map<string, BankView>();
        for (const {bankId, items} of banks as Array<{bankId: string; items: BankItem[] | null}>) {
          if (items !== null) {
            const title = bankList.find((bank) => bank.bankId === bankId)?.title;
            views.set(bankId, {bankId, items, ...(title === undefined ? {} : {title})});
          }
        }
        this.bankViewsSignal.set(views);
        this.bankListSignal.set(bankList);
        this.mediaSignal.set(media ?? []);
        this.recorderVersion.set(version?.recorderVersion);
        this.versions.set(versions ?? []);
        this.summary.set(summaries?.find((row) => String(row.scriptId) === id) ?? null);
        const current = this.script();
        this.state.set((current?.sections?.length ?? 0) > 0 ? 'ready' : 'empty');
        // A freshly loaded draft shows its findings at once, not one debounce later.
        this.refreshFindings();
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error));
        this.state.set('error');
      },
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      // The editor's own wording, as the sibling screens use theirs: this reported a draft's status
      // under the *library list's* prefix, so a script with no draft said "The script list could not
      // be loaded" beneath the title that said the draft could not be loaded.
      return `${this.strings.editor.loadErrorTitle} (${this.strings.library.httpPrefix} ${error.status})`;
    }
    return this.strings.editor.loadErrorBody;
  }
}
