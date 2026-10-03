import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {catchError, forkJoin, map, of, switchMap} from 'rxjs';
import type {Bank, BankItem} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {BankApiService} from '../core/bank-api.service';
import {loadScript} from '../core/load';
import {MediaService} from '../core/media.service';
import {ScriptApiService} from '../core/script-api.service';
import type {EditorScript, MediaEntry} from '../core/script.model';
import {runChecks, type BankView, type Finding, type ValidationContext} from '../core/validation';
import {eachBankSource} from '../core/validation/walk';
import {EditorCentre} from './centre/editor-centre';
import {EditorInspector} from './inspector/editor-inspector';
import {EditorOutline} from './outline/editor-outline';
import {formatSelection, selectionFromQuery, type Selection} from './selection';

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

const BANK_ITEM_PAGE = 1000;

/**
 * The editor screen (ui-spec §3): outline, centre and inspector, driven by the selection in
 * `?sel=`. It loads the draft, the banks the script draws from and the media index, runs the check
 * catalogue once, and passes the findings to all three columns so a marker cannot disagree with
 * the checks panel.
 *
 * M2 is read-only: no draft is written, and a load failure blocks editing rather than showing an
 * empty script as if it were real (ui-spec §9).
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
  private readonly destroyRef = inject(DestroyRef);

  readonly strings = EDITOR_STRINGS;

  readonly state = signal<ScreenState>('loading');
  readonly error = signal<string | null>(null);
  readonly script = signal<EditorScript | null>(null);
  readonly findings = signal<ReadonlyArray<Finding>>([]);
  readonly bankViews = signal<ReadonlyMap<string, BankView>>(new Map());
  readonly bankList = signal<ReadonlyArray<Bank>>([]);
  readonly media = signal<ReadonlyArray<MediaEntry>>([]);

  private readonly rawSel = signal<string | null>(null);
  readonly project = signal('');
  readonly scriptId = signal('');

  readonly selection = computed<Selection>(() => selectionFromQuery(this.rawSel(), this.script()));

  readonly bankNames = computed(() => new Map(this.bankList().map((bank) => [bank.bankId, bank.title])));

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
      this.load(project, id);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.rawSel.set(params.get('sel'));
    });
  }

  select(selection: Selection): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {sel: formatSelection(selection)},
      queryParamsHandling: 'merge',
    });
  }

  private load(project: string, id: string): void {
    this.state.set('loading');
    this.script.set(null);
    this.findings.set([]);
    this.error.set(null);
    if (id === '') {
      this.error.set(this.strings.editor.loadErrorBody);
      this.state.set('error');
      return;
    }

    this.scripts.getScript(id).pipe(
      switchMap((raw) => {
        // The wire type is the library `Script`, but a draft may carry legacy and unknown keys the
        // editor must preserve; `EditorScript` is the loose view of exactly that (script.model.ts).
        const draft = raw as EditorScript;
        const loaded = loadScript(draft);
        const bankIds = [...new Set(eachBankSource(draft).map((ref) => ref.bankId).filter((bankId) => bankId !== ''))];
        const bankCalls = bankIds.length === 0
          ? of([])
          : forkJoin(bankIds.map((bankId) => this.bankApi.items(project, bankId, {limit: BANK_ITEM_PAGE}).pipe(
            map((page) => ({bankId, items: page.items})),
            catchError(() => of({bankId, items: null})),
          )));
        return forkJoin({
          loaded: of(loaded),
          bankList: this.bankApi.list(project).pipe(catchError(() => of<Bank[]>([]))),
          banks: bankCalls,
          media: this.mediaApi.list(project).pipe(catchError(() => of<MediaEntry[] | null>(null))),
          version: this.scripts.version().pipe(catchError(() => of(null))),
        });
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({loaded, bankList, banks, media, version}) => {
        const views = new Map<string, BankView>();
        for (const {bankId, items} of banks as Array<{bankId: string; items: BankItem[] | null}>) {
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
        const context: ValidationContext = {
          bankLookup,
          mediaIndex: media === null ? null : media.map((entry) => entry.src),
          recorderVersion: version?.recorderVersion,
        };
        this.bankViews.set(views);
        this.bankList.set(bankList);
        this.media.set(media ?? []);
        this.script.set(loaded);
        this.findings.set(runChecks(loaded, context));
        this.state.set((loaded.sections?.length ?? 0) > 0 ? 'ready' : 'empty');
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error));
        this.state.set('error');
      },
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return `${this.strings.library.errorPrefix} (${this.strings.library.httpPrefix} ${error.status})`;
    }
    return this.strings.editor.loadErrorBody;
  }
}
