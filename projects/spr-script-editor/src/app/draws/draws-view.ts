import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, DestroyRef, effect, inject, input, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {DrawApiService} from '../core/draw-api.service';
import {ScriptApiService} from '../core/script-api.service';
import type {ScriptSummary, SessionDrawTrace} from '../core/script.model';
import {DEFAULT_PROJECT} from '../editor.config';
import {DrawsDetail, type DrawTraceState} from './draws-detail';
import {
  parseDrawPage,
  parseSessionTrace,
  redrawEnablement,
  toCsv,
  type DrawRowModel,
  type SessionTraceModel,
} from './draws-map';
import {DRAWS_STRINGS} from './draws-strings';
import {DrawsTable} from './draws-table';
import {DrawsService} from './draws.service';

/** Rows loaded in one read; the CSV export covers exactly these (ui-spec §7, no paging yet). */
const ROW_LIMIT = 500;

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as {code?: unknown; message?: unknown; error?: unknown} | null;
    const message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : null;
    const code = typeof body?.code === 'string' ? ` (${body.code})` : '';
    return `${DRAWS_STRINGS.errorPrefix} The server answered ${error.status}${code}.${message === null ? '' : ` ${message}`}`;
  }
  return `${DRAWS_STRINGS.errorPrefix} ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Resolved draws (ui-spec §7): the draw record of one script — the sessions it produced, the trace
 * behind each draw, and the CSV a researcher takes away.
 *
 * The screen is read-only except for the re-draw of a `CREATED` session. It never resolves a draw
 * itself (plan D-U): the table is `GET …/script/{id}/draws` and the detail is
 * `GET …/session/{s}/draws`, both served by the receiver. This component owns the state and the
 * actions; `DrawsTable` and `DrawsDetail` own the two regions.
 *
 * Deep-linkable state lives in the URL: `?script=` (project-scoped entry), `?session=` (selected
 * row) and `?preview=1` (show `type: "TEST"` sessions).
 */
@Component({
  selector: 'spre-draws-view',
  standalone: true,
  imports: [DrawsTable, DrawsDetail],
  templateUrl: './draws-view.html',
  styleUrl: './draws-view.scss',
})
export class DrawsView {
  private readonly api = inject(DrawApiService);
  private readonly scripts = inject(ScriptApiService);
  private readonly draws = inject(DrawsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject(SPEECHRECORDER_CONFIG, {optional: true});
  private readonly destroyRef = inject(DestroyRef);

  readonly strings = DRAWS_STRINGS;

  /** Route params (bound through `withComponentInputBinding`). `id` is empty on the project entry. */
  readonly p = input<string>(DEFAULT_PROJECT);
  readonly id = input<string>('');

  readonly state = signal<LoadState>('loading');
  readonly error = signal<string | null>(null);
  readonly rows = signal<DrawRowModel[]>([]);
  readonly trace = signal<SessionTraceModel | null>(null);
  readonly traceState = signal<DrawTraceState>('idle');
  readonly traceError = signal<string | null>(null);
  readonly redrawBusy = signal(false);
  readonly redrawMessage = signal<string | null>(null);
  readonly redrawFailed = signal(false);
  readonly scriptList = signal<ScriptSummary[]>([]);
  readonly scriptListState = signal<'loading' | 'ready' | 'empty' | 'error'>('loading');

  /** Fixture mode has no write path (`rest-api.md` §1): re-draw is disabled with its reason. */
  readonly readOnly = this.config?.apiType === ApiType.FILES;

  private readonly urlSession = signal<string | null>(null);
  private readonly urlScript = signal<string | null>(null);
  private readonly urlPreview = signal(false);

  /** The script whose record is shown: the route's `:id`, or the project entry's `?script=`. */
  readonly routeScriptId = computed(() => this.id() ?? '');
  readonly scriptId = computed(() => this.routeScriptId() || this.urlScript() || '');
  readonly includePreview = computed(() => this.urlPreview());

  readonly selectedRow = computed<DrawRowModel | null>(() => {
    const rows = this.rows();
    const requested = this.urlSession();
    return rows.find((row) => row.sessionId === requested) ?? rows[0] ?? null;
  });
  readonly selectedSessionId = computed(() => this.selectedRow()?.sessionId ?? null);
  readonly canRedraw = computed(() => {
    const row = this.selectedRow();
    return row === null ? redrawEnablement(null, {readOnly: this.readOnly}) : redrawEnablement(row.status, {readOnly: this.readOnly});
  });
  /** The reason the action carries when it is disabled (ui-spec §7). */
  readonly redrawReason = computed(() => {
    const enablement = this.canRedraw();
    return enablement.reason === 'readOnly' ? this.strings.redrawDisabledReadOnly : this.strings.redrawDisabledStarted;
  });
  readonly redrawTitle = computed(() => (this.canRedraw().enabled ? this.strings.redrawTitle : this.redrawReason()));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.urlSession.set(params.get('session'));
      this.urlScript.set(params.get('script'));
      this.urlPreview.set(params.get('preview') === '1');
    });

    // The record of the selected script.
    effect((onCleanup) => {
      const project = this.p();
      const scriptId = this.scriptId();
      const includePreview = this.includePreview();
      if (scriptId === '') {
        this.rows.set([]);
        this.state.set('empty');
        return;
      }
      this.state.set('loading');
      this.error.set(null);
      const subscription = this.api.scriptDraws(project, scriptId, {includePreview, limit: ROW_LIMIT}).subscribe({
        next: (page) => {
          const rows = parseDrawPage(page);
          this.rows.set(rows);
          this.state.set(rows.length > 0 ? 'ready' : 'empty');
        },
        error: (error: unknown) => {
          this.error.set(describeError(error));
          this.state.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });

    // The trace behind the selected row; keyed on the session id so reloading the table does not
    // re-fetch a trace the screen already holds.
    effect((onCleanup) => {
      const sessionId = this.selectedSessionId();
      if (this.state() !== 'ready' || sessionId === null) {
        this.trace.set(null);
        this.traceState.set('idle');
        return;
      }
      this.traceState.set('loading');
      this.traceError.set(null);
      const subscription = this.api.sessionDraws(this.p(), sessionId).subscribe({
        next: (trace: SessionDrawTrace) => {
          this.trace.set(parseSessionTrace(trace));
          this.traceState.set('ready');
        },
        error: (error: unknown) => {
          this.traceError.set(describeError(error));
          this.traceState.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });

    // The project-scoped entry needs a script to show.
    effect((onCleanup) => {
      if (this.routeScriptId() !== '') {
        return;
      }
      this.scriptListState.set('loading');
      const subscription = this.scripts.list(this.p()).subscribe({
        next: (scripts) => {
          this.scriptList.set(scripts);
          this.scriptListState.set(scripts.length > 0 ? 'ready' : 'empty');
        },
        error: () => this.scriptListState.set('error'),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  select(sessionId: string): void {
    this.redrawMessage.set(null);
    this.updateQuery({session: sessionId});
  }

  /** Well-known DOM node cast: the checkbox is the only element this change can come from. */
  onPreviewChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setIncludePreview(input.checked);
  }

  /** Well-known DOM node cast: the select is the only element this change can come from. */
  onScriptChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.chooseScript(select.value);
  }

  chooseScript(scriptId: string): void {
    this.updateQuery({script: scriptId === '' ? null : scriptId, session: null});
  }

  setIncludePreview(include: boolean): void {
    this.updateQuery({preview: include ? '1' : null, session: null});
  }

  downloadCsv(): void {
    const csv = toCsv(this.rows());
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.strings.csvFileName(this.scriptId());
    anchor.click();
    URL.revokeObjectURL(url);
  }

  redraw(): void {
    const row = this.selectedRow();
    const enablement = this.canRedraw();
    if (row === null || !enablement.enabled || this.redrawBusy()) {
      return;
    }
    this.redrawBusy.set(true);
    this.redrawFailed.set(false);
    this.redrawMessage.set(null);
    this.draws.redraw(this.p(), row.sessionId).subscribe({
      next: (trace) => {
        this.redrawBusy.set(false);
        this.trace.set(parseSessionTrace(trace));
        this.traceState.set('ready');
        this.redrawMessage.set(this.strings.redrawDone);
        this.reloadRows();
      },
      error: (error: unknown) => {
        this.redrawBusy.set(false);
        this.redrawFailed.set(true);
        this.redrawMessage.set(`${this.strings.redrawFailed} ${describeError(error)}`);
      },
    });
  }

  private reloadRows(): void {
    const scriptId = this.scriptId();
    if (scriptId === '') {
      return;
    }
    this.api.scriptDraws(this.p(), scriptId, {includePreview: this.includePreview(), limit: ROW_LIMIT})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.rows.set(parseDrawPage(page)),
        error: () => undefined,
      });
  }

  private updateQuery(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
