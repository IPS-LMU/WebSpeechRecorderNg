import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {
  effectiveTiming,
  playbackPlan,
  playbackStart,
  playbackTiming,
  replayAllowed,
  sectionNeedsHeadphones,
  type PlaybackTiming,
  type PromptItem,
} from 'speechrecorderng';
import {PREVIEW_STRINGS} from './preview-strings';
import {loadScript} from '../core/load';
import {MediaService} from '../core/media.service';
import {ScriptApiService} from '../core/script-api.service';
import type {EditorScript} from '../core/script.model';
import {DEFAULT_PROJECT} from '../editor.config';
import {buildOrderRows, selectableRows, type OrderRow} from './preview-order';
import {PreviewOrderPanel} from './preview-order-panel';
import {PreviewPlaybackPanel, type Lamps} from './preview-playback-panel';
import {stageParts, type MediaIndex, type StagePart} from './preview-stage';
import {PreviewStagePanel} from './preview-stage-panel';
import {PreviewStepSimulation} from './preview-step-simulation';
import {PreviewTier2Panel} from './preview-tier2-panel';
import {PreviewTransportBar} from './preview-transport-bar';
import {soundStep, stepViews, type SimStep, type StepView} from './preview-steps';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return `The server answered ${error.status}${error.statusText ? ` ${error.statusText}` : ''}.`;
  }
  return error instanceof Error ? error.message : 'unknown error';
}

/**
 * Preview, tier 1 (ui-spec §4): the recorder's speaker frame drawn from the script, with the step
 * simulation and the session order list.
 *
 * It is a mock of the *screen*: no audio is captured or played, no session is created, and the only
 * network reads are the script and the media list the editor already has endpoints for. Every
 * behaviour it shows comes from the library — `promptVisibleAt`, `effectiveTiming`, `playbackStart`,
 * `replayAllowed`, `sectionNeedsHeadphones`, `ITEM_PHASES`/`nextPhase` — never from a local copy of
 * the recorder's rules (plan M2, E2/D8).
 *
 * This component owns the frame's chrome and the state; the stage, the playing state and signal,
 * the step simulation, the transport and the order list are their own components, each with its
 * own (small) stylesheet.
 *
 * The state that survives a reload is in the URL: `?item=<row key>` selects an item row and
 * `?step=<SimStep>` a step of the simulation.
 */
