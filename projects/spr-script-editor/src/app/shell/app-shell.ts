import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, ElementRef, HostListener, inject, signal, ViewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink, RouterOutlet} from '@angular/router';
import {filter, firstValueFrom} from 'rxjs';
import {EditorFindingsService} from '../core/editor-findings.service';
import {ScriptApiService} from '../core/script-api.service';
import {AccessService} from '../core/access.service';
import {ScriptDraftService} from '../core/script-draft.service';
import {SHELL_STRINGS} from '../core/shell-strings';
import {fillTemplate} from '../core/validation/interpolate';
import type {Finding} from '../core/validation';

const PROJECT_IN_URL = /\/project\/([^/]+)/;
const SCRIPT_IN_URL = /\/project\/[^/]+\/script\/([^/]+)/;
const PUBLISHED_NOTICE_MS = 4000;

/** The `details` a rejected publish returns (rest-api.md §2.4). */
interface PublishErrorEnvelope {
  error?: unknown;
  message?: string;
  details?: {checks?: Finding[]; features?: string[]};
}

/**
 * Shell around every editor screen (ui-spec §1): project breadcrumb with the script name editable
 * in place, the save state, the warning/error count as a link to the source screen, undo/redo,
 * Preview and Publish.
 *
 * The shell is the bootstrap root (`main.ts`) and wraps `<router-outlet>`. It never loads a draft
 * — the editor and source screens own that — it only reads `ScriptDraftService` state and the URL.
 * Where there is no draft for the URL's script (the library list, say) the write controls are
 * hidden rather than showing state that belongs to another script.
 */
