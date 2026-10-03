import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ScriptApiService} from '../core/script-api.service';
import {ScriptStatus, ScriptSummary} from '../core/script.model';
import {DEFAULT_PROJECT} from '../editor.config';

type ListState = 'loading' | 'ready' | 'empty' | 'error';
type StatusFilter = 'ALL' | ScriptStatus;

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const statusText = error.statusText ? ` ${error.statusText}` : '';
    return `The server answered ${error.status}${statusText}.`;
  }
  return error instanceof Error ? error.message : 'The script list could not be loaded.';
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
