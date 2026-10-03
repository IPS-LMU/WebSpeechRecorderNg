import {Component, computed, input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {
  MediaitemUtil,
  effectiveTiming,
  playbackPlan,
  type Bank,
  type EffectiveTiming,
  type Mediaitem,
  type Mode,
  type Order,
  type PlaybackWhen,
  type PrefillBankSource,
  type PromptItem,
  type PromptPhase,
} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {fillTemplate} from '../../core/validation/interpolate';
import {findingsUnder, type BankView, type Finding} from '../../core/validation';
import {queryBank} from '../../core/validation/filter';
import {isObject} from '../../core/validation/walk';
import type {EditorGroup, EditorScript, EditorSection, MediaEntry} from '../../core/script.model';
import {drawnSource, isDrawnGroup} from '../markers';
import {drawnFilterWords} from '../drawn-filter';
import {previewCodes} from '../example-draw';
import type {Selection} from '../selection';
import {selectionPath} from '../selection';
import {EditorTimeline} from '../timeline/editor-timeline';

const S = EDITOR_STRINGS;

type PromptMediaKind = 'plain' | 'formatted' | 'image' | 'nothing';

/**
 * The inspector column (ui-spec §3.3). Four variants — script, section, group, prompt item — whose
 * fields map one to one onto the model. M2 is read-only: every control renders the real value and
 * is disabled with a title explaining that editing arrives with the draft service (M3). The
 * playback block and the timing block are rendered from the library's rules.
 */
@Component({
  selector: 'spr-editor-inspector',
  imports: [RouterLink, EditorTimeline],
  templateUrl: './editor-inspector.html',
  styleUrl: './editor-inspector.scss',
})
export class EditorInspector {
  readonly script = input<EditorScript | null>(null);
  readonly selection = input<Selection>({kind: 'script'});
  readonly findings = input<ReadonlyArray<Finding>>([]);
  readonly bankViews = input<ReadonlyMap<string, BankView>>(new Map());
  readonly bankList = input<ReadonlyArray<Bank>>([]);
  readonly media = input<ReadonlyArray<MediaEntry>>([]);
  readonly project = input('');
  readonly scriptId = input('');

  readonly strings = S;
  readonly readOnlyReason = S.editor.readOnlyReason;
  readonly modes: ReadonlyArray<Mode> = ['MANUAL', 'AUTOPROGRESS', 'AUTORECORDING'];
  readonly orders: ReadonlyArray<Order> = ['SEQUENTIAL', 'RANDOM'];
  readonly playbackWhens: ReadonlyArray<PlaybackWhen> = ['WITH_PROMPT', 'BEFORE', 'PRERECORDING', 'DURING', 'ONDEMAND'];
  readonly promptPhases: ReadonlyArray<PromptPhase> = ['IDLE', 'PRERECORDING', 'PRERECORDINGONLY', 'RECORDING'];
  readonly fixedBys: ReadonlyArray<'SESSION' | 'SPEAKER' | 'SCRIPT'> = ['SESSION', 'SPEAKER', 'SCRIPT'];

  private readonly sectionIndex = computed(() => {
    const selection = this.selection();
    return selection.kind === 'script' ? null : selection.section;
  });

  readonly section = computed<EditorSection | null>(() => {
    const index = this.sectionIndex();
    return index === null ? null : this.script()?.sections?.[index] ?? null;
  });

  readonly group = computed<EditorGroup | null>(() => {
    const selection = this.selection();
    return selection.kind === 'group' || selection.kind === 'item'
      ? this.section()?.groups?.[selection.group] ?? null
      : null;
  });

  readonly item = computed<PromptItem | null>(() => {
    const selection = this.selection();
    return selection.kind === 'item'
      ? this.group()?.promptItems?.[selection.item] ?? null
      : null;
  });

  readonly sectionOrder = computed<Order | null>(() => {
    const section = this.section();
    const order = isObject(section) ? section['order'] : undefined;
    return typeof order === 'string' ? order as Order : null;
  });

  readonly drawn = computed<PrefillBankSource | null>(() => {
    const group = this.group();
    return group !== null && isDrawnGroup(group)
      ? drawnSource(group.promptItems?.find((candidate) => drawnSource(candidate) !== null))
      : null;
  });

  readonly bankView = computed<BankView | null>(() => {
    const bankId = this.drawn()?.bank;
    return bankId === undefined ? null : this.bankViews().get(bankId) ?? null;
  });

  readonly matchCount = computed<number | null>(() => {
    const view = this.bankView();
    const source = this.drawn();
    return view === null || source === null ? null : queryBank(view, source.filter ?? {}).matchCount;
  });

  readonly applicableFindings = computed(() => findingsUnder(this.findings(), selectionPath(this.selection())));

  readonly bankTotal = computed<number | null>(() => {
    const bankId = this.drawn()?.bank;
    const bank = this.bankList().find((candidate) => candidate.bankId === bankId);
    return bank?.itemCount ?? this.bankView()?.items.length ?? null;
  });

  readonly matchSummary = computed<string | null>(() => {
    const match = this.matchCount();
    const total = this.bankTotal();
    return match === null || total === null ? null : fillTemplate(S.centre.matchCount, {match, total});
  });

  /** The `:groupRef` of the bank screen route: the group's position in the script. */
  groupRef(): string {
    const selection = this.selection();
    return selection.kind === 'group' || selection.kind === 'item'
      ? `${selection.section}.${selection.group}`
      : '';
  }

  readonly itemTiming = computed<EffectiveTiming | null>(() => {
    const item = this.item();
    return item === null ? null : effectiveTiming(item);
  });

  readonly audio = computed<Mediaitem | null>(() => {
    const item = this.item();
    const mediaitems = item?.mediaitems ?? [];
    return mediaitems.find((candidate) => MediaitemUtil.kind(candidate) === 'audio') ?? null;
  });

  readonly audioDuration = computed<number | null>(() => {
    const declared = this.item()?.playback?.durationMs;
    if (typeof declared === 'number') {
      return declared;
    }
    const src = this.audio()?.src;
    const entry = this.media().find((candidate) => candidate.src === src);
    return typeof entry?.durationMs === 'number' ? entry.durationMs : null;
  });

  readonly audioUrl = computed(() => this.audio()?.src ?? null);

  readonly when = computed(() => this.item()?.playback?.when ?? 'WITH_PROMPT');

  readonly w03 = computed(() => {
    const playback = this.item()?.playback;
    return playback?.when === 'DURING' && playback.headphones !== true;
  });

  readonly scriptCounts = computed(() => {
    let fixed = 0;
    let drawn = 0;
    for (const section of this.script()?.sections ?? []) {
      for (const group of section.groups ?? []) {
        const source = drawnSource(group.promptItems?.find((candidate) => drawnSource(candidate) !== null));
        if (source !== null) {
          drawn += Number(source.count) || 0;
        } else {
          fixed += group.promptItems?.length ?? 0;
        }
      }
    }
    return {sections: this.script()?.sections?.length ?? 0, fixed, drawn};
  });

  mediaKind(item: PromptItem | null): PromptMediaKind {
    const mediaitem = item?.mediaitems?.[0];
    const kind = MediaitemUtil.kind(mediaitem);
    switch (kind) {
      case 'prompt':
        return 'formatted';
      case 'image':
        return 'image';
      case 'text':
        return 'plain';
      default:
        return 'nothing';
    }
  }

  promptText(item: PromptItem | null): string {
    const mediaitem = item?.mediaitems?.[0];
    return mediaitem === undefined ? '' : MediaitemUtil.toPlainTextString(mediaitem) ?? '';
  }

  instructions(item: PromptItem | null): string {
    const value = item?.recinstructions as {recinstructions?: string} | string | undefined;
    if (typeof value === 'string') {
      return value;
    }
    return value?.recinstructions ?? '';
  }

  repeatsValue(item: PromptItem | null): number {
    return item?.playback?.repeats ?? 1;
  }

  gapValue(item: PromptItem | null): number {
    return item?.playback?.gap ?? 500;
  }

  maxReplaysValue(item: PromptItem | null): number | null {
    return item?.playback?.maxReplays ?? null;
  }

  headphonesValue(item: PromptItem | null): boolean {
    return item?.playback?.headphones === true;
  }

  /** The item's mediaitem flags matter only when no modifier takes over (W13). */
  mediaFlag(item: PromptItem | null, key: 'autoplay' | 'replay'): boolean {
    const mediaitem = this.audioMediaitem(item);
    return mediaitem?.[key] ?? true;
  }

  audioMediaitem(item: PromptItem | null): Mediaitem | null {
    const mediaitems = item?.mediaitems ?? [];
    return mediaitems.find((candidate) => MediaitemUtil.kind(candidate) === 'audio') ?? null;
  }

  replayValue(item: PromptItem | null): boolean {
    return item?.playback === undefined
      ? this.mediaFlag(item, 'replay')
      : item.playback.replayable ?? this.mediaFlag(item, 'replay');
  }

  orderLabel(order: Order | null): string {
    switch (order) {
      case 'RANDOM':
        return S.inspector.section.orderRandom;
      case 'RANDOMIZED':
        return S.inspector.section.orderRandomized;
      default:
        return S.inspector.section.orderSequential;
    }
  }

  /** Shared with the centre's drawn-group card so both describe the rule the same way. */
  readonly filterWords = drawnFilterWords;

  prefixPreview(source: PrefillBankSource | null): string {
    const codes = previewCodes(source?.itemcodePrefix ?? '', Number(source?.count) || 0);
    if (codes.length === 0) {
      return '';
    }
    const summary = codes.length <= 3
      ? codes.join(', ')
      : `${codes[0]} … ${codes[codes.length - 1]}`;
    return fillTemplate(S.inspector.group.prefixPreview, {codes: summary});
  }

  bankOptions(bankList: ReadonlyArray<Bank>, source: 'PROJECT' | 'BUILTIN'): Bank[] {
    return bankList.filter((bank) => bank.source === source);
  }

  fixedByLabel(value: 'SESSION' | 'SPEAKER' | 'SCRIPT'): string {
    switch (value) {
      case 'SPEAKER':
        return S.inspector.group.fixedBySPEAKER;
      case 'SCRIPT':
        return S.inspector.group.fixedBySCRIPT;
      default:
        return S.inspector.group.fixedBySESSION;
    }
  }

  isDrawn(): boolean {
    return this.drawn() !== null;
  }

  /** The audio mediaitem's alt text, falling back to the file name. */
  audioLabel(): string {
    const mediaitem = this.audio();
    return mediaitem?.alt ?? mediaitem?.src ?? S.inspector.playback.fileNone;
  }

  placementLabel(): string {
    const plan = this.item() === null ? null : playbackPlan(this.item());
    const when = this.when();
    const labels = S.inspector.playback.whenOptions;
    return plan === null ? labels[when] : labels[plan.when];
  }
}
