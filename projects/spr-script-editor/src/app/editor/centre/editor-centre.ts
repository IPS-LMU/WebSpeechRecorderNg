import {Component, computed, input, output, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {
  MediaitemUtil,
  effectiveTiming,
  type Bank,
  type Mode,
  type PromptItem,
  type PromptPhase,
  type PrefillBankSource,
} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {fillTemplate} from '../../core/validation/interpolate';
import {findingsUnder, type BankView, type Finding} from '../../core/validation';
import {queryBank} from '../../core/validation/filter';
import type {EditorGroup, EditorScript, EditorSection} from '../../core/script.model';
import {drawnPlaceholder, drawnSource, hasWarning, itemPlaysMedia} from '../markers';
import {drawnFilterWords} from '../drawn-filter';
import {exampleDraw, previewCodes, type ExampleDrawItem} from '../example-draw';
import {sectionCounts, type SectionCounts} from '../outline';
import type {Selection} from '../selection';
import {selectionEquals} from '../selection';

const S = EDITOR_STRINGS;

interface SectionCard {
  index: number;
  name: string;
  mode: Mode | null;
  counts: SectionCounts;
  training: boolean;
  playMedia: number;
}

interface FixedBlock {
  kind: 'fixed';
  key: string;
  index: number;
  items: PromptItem[];
}

interface DrawnBlock {
  kind: 'drawn';
  key: string;
  index: number;
  source: PrefillBankSource;
  bank: BankView | null;
  match: number | null;
  example: ExampleDrawItem[];
}

type Block = FixedBlock | DrawnBlock;

/**
 * The centre column (ui-spec §3.2) in its two modes: with the script selected, one card per
 * section; with a section selected, a header and one block per group. Fixed groups are tables of
 * row buttons; a drawn group is a card whose example draw is deterministic and clearly labelled as
 * an example.
 */
@Component({
  selector: 'spr-editor-centre',
  imports: [RouterLink],
  templateUrl: './editor-centre.html',
  styleUrl: './editor-centre.scss',
})
export class EditorCentre {
  readonly script = input<EditorScript | null>(null);
  readonly selection = input<Selection>({kind: 'script'});
  readonly findings = input<ReadonlyArray<Finding>>([]);
  readonly bankViews = input<ReadonlyMap<string, BankView>>(new Map());
  readonly bankList = input<ReadonlyArray<Bank>>([]);
  readonly project = input('');
  readonly scriptId = input('');

  readonly select = output<Selection>();

  readonly strings = S;
  readonly filterWords = drawnFilterWords;
  /** Example-draw offset per drawn group, so "Draw another example" walks a fixed sequence. */
  private readonly offsets = signal<Record<string, number>>({});

  readonly sections = computed<EditorSection[]>(() => this.script()?.sections ?? []);

  readonly scriptMode = computed(() => this.selection().kind === 'script');

  readonly activeSectionIndex = computed<number | null>(() => {
    const selection = this.selection();
    return selection.kind === 'script' ? null : selection.section;
  });

  readonly activeSection = computed<EditorSection | null>(() => {
    const index = this.activeSectionIndex();
    return index === null ? null : this.sections()[index] ?? null;
  });

  readonly cards = computed<SectionCard[]>(() => this.sections().map((section, index) => {
    let playMedia = 0;
    for (const group of section.groups ?? []) {
      if (drawnPlaceholder(group) !== null) {
        continue;
      }
      playMedia += (group.promptItems ?? []).filter((item) => itemPlaysMedia(item)).length;
    }
    const mode = section.mode ?? null;
    return {
      index,
      name: this.sectionName(section, index),
      mode,
      counts: sectionCounts(section),
      training: section.training === true,
      playMedia,
    };
  }));

  readonly blocks = computed<Block[]>(() => {
    const section = this.activeSection();
    if (section === null) {
      return [];
    }
    const offsets = this.offsets();
    return (section.groups ?? []).map((group, index) => {
      const key = `${this.activeSectionIndex()}.${index}`;
      const placeholder = drawnPlaceholder(group);
      const source = placeholder === null ? null : drawnSource(placeholder);
      if (source === null) {
        return {kind: 'fixed', key, index, items: group.promptItems ?? []} satisfies FixedBlock;
      }
      const bank = this.bankViewFor(source);
      const match = bank === null ? null : queryBank(bank, source.filter ?? {}).matchCount;
      return {
        kind: 'drawn',
        key,
        index,
        source,
        bank,
        match,
        example: exampleDraw(bank, source, offsets[key] ?? 0),
      } satisfies DrawnBlock;
    });
  });

  sectionName(section: EditorSection, index: number): string {
    return typeof section.name === 'string' && section.name.trim() !== ''
      ? section.name
      : fillTemplate(S.outline.sectionLabel, {n: index + 1});
  }

  sectionMode(section: EditorSection): Mode | null {
    return section.mode ?? null;
  }

  modeLabel(mode: Mode | null): string {
    return mode === null ? '' : S.centre.modeChip[mode];
  }

  modeHelp(mode: Mode | null): string {
    return mode === null ? '' : S.inspector.section.modeHelp[mode];
  }

  phaseLabel(phase: PromptPhase | undefined): string {
    return phase === undefined ? '' : S.centre.promptPhaseChip[phase];
  }

  countsText(counts: SectionCounts): string {
    return fillTemplate(S.centre.counts, {fixed: counts.fixed, drawn: counts.drawn});
  }

  playMediaText(count: number): string {
    return fillTemplate(S.centre.playsMediaFlag, {count});
  }

  promptText(item: PromptItem): string {
    const mediaitem = item.mediaitems?.[0];
    return mediaitem === undefined ? '' : MediaitemUtil.toPlainTextString(mediaitem) ?? '';
  }

  kindLabel(item: PromptItem): string {
    return item.type === 'nonrecording' ? S.centre.kindNonRecording : S.centre.kindRecording;
  }

  mediaLabel(item: PromptItem): string {
    if (itemPlaysMedia(item)) {
      const plan = item.playback;
      return plan?.when === 'ONDEMAND' ? S.centre.mediaPlaysOnDemand : S.centre.mediaPlaysFirst;
    }
    return S.centre.mediaText;
  }

  timingText(item: PromptItem): string {
    const timing = effectiveTiming(item);
    return fillTemplate(S.centre.timingSentence, {
      pre: timing.preDelay,
      rec: timing.recDuration === null ? S.centre.recUnbounded : `${timing.recDuration} ms`,
      post: timing.postDelay,
    });
  }

  itemWarnings(path: string): number {
    return findingsUnder(this.findings(), path).length;
  }

  itemPath(groupIndex: number, itemIndex: number): string {
    return `sections[${this.activeSectionIndex()}].groups[${groupIndex}].promptItems[${itemIndex}]`;
  }

  groupPath(groupIndex: number): string {
    return `sections[${this.activeSectionIndex()}].groups[${groupIndex}]`;
  }

  itemSelection(groupIndex: number, itemIndex: number): Selection {
    return {kind: 'item', section: this.activeSectionIndex() ?? 0, group: groupIndex, item: itemIndex};
  }

  isActive(selection: Selection): boolean {
    return selectionEquals(selection, this.selection());
  }

  isActiveGroup(groupIndex: number): boolean {
    const current = this.selection();
    return (current.kind === 'group' || current.kind === 'item') && current.group === groupIndex;
  }

  isActiveItem(groupIndex: number, itemIndex: number): boolean {
    const current = this.selection();
    return current.kind === 'item' && current.group === groupIndex && current.item === itemIndex;
  }

  chooseSection(index: number): void {
    this.select.emit({kind: 'section', section: index});
  }

  chooseItem(groupIndex: number, itemIndex: number): void {
    this.select.emit({kind: 'item', section: this.activeSectionIndex() ?? 0, group: groupIndex, item: itemIndex});
  }

  /** Enabled in M2: it only reshuffles the local example, never the draft. */
  redraw(key: string): void {
    this.offsets.update((offsets) => ({...offsets, [key]: (offsets[key] ?? 0) + 1}));
  }

  cardSelect(index: number): string {
    return fillTemplate(S.centre.cardSelect, {n: index + 1});
  }

  /** The `:groupRef` of the bank screen route. */
  groupRef(groupIndex: number): string {
    return `${this.activeSectionIndex()}.${groupIndex}`;
  }

  reservedRange(source: PrefillBankSource): string {
    const codes = previewCodes(source.itemcodePrefix ?? '', Number(source.count) || 0);
    return codes.length === 0
      ? ''
      : fillTemplate(S.centre.reservedCodes, {first: codes[0], last: codes[codes.length - 1]});
  }

  bankTitle(block: DrawnBlock): string {
    return block.bank?.title ?? block.source.bank ?? S.centre.drawnUnknownBank;
  }

  bankOrigin(source: PrefillBankSource): string {
    return source.bankSource === 'PROJECT' ? S.centre.bankOriginProject : S.centre.bankOriginBuiltin;
  }

  perSessionSentence(source: PrefillBankSource): string {
    switch (source.fixedBy ?? 'SESSION') {
      case 'SPEAKER':
        return S.centre.perSpeaker;
      case 'SCRIPT':
        return S.centre.perScript;
      default:
        return S.centre.perSession;
    }
  }

  matchText(block: DrawnBlock): string {
    if (block.match === null) {
      return S.centre.matchCountUnknown;
    }
    const total = this.bankList().find((bank) => bank.bankId === block.source.bank)?.itemCount ?? block.match;
    return fillTemplate(S.centre.matchCount, {match: block.match, total});
  }

  hasGroupWarning(groupIndex: number): boolean {
    return hasWarning(this.findings(), this.groupPath(groupIndex));
  }

  private bankViewFor(source: PrefillBankSource): BankView | null {
    return this.bankViews().get(source.bank) ?? null;
  }
}