@Component({
  selector: 'spre-app-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly api = inject(ScriptApiService);
  readonly draft = inject(ScriptDraftService);
  readonly access = inject(AccessService);
  private readonly findings = inject(EditorFindingsService);

  readonly strings = SHELL_STRINGS;
  readonly url = signal(this.router.url);
  readonly project = computed(() => PROJECT_IN_URL.exec(this.url())?.[1] ?? null);
  readonly scriptId = computed(() => SCRIPT_IN_URL.exec(this.url())?.[1] ?? null);

  /** True on an editor route, whether or not the draft it names has loaded. */
  readonly editorRoute = computed(() => this.scriptId() !== null);

  /**
   * True when the draft service holds the script the URL names **and has a model to show**: `load()`
   * records the requested script before its request returns, so an id match alone would claim a
   * draft that a failed load never produced.
   */
  readonly editorActive = computed(() => {
    const id = this.scriptId();
    return id !== null && this.draft.loadedScript() === id && this.draft.model() !== null;
  });

  readonly scriptName = computed(() => this.draft.model()?.name ?? '');

  readonly counts = this.findings.counts;
  readonly gate = this.findings.gate;
  readonly serverFindings = this.findings.server;

  readonly saveStateText = computed(() => {
    if (!this.editorActive()) {
      // Nothing this URL names is loaded, so "all changes saved" would be a claim about a draft
      // that is not there.
      return this.strings.noDraftState;
    }
    if (this.draft.saving()) {
      return this.strings.savingState;
    }
    if (this.draft.dirty()) {
      return this.strings.unsavedState;
    }
    return this.strings.savedState;
  });

  /** Which half failed: a draft that never loaded reads differently from a save that did not land. */
  readonly saveErrorLabel = computed(() => this.editorActive() ? this.strings.errorState : this.strings.loadFailedState);

  readonly countSummary = computed(() => {
    const {errors, warnings} = this.counts();
    const errorWord = errors === 1 ? this.strings.errorWordOne : this.strings.errorWordMany;
    const warningWord = warnings === 1 ? this.strings.warningWordOne : this.strings.warningWordMany;
    return `${errors} ${errorWord} · ${warnings} ${warningWord}`;
  });

  /** Why Publish is disabled, or `null` when it may run. */
  readonly publishBlockedReason = computed<string | null>(() => {
    if (!this.editorActive()) {
      return this.strings.publishBlockedNoDraft;
    }
    if (this.draft.conflict() !== null) {
      return this.strings.publishBlockedConflict;
    }
    if (this.draft.writesDisabled()) {
      return this.strings.publishBlockedReadOnly;
    }
    if (this.gate().errors > 0) {
      return fillTemplate(this.strings.publishBlockedErrors, {count: this.gate().errors});
    }
    if (this.draft.saving()) {
      return this.strings.savingState;
    }
    // ui-spec §1: "an autosave that cannot reach the server must block Publish and say why".
    if (this.draft.lastError() !== null) {
      return this.strings.publishBlockedSaveFailed;
    }
    return null;
  });

  readonly canPublish = computed(() => this.editorActive() && this.publishBlockedReason() === null);

  /** The warnings the publish dialog lists: the catalogue's warning-severity findings. */
  readonly dialogWarnings = computed(() =>
    this.findings.findings().filter((finding) => finding.severity === 'warning' || finding.suspended === true));

  readonly dialogOpen = signal(false);
  readonly publishing = signal(false);
  readonly note = signal('');
  readonly notice = signal<string | null>(null);
  readonly publishedVersion = signal<number | null>(null);
  readonly serverOpen = signal(false);

  readonly hasBanner = computed(() =>
    this.draft.conflict() !== null ||
    this.notice() !== null ||
    this.publishedVersion() !== null ||
    this.serverFindings().length > 0);

  @ViewChild('publishButton') private publishButton?: ElementRef<HTMLButtonElement>;

  /** Focus moves into the dialog the moment its note field renders. */
  @ViewChild('publishNote')
  set publishNote(element: ElementRef<HTMLTextAreaElement> | undefined) {
    if (element !== undefined) {
      element.nativeElement.focus();
    }
  }

  /** `window.setTimeout`'s handle; the notice clears itself after `PUBLISHED_NOTICE_MS`. */
  private publishedTimer: number | null = null;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }

  /** ui-spec §8: Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Cmd/Ctrl+S, but never inside a text field. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.editorActive() || this.isTypingTarget(event.target)) {
      return;
    }
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.draft.redo();
      } else {
        this.draft.undo();
      }
    } else if (key === 's') {
      event.preventDefault();
      void this.draft.flush();
    }
  }

  onNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.setValue('script.name', ['name'], value);
  }

  onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  dismissNotice(): void {
    this.notice.set(null);
    this.publishedVersion.set(null);
  }

  openPublish(): void {
    // A publish attempt is a discrete action (plan M5 perf): re-run the catalogue now rather than
    // trusting a gate the debounce has not caught up with yet.
    this.findings.recompute();
    if (!this.canPublish()) {
      return;
    }
    this.note.set('');
    this.dialogOpen.set(true);
  }

  closePublish(restoreFocus = true): void {
    if (!this.dialogOpen()) {
      return;
    }
    this.dialogOpen.set(false);
    this.note.set('');
    if (restoreFocus) {
      this.publishButton?.nativeElement.focus();
    }
  }

  /** Flush the draft, then freeze exactly that ETag (rest-api.md §2.4). */
  async confirmPublish(): Promise<void> {
    const project = this.project();
    const scriptId = this.scriptId();
    if (project === null || scriptId === null) {
      this.closePublish();
      return;
    }
    this.publishing.set(true);
    try {
      await this.draft.flush();
      const result = await firstValueFrom(this.api.publish(project, scriptId, {
        fromDraftEtag: this.draft.etag() ?? '',
        note: this.note(),
      }));
      this.findings.clearServer();
      this.showPublished(result.version);
    } catch (error) {
      this.handlePublishError(error);
    } finally {
      this.publishing.set(false);
      this.closePublish();
    }
  }

  private showPublished(version: number): void {
    this.notice.set(null);
    this.publishedVersion.set(version);
    window.clearTimeout(this.publishedTimer ?? undefined);
    this.publishedTimer = window.setTimeout(() => this.publishedVersion.set(null), PUBLISHED_NOTICE_MS);
  }

  /** A rejected publish is rendered, never a bare error (ui-spec §5, rest-api.md §2.4). */
  private handlePublishError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.notice.set(`${this.strings.publishFailed} ${this.strings.unknownError}`);
      return;
    }
    const envelope = (error.error ?? null) as PublishErrorEnvelope | null;
    const checks = envelope?.details?.checks;
    if (Array.isArray(checks)) {
      this.findings.setServer(checks);
      this.serverOpen.set(true);
      this.notice.set(this.strings.publishRejected);
      return;
    }
    if (envelope?.error === 'FEATURE_FLOOR_UNKNOWN') {
      const features = envelope.details?.features ?? [];
      this.notice.set(fillTemplate(this.strings.featureFloor, {features: features.join(', ')}));
      return;
    }
    const message = typeof envelope?.message === 'string' ? envelope.message
      : typeof envelope?.error === 'string' ? envelope.error
      : `HTTP ${error.status}`;
    this.notice.set(`${this.strings.publishFailed} ${message}`);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  }
}
