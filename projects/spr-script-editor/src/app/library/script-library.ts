import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {ScriptApiService} from '../core/script-api.service';
import {ScriptStatus, ScriptSummary} from '../core/script.model';
import {DEFAULT_PROJECT} from '../editor.config';

type ListState = 'loading' | 'ready' | 'empty' | 'error';
type StatusFilter = 'ALL' | ScriptStatus;

/**
 * The usage cell of ui-spec §2: how many sessions ran this script and which published versions they
 * were created from (`rest-api.md` §2.1's `sessions.byVersion`). Null when the script has never run,
 * so the cell shows the placeholder instead of "0 sessions".
 */
export function usageLabel(summary: ScriptSummary): string | null {
  const counts = summary.sessions;
  if (counts === undefined || counts === null || counts.total <= 0) {
    return null;
  }
  const versions = Object.keys(counts.byVersion ?? {}).sort((a, b) => Number(a) - Number(b));
  const suffix = versions.length === 0
    ? ''
    : ` (${versions.map((version) => `${EDITOR_STRINGS.library.versionPrefix}${version}`).join(', ')})`;
  return `${counts.total} ${EDITOR_STRINGS.library.sessionsWord}${suffix}`;
}

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return `${EDITOR_STRINGS.library.errorPrefix} (${EDITOR_STRINGS.library.httpPrefix} ${error.status})`;
  }
  return EDITOR_STRINGS.library.errorPrefix;
}

/**
 * Script library (ui-spec §2): the project's scripts in a table, with a filter row, the three
 * legend cards and empty/loading/error states (ui-spec §9). M2 is read-only, so New, Import,
 * duplicate, archive, export and the per-row Edit *button* are disabled; Edit is a link into the
 * editor route when the route exists (it does — the screen behind it is a later milestone).
 */
@Component({
  selector: 'spre-script-library',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './script-library.html',
  styleUrl: './script-library.scss',
})
export class ScriptLibrary {
  private readonly api = inject(ScriptApiService);

  readonly strings = EDITOR_STRINGS;

  /** The usage cell (ui-spec §2) — a module-level pure function, exposed for the template. */
  readonly usageLabel = usageLabel;

  /** Route param `:p` (bound through `withComponentInputBinding`). */
  readonly p = input<string>(DEFAULT_PROJECT);

  readonly state = signal<ListState>('loading');
  readonly scripts = signal<ScriptSummary[]>([]);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly status = signal<StatusFilter>('ALL');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    return this.scripts().filter((script) => {
      const statusMatches = status === 'ALL' || script.status === status;
      const textMatches = term === ''
        || script.name.toLowerCase().includes(term)
        || String(script.scriptId).toLowerCase().includes(term);
      return statusMatches && textMatches;
    });
  });

  constructor() {
    effect((onCleanup) => {
      const project = this.p();
      this.state.set('loading');
      this.error.set(null);
      const subscription = this.api.list(project).subscribe({
        next: (rows) => {
          this.scripts.set(rows ?? []);
          this.state.set(rows && rows.length > 0 ? 'ready' : 'empty');
        },
        error: (error: unknown) => {
          this.error.set(describeError(error));
          this.state.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
