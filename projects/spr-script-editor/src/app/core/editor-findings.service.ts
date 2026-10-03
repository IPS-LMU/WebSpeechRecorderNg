/**
 * The current draft's findings, shared between the screens that compute them (the editor screen and
 * the JSON source screen) and the shell, which shows the warning count and gates Publish. Client
 * findings are the catalogue's; server findings are the `details.checks` a `409 PUBLISH_REJECTED`
 * returns and are shape-compatible (`{id, path, severity, message}` from `server/validate.mjs`).
 *
 * The catalogue run is *debounced* (plan M5 perf): typing schedules a single recompute a quiet
 * period after the last edit, so a burst of keystrokes over a 500-item draft costs one run, not one
 * per keystroke. An edit that is a discrete action — a one-click fix, a section/group/item added, a
 * JSON apply, a reorder drop, a publish attempt — calls `refresh` instead and is reflected at once.
 * The service owns the timer, the run and the cancellation, so both screens share one policy and a
 * pending run cannot survive its screen (`cancelPending` on destroy).
 *
 * The catalogue still runs on the draft+context the calling screen hands over: the injected context
 * (bank `matchCount`, media index, deployment version, `previousDraft` for N04) stays with the
 * screen that owns it; the service only remembers the latest pair so a publish attempt can
 * recompute from it without knowing the context itself.
 */
import {computed, Injectable, signal} from '@angular/core';
import {
  checkCounts,
  publishGate,
  runChecks,
  type CheckCounts,
  type Draft,
  type Finding,
  type PublishGate,
  type ValidationContext,
} from './validation';

/** How long the editor waits after the last model change before re-running the catalogue. */
export const FINDINGS_DEBOUNCE_MS = 250;

/** A draft and the injected context its catalogue run reads. */
interface ClientSource {
  draft: Draft;
  context: ValidationContext;
}

@Injectable({providedIn: 'root'})
export class EditorFindingsService {
  private readonly clientSignal = signal<ReadonlyArray<Finding>>([]);
  private readonly serverSignal = signal<ReadonlyArray<Finding>>([]);

  readonly client = this.clientSignal.asReadonly();
  readonly server = this.serverSignal.asReadonly();

  readonly findings = computed<ReadonlyArray<Finding>>(() => [...this.clientSignal(), ...this.serverSignal()]);
  readonly counts = computed<CheckCounts>(() => checkCounts(this.findings()));
  readonly gate = computed<PublishGate>(() => publishGate(this.findings()));

  /** The latest pair handed over by the active screen; `recompute` re-runs the catalogue from it. */
  private latest: ClientSource | null = null;
  /** The pair the current `clientSignal` was computed from, so a repeat change is a no-op. */
  private computedFor: ClientSource | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Bumped by every supersede (a new schedule, an immediate `refresh`, `setClient`, teardown). A
   * queued run only writes its findings when it still carries the current generation, so a stale
   * run can never overwrite newer findings.
   */
  private generation = 0;

  /**
   * Recomputes once the operator stops editing: every call restarts the quiet period, so a burst of
   * model changes collapses into a single catalogue run. A pair already reflected in `client` is a
   * no-op (the discrete-action path has just computed it).
   */
  scheduleClient(draft: Draft, context: ValidationContext = {}): void {
    const source: ClientSource = {draft, context};
    this.latest = source;
    if (this.timer === null && this.computedFor !== null &&
        this.computedFor.draft === draft && this.computedFor.context === context) {
      return;
    }
    this.cancelTimer();
    const generation = ++this.generation;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (generation !== this.generation) {
        return;
      }
      this.computedFor = source;
      this.clientSignal.set(runChecks(draft, context));
    }, FINDINGS_DEBOUNCE_MS);
  }

  /**
   * Recomputes now, for an edit that is a discrete action (a fix, an add, a JSON apply, a reorder
   * drop, a publish attempt) — never left to the timer. Cancels any queued run first.
   */
  refresh(draft: Draft, context: ValidationContext = {}): void {
    this.cancelPending();
    const source: ClientSource = {draft, context};
    const findings = runChecks(draft, context);
    this.latest = source;
    this.computedFor = source;
    this.clientSignal.set(findings);
  }

  /**
   * Recomputes now from the latest draft/context a screen handed over — the publish attempt's
   * entry point, so a stale gate cannot let a draft the catalogue rejects through.
   */
  recompute(): void {
    const source = this.latest;
    if (source !== null) {
      this.refresh(source.draft, source.context);
    }
  }

  /** Replaces the catalogue findings for the current draft. */
  setClient(findings: ReadonlyArray<Finding>): void {
    this.cancelPending();
    this.clientSignal.set(findings);
  }

  /** Replaces the server findings a failed publish returned. */
  setServer(findings: ReadonlyArray<Finding>): void {
    this.serverSignal.set(findings);
  }

  clearServer(): void {
    this.serverSignal.set([]);
  }

  /** Drops any queued recompute; a screen calls this when it is destroyed. */
  cancelPending(): void {
    this.cancelTimer();
    this.generation++;
    this.latest = null;
    this.computedFor = null;
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