@Component({
  selector: 'spre-script-preview',
  standalone: true,
  imports: [
    PreviewStagePanel,
    PreviewPlaybackPanel,
    PreviewStepSimulation,
    PreviewTier2Panel,
    PreviewTransportBar,
    PreviewOrderPanel,
  ],
  templateUrl: './script-preview.html',
  styleUrl: './script-preview.scss',
})
export class ScriptPreview {
  private readonly api = inject(ScriptApiService);
  private readonly media = inject(MediaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly strings = PREVIEW_STRINGS;

  /** Route params (bound through `withComponentInputBinding`). */
  readonly p = input<string>(DEFAULT_PROJECT);
  readonly id = input<string>('');

  readonly state = signal<LoadState>('loading');
  readonly script = signal<EditorScript | null>(null);
  readonly error = signal<string | null>(null);
  /** Declared playback files of the project; null while unknown, so nothing is called missing. */
  readonly mediaIndex = signal<MediaIndex | null>(null);
  readonly generation = signal(0);

  private readonly urlItem = signal<string | null>(null);
  private readonly urlStep = signal<SimStep | null>(null);
  /** Replays used per row key; the counter resets when the selection moves. */
  private readonly replays = signal<{key: string; used: number}>({key: '', used: 0});

  readonly rows = computed(() => buildOrderRows(this.script(), this.generation()));
  readonly selectable = computed(() => selectableRows(this.rows()));
  readonly currentRow = computed<OrderRow | null>(() => {
    const rows = this.selectable();
    const requested = this.urlItem();
    return rows.find((row) => row.key === requested) ?? rows[0] ?? null;
  });
  readonly current = computed<PromptItem | null>(() => this.currentRow()?.item ?? null);
  readonly currentSection = computed(() => this.currentRow()?.section ?? null);
  readonly sectionName = computed(() => {
    const row = this.currentRow();
    if (row === null) {
      return '';
    }
    return row.section.name?.trim() || `${this.strings.sectionOne} ${row.sectionIndex + 1}`;
  });
  readonly plan = computed(() => playbackPlan(this.current()));
  readonly views = computed(() => stepViews(this.current(), this.currentSection()));
  readonly simStep = computed<SimStep>(() => {
    const requested = this.urlStep();
    const views = this.views();
    return views.find((view) => view.step === requested && view.applies)?.step ?? 'IDLE';
  });
  readonly currentView = computed<StepView | null>(
    () => this.views().find((view) => view.step === this.simStep()) ?? null,
  );
  readonly timing = computed(() => effectiveTiming(this.current()));
  readonly start = computed(() => playbackStart(this.plan()));
  readonly placement = computed<PlaybackTiming>(() => playbackTiming(this.start()));
  readonly headphones = computed(() => sectionNeedsHeadphones(this.currentSection()));
  readonly stage = computed<StagePart[]>(() => stageParts(this.current(), this.mediaIndex()));
  readonly replaysUsed = computed(() => (this.replays().key === this.currentRow()?.key ? this.replays().used : 0));
  readonly canReplay = computed(() => replayAllowed(this.plan(), this.replaysUsed()));
  readonly isDrawn = computed(() => this.currentRow()?.drawn === true);
  readonly previousRow = computed<OrderRow | null>(() => this.neighbour(-1));
  readonly nextRow = computed<OrderRow | null>(() => this.neighbour(1));
  readonly canPrevious = computed(() => this.previousRow() !== null);
  readonly canNext = computed(() => this.nextRow() !== null);
  readonly canRecord = computed(() => this.applies('RECORDING'));
  readonly canStop = computed(() => this.applies('IDLE'));
  readonly replayTitle = computed(() =>
    this.canReplay() ? this.strings.replayTitle : this.strings.replayLimitTitle,
  );

  readonly progress = computed(() => {
    const rows = this.selectable();
    const index = rows.findIndex((row) => row.key === this.currentRow()?.key);
    if (index < 0) {
      return '';
    }
    const drawn = rows.filter((row) => row.drawn).length;
    const drawnPart = drawn > 0 ? ` · ${drawn} ${this.strings.drawnWord}` : '';
    return `${this.strings.itemOne} ${index + 1} ${this.strings.ofWord} ${rows.length}${drawnPart}`;
  });

  readonly lamps = computed<Lamps>(() => {
    const view = this.currentView();
    const step = view?.step ?? 'IDLE';
    return {
      hold: step === 'IDLE' || step === 'PRE_REC',
      cue: step === 'PRE_REC' || step === 'POST_REC',
      live: step === 'RECORDING',
      playback: view?.sound === true,
    };
  });

  /** The mock's level meter: a fixed, deterministic reading per step (never random). */
  readonly level = computed(() => {
    switch (this.simStep()) {
      case 'LISTENING':
        return 44;
      case 'RECORDING':
        return 62;
      default:
        return 0;
    }
  });

  readonly statusText = computed(() => this.stepStatus(this.simStep()));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.urlItem.set(params.get('item'));
      const step = params.get('step');
      this.urlStep.set(step === null ? null : (step as SimStep));
    });

    effect((onCleanup) => {
      const id = this.id();
      const project = this.p();
      if (!id) {
        return;
      }
      this.state.set('loading');
      this.error.set(null);
      const scriptSubscription = this.api.getScript(id).subscribe({
        next: (script) => {
          const loaded = loadScript(script as EditorScript);
          this.script.set(loaded);
          this.state.set(selectableRows(buildOrderRows(loaded, 0)).length === 0 ? 'empty' : 'ready');
        },
        error: (error: unknown) => {
          this.error.set(describeError(error));
          this.state.set('error');
        },
      });
      const mediaSubscription = this.media.list(project).subscribe({
        next: (entries) => this.mediaIndex.set(new Map(entries.map((entry) => [entry.src, entry.durationMs ?? null]))),
        // The list is an aid: when it cannot be read, no file is claimed to be missing.
        error: () => this.mediaIndex.set(null),
      });
      onCleanup(() => {
        scriptSubscription.unsubscribe();
        mediaSubscription.unsubscribe();
      });
    });
  }

  private neighbour(offset: number): OrderRow | null {
    const rows = this.selectable();
    const index = rows.findIndex((row) => row.key === this.currentRow()?.key);
    return index < 0 ? null : (rows[index + offset] ?? null);
  }

  /** URL query writes replace the current entry: the mock is a screen state, not a history. */
  private updateQuery(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  selectRow(row: OrderRow): void {
    if (row.item === null) {
      return;
    }
    this.updateQuery({item: row.key, step: null});
  }

  goToStep(step: SimStep): void {
    if (!this.applies(step)) {
      return;
    }
    this.updateQuery({step});
  }

  redraw(): void {
    this.generation.update((generation) => generation + 1);
  }

  /** Play the item's sound, from the top; the mock moves to the sound's step and counts the use. */
  play(): void {
    if (!this.canReplay()) {
      return;
    }
    this.replays.set({key: this.currentRow()?.key ?? '', used: this.replaysUsed() + 1});
    this.goToStep(soundStep(this.plan()) ?? 'LISTENING');
  }

  record(): void {
    this.goToStep('RECORDING');
  }

  stop(): void {
    this.goToStep('IDLE');
  }

  previousItem(): void {
    const row = this.previousRow();
    if (row !== null) {
      this.selectRow(row);
    }
  }

  nextItem(): void {
    const row = this.nextRow();
    if (row !== null) {
      this.selectRow(row);
    }
  }

  /** Whether a step happens for the selected item (the transport gates its controls on this). */
  applies(step: SimStep): boolean {
    return this.views().find((view) => view.step === step)?.applies === true;
  }

  stepStatus(step: SimStep): string {
    switch (step) {
      case 'IDLE':
        return this.strings.statusIdle;
      case 'LISTENING':
        return this.strings.statusListening;
      case 'PRE_REC':
        return this.strings.statusPreRec;
      case 'RECORDING':
        return this.strings.statusRecording;
      case 'POST_REC':
        return this.strings.statusPostRec;
    }
  }

  /** Where the item's sound sits relative to its clocks, in words (from `playbackStart`). */
  soundPlacement(): string {
    switch (this.timing().playbackWhen) {
      case 'WITH_PROMPT':
        return this.strings.soundWhenWithPrompt;
      case 'BEFORE':
        return this.strings.soundWhenBefore;
      case 'PRERECORDING':
        return this.strings.soundWhenPreRecording;
      case 'DURING':
        return this.strings.soundWhenDuring;
      case 'ONDEMAND':
        return this.strings.soundWhenOnDemand;
      default:
        return this.strings.timingNoSound;
    }
  }

  /** Replays used against the item's cap, or "unlimited" when the plan does not cap them. */
  replayCountLabel(): string {
    const maxReplays = this.plan()?.maxReplays ?? null;
    return `${this.replaysUsed()} / ${maxReplays === null ? this.strings.replaysUnlimited : maxReplays}`;
  }
}
