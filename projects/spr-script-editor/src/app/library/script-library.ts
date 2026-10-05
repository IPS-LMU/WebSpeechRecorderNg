import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {downloadJson} from '../core/download';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {CreateScriptBody, ScriptApiService} from '../core/script-api.service';
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
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return EDITOR_STRINGS.library.errorPrefix;
}

/**
 * Script library (ui-spec §2): the project's scripts in a table, with a filter row, the three
 * legend cards and empty/loading/error states (ui-spec §9), and the actions of ui-spec §2: New
 * script, Import JSON, and per row Edit (a link), duplicate, archive/unarchive and Export JSON.
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
  private readonly router = inject(Router);

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

  /** Bumping this re-runs the list request: the ui-spec §9 error state's retry. */
  private readonly reload = signal(0);

  /** Re-issues the list request after a failure, showing the loading state again. */
  retry(): void {
    this.state.set('loading');
    this.error.set(null);
    this.reload.update((value) => value + 1);
  }

  /** True while an action's request is in flight, so the actions cannot be double-fired. */
  readonly busy = signal(false);
  /** Why the last action failed; the template shows it above the table. */
  readonly actionError = signal<string | null>(null);

  /** `POST project/{p}/script` with no body: the server seeds a minimal valid script (rest-api §2.2). */
  async newScript(): Promise<void> {
    await this.createThenOpen({});
  }

  /**
   * Import JSON: a **new** script whose draft is the file's text (rest-api §2.2 — import always
   * assigns a new id, so nothing existing is touched). The file is parsed before the create, so a
   * wrong pick fails without leaving a half-made script behind.
   */
  async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be picked again
    if (file === undefined) {
      return;
    }
    const text = await file.text();
    try {
      JSON.parse(text);
    } catch {
      this.actionError.set(`${this.strings.library.importFailed} ${file.name}`);
      return;
    }
    await this.createThenOpen({name: file.name.replace(/\.json$/i, '')}, text);
  }

  /** Duplicate into a new draft, from the row's published version or its draft (rest-api §2.2). */
  async duplicate(script: ScriptSummary): Promise<void> {
    await this.createThenOpen({from: {scriptId: script.scriptId}});
  }

  /** Archive or unarchive, then re-read the list so the chip matches the server (rest-api §2.6). */
  async archive(script: ScriptSummary): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.patchScript(this.p(), script.scriptId, {archived: script.archived !== true}));
      this.retry();
    } catch (error) {
      this.actionError.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Export JSON: the draft when there is one, else the newest published version. */
  async exportJson(script: ScriptSummary): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      downloadJson(`script-${script.scriptId}.json`, await this.scriptText(script));
    } catch (error) {
      this.actionError.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Creates a script (optionally filling its draft) and opens its editor. */
  private async createThenOpen(body: CreateScriptBody, draftText?: string): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const created = await firstValueFrom(this.api.createScript(this.p(), body));
      if (draftText !== undefined) {
        await firstValueFrom(this.api.writeDraft(this.p(), created.scriptId, draftText, created.etag));
      }
      await this.router.navigate(['/project', this.p(), 'script', created.scriptId, 'edit']);
    } catch (error) {
      this.actionError.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** The bytes Export hands over: the draft, or the newest published version when there is none. */
  private async scriptText(script: ScriptSummary): Promise<string> {
    try {
      return (await firstValueFrom(this.api.readDraft(this.p(), script.scriptId))).text;
    } catch (error) {
      // A script the migration left without a draft still has published versions to hand out.
      if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
        throw error;
      }
    }
    const index = await firstValueFrom(this.api.versions(this.p(), script.scriptId));
    const newest = index[0]?.version;
    if (newest === undefined) {
      throw new Error(this.strings.library.exportEmpty);
    }
    const published = await firstValueFrom(this.api.publishedVersion(this.p(), script.scriptId, newest));
    return `${JSON.stringify(published, null, 2)}\n`;
  }

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    return this.scripts().filter((script) => {
      const statusMatches = status === 'ALL' || script.status === status;
      const textMatches = term === ''
        || script.name.toLowerCase().includes(term)
        || String(script.scriptId).toLowerCase().includes(term)
        || (script.itemcodes ?? []).some((code) => code.toLowerCase().includes(term));
      return statusMatches && textMatches;
    });
  });

  constructor() {
    effect((onCleanup) => {
      const project = this.p();
      this.reload();
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
