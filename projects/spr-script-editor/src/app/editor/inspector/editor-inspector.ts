import {NgTemplateOutlet} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, inject, input, output, signal} from '@angular/core';
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
  type Playback,
  type PlaybackWhen,
  type PrefillBankSource,
  type PromptItem,
  type PromptPhase,
} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../../core/editor-strings';
import {EDITOR_STRINGS_EXT} from '../editor-strings-ext';
import {PREFILL_STRINGS} from './prefill-strings';
import {fillTemplate} from '../../core/validation/interpolate';
import {findingsUnder, type BankView, type Finding} from '../../core/validation';
import {queryBank} from '../../core/validation/filter';
import {isObject} from '../../core/validation/walk';
import type {EditorGroup, EditorScript, EditorSection, MediaEntry} from '../../core/script.model';
import type {ScriptVersion} from '../../core/script-api.service';
import {ScriptDraftService, type DraftPath} from '../../core/script-draft.service';
import {MediaService, type MediaUploadResult} from '../../core/media.service';
import {drawnSource, isDrawnGroup} from '../markers';
import {drawnFilterWords} from '../drawn-filter';
import {previewCodes} from '../example-draw';
import type {Selection} from '../selection';
import {formatSelection, selectionPath} from '../selection';
import {EditorTimeline} from '../timeline/editor-timeline';
import {
  PROMPT_MEDIA_KINDS,
  audioMediaIndex,
  bankPlaceholder,
  defaultBankSource,
  fixedItemsFromDrawn,
  itemcodeFindings,
  listCodePreview,
  prefillKindOf,
  promptDocFromText,
  promptMediaIndex,
  setPromptMediaKind,
  splitGroupItems,
  withAudioMedia,
  withInstructions,
  withPlayback,
  type PromptMediaKind,
} from './item-edits';

const S = EDITOR_STRINGS;
const X = EDITOR_STRINGS_EXT;

/**
 * The inspector column (ui-spec §3.3). Four variants — script, section, group, prompt item — whose
 * fields map one to one onto the model. Every edit goes through `ScriptDraftService` under a
 * per-field `focus` key, so undo/redo coalesces per field and autosave, dirty state and the 412
 * reapply see the same guarded operations as the source view. The controls are disabled only when
 * the deployment itself refuses writes (FILES mode); the playback and timing blocks are rendered
 * from the library's rules.
 */
@Component({
  selector: 'spr-editor-inspector',
  imports: [RouterLink, EditorTimeline, NgTemplateOutlet],
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
  readonly versions = input<ReadonlyArray<ScriptVersion>>([]);
  readonly versionSessions = input<ReadonlyMap<number, number>>(new Map());

  readonly restoreVersion = output<number>();

  /**
   * `_restore` replaces the draft and the draft service takes no snapshot for it, so undo cannot bring
   * the replaced draft back — ui-spec §1's "asks first when it is not" applies, and the button asks.
   */
  requestRestore(version: number): void {
    if (this.confirming() !== `version:${version}`) {
      this.confirming.set(`version:${version}`);
      return;
    }
    this.confirming.set(null);
    this.restoreVersion.emit(version);
  }

  /** Clears a pending confirmation; every destructive control reading `confirming` returns to rest. */
  cancelConfirm(): void {
    this.confirming.set(null);
  }
  readonly bankRequested = output<string>();
  readonly mediaChanged = output<void>();

  private readonly draft = inject(ScriptDraftService);
  private readonly mediaApi = inject(MediaService);

  readonly strings = S;
  readonly ext = X;
  readonly prefillStrings = PREFILL_STRINGS;
  readonly validation = S.validation;
  readonly promptMediaKinds = PROMPT_MEDIA_KINDS;
  readonly modes: ReadonlyArray<Mode> = ['MANUAL', 'AUTOPROGRESS', 'AUTORECORDING'];
  readonly orders: ReadonlyArray<Order> = ['SEQUENTIAL', 'RANDOM'];
  readonly playbackWhens: ReadonlyArray<PlaybackWhen> = ['WITH_PROMPT', 'BEFORE', 'PRERECORDING', 'DURING', 'ONDEMAND'];
  readonly promptPhases: ReadonlyArray<PromptPhase> = ['IDLE', 'PRERECORDING', 'PRERECORDINGONLY', 'RECORDING'];
  readonly fixedBys: ReadonlyArray<'SESSION' | 'SPEAKER' | 'SCRIPT'> = ['SESSION', 'SPEAKER', 'SCRIPT'];

  /** FILES-mode deployments never save; every control is then disabled with the note below. */
  readonly writesDisabled = computed(() => this.draft.writesDisabled());

  readonly uploadError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  /** Which destructive action is asking first: ui-spec §1 wants undo, or a question when undo cannot help. */
  readonly confirming = signal<string | null>(null);

  private readonly sectionIndex = computed<number | null>(() => {
    const selection = this.selection();
    return selection.kind === 'script' ? null : selection.section;
  });

  private readonly groupIndex = computed<number | null>(() => {
    const selection = this.selection();
    return selection.kind === 'group' || selection.kind === 'item' ? selection.group : null;
  });

  private readonly itemIndex = computed<number | null>(() => {
    const selection = this.selection();
    return selection.kind === 'item' ? selection.item : null;
  });

  readonly section = computed<EditorSection | null>(() => {
    const index = this.sectionIndex();
    return index === null ? null : this.script()?.sections?.[index] ?? null;
  });

  readonly group = computed<EditorGroup | null>(() => {
    const index = this.groupIndex();
    return index === null ? null : this.section()?.groups?.[index] ?? null;
  });

  readonly item = computed<PromptItem | null>(() => {
    const index = this.itemIndex();
    return index === null ? null : this.group()?.promptItems?.[index] ?? null;
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

  /** The index of the drawn placeholder inside the group, i.e. where writes to the rule land. */
  readonly placeholderIndex = computed<number | null>(() => {
    const items = this.group()?.promptItems ?? [];
    const index = items.findIndex((candidate) => drawnSource(candidate) !== null);
    return index === -1 ? null : index;
  });

  /**
   * The selected item read from the script input directly. The nested object identity is shared
   * with the draft (`model()` is a shallow copy), so a computed that cached on `item()` alone would
   * not notice an edit that replaces a property in place — reading `script()` here every time keeps
   * the prefill picker in step with the draft.
   */
  private scriptItem(selection: Selection): PromptItem | null {
    if (selection.kind !== 'item') {
      return null;
    }
    return this.script()?.sections?.[selection.section]?.groups?.[selection.group]?.promptItems?.[selection.item] ?? null;
  }

  /** The selected item's own prefill, if any (D-W: at most one of `source`/`bank`). */
  readonly itemPrefill = computed(() => this.scriptItem(this.selection())?.prefill ?? null);

  /** The selected item's bank source, when it draws from a bank. */
  readonly itemBank = computed<PrefillBankSource | null>(() => this.scriptItem(this.selection())?.prefill?.bank ?? null);

  /** The bank source the item variant edits: the item's own, always. */
  readonly activeBank = computed<PrefillBankSource | null>(() =>
    (this.selection().kind === 'item' ? this.itemBank() : this.drawn()));

  /**
   * The list flavour the picker shows when a list is chosen. The model cannot record word vs
   * sentence — both are the shipped `prefill.source` shape — so this is UI state keyed to the
   * selection, defaulting to the word list.
   */
  private readonly listFlavour = signal<{key: string; value: 'word' | 'sentence'} | null>(null);

  /** The picker's current case: the model's list/bank/none, with the UI-only list flavour folded in. */
  readonly prefillSelection = computed<'none' | 'word' | 'sentence' | 'bank'>(() => {
    const kind = prefillKindOf(this.scriptItem(this.selection()));
    if (kind === 'bank') {
      return 'bank';
    }
    if (kind === 'none') {
      return 'none';
    }
    const flavour = this.listFlavour();
    return flavour !== null && flavour.key === selectionPath(this.selection()) ? flavour.value : 'word';
  });

  readonly bankView = computed<BankView | null>(() => {
    const bankId = this.activeBank()?.bank;
    return bankId === undefined || bankId === '' ? null : this.bankViews().get(bankId) ?? null;
  });

  readonly matchCount = computed<number | null>(() => {
    const view = this.bankView();
    const source = this.activeBank();
    return view === null || source === null ? null : queryBank(view, source.filter ?? {}).matchCount;
  });

  readonly applicableFindings = computed(() => findingsUnder(this.findings(), selectionPath(this.selection())));

  readonly bankTotal = computed<number | null>(() => {
    const bankId = this.activeBank()?.bank;
    const bank = this.bankList().find((candidate) => candidate.bankId === bankId);
    return bank?.itemCount ?? this.bankView()?.items.length ?? null;
  });

  readonly matchSummary = computed<string | null>(() => {
    const match = this.matchCount();
    const total = this.bankTotal();
    return match === null || total === null ? null : fillTemplate(S.centre.matchCount, {match, total});
  });

  /** E04 live: `count` above the filter's match count, or suspended when the bank cannot be read. */
  readonly countExceeds = computed(() => {
    const match = this.matchCount();
    const count = Number(this.activeBank()?.count);
    return match !== null && Number.isInteger(count) && count > match;
  });

  readonly countSuspended = computed(() => this.activeBank() !== null && this.matchCount() === null);

  readonly countMessage = computed<string | null>(() => {
    const match = this.matchCount();
    if (this.countSuspended()) {
      return X.inspector.group.countSuspended;
    }
    if (this.countExceeds() && match !== null) {
      return fillTemplate(S.validation.e04, {matchCount: match});
    }
    return this.matchSummary() ?? S.inspector.group.countUnknown;
  });

  /** E01/E02/E05 at this item's itemcode, from the model through the pure catalogue checks. */
  readonly itemcodeIssues = computed<ReadonlyArray<Finding>>(() => {
    const selection = this.selection();
    if (selection.kind !== 'item') {
      return [];
    }
    return itemcodeFindings(this.script(), selection.section, selection.group, selection.item);
  });

  readonly itemcodeMessage = computed<string | null>(() => {
    const issues = this.itemcodeIssues();
    return issues.length === 0 ? null : issues.map((issue) => issue.message).join(' ');
  });

  /** The `:groupRef` of the bank screen route, from the shared selection format. */
  groupRef(): string {
    const selection = this.selection();
    return selection.kind === 'group' || selection.kind === 'item'
      ? formatSelection({kind: 'group', section: selection.section, group: selection.group})
      : '';
  }

  readonly itemTiming = computed<EffectiveTiming | null>(() => {
    const item = this.item();
    return item === null ? null : effectiveTiming(item);
  });

  readonly audio = computed<Mediaitem | null>(() => {
    const mediaitems = this.item()?.mediaitems ?? [];
    return mediaitems.find((candidate) => MediaitemUtil.kind(candidate) === 'audio') ?? null;
  });

  readonly audioIndex = computed(() => audioMediaIndex(this.item()?.mediaitems ?? []));

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

  mediaKindLabel(kind: PromptMediaKind): string {
    switch (kind) {
      case 'plain':
        return S.inspector.item.mediaPlain;
      case 'formatted':
        return S.inspector.item.mediaFormatted;
      case 'image':
        return S.inspector.item.mediaImage;
      default:
        return S.inspector.item.mediaNothing;
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

  /** `fixedByHelp` with its default, for the shared bank-rule template (untyped outlet context). */
  fixedByHelp(value: 'SESSION' | 'SPEAKER' | 'SCRIPT' | undefined): string {
    return S.inspector.group.fixedByHelp[value ?? 'SESSION'];
  }

  /** `playback.whenOptions` with its default, for the shared bank-rule template. */
  whenOptionLabel(when: PlaybackWhen | undefined): string {
    return S.inspector.playback.whenOptions[when ?? 'WITH_PROMPT'];
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

  versionSessionsOf(version: number): number {
    return this.versionSessions().get(version) ?? 0;
  }

  mediaLabel(entry: MediaEntry): string {
    return entry.src.split('/').pop() ?? entry.src;
  }

  // ---- draft writes -------------------------------------------------------------------------

  private focusFor(field: string): string {
    const selection = this.selection();
    switch (selection.kind) {
      case 'script':
        return `script.${field}`;
      case 'section':
        return `section.${selection.section}.${field}`;
      case 'group':
        return `group.${selection.section}.${selection.group}.${field}`;
      case 'item':
        return `item.${selection.section}.${selection.group}.${selection.item}.${field}`;
    }
  }

  /** The path of a field relative to the current selection, e.g. `['sections',2,'name']`. */
  private pathFor(...field: ReadonlyArray<string | number>): DraftPath | null {
    const selection = this.selection();
    switch (selection.kind) {
      case 'script':
        return field;
      case 'section':
        return ['sections', selection.section, ...field];
      case 'group':
        return ['sections', selection.section, 'groups', selection.group, ...field];
      case 'item':
        return ['sections', selection.section, 'groups', selection.group, 'promptItems', selection.item, ...field];
    }
  }

  private write(field: string, fieldPath: ReadonlyArray<string | number>, value: unknown): void {
    const path = this.pathFor(...fieldPath);
    if (path === null) {
      return;
    }
    this.draft.setValue(this.focusFor(field), path, value);
  }

  private numberValue(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  // Script variant.

  setScriptName(value: string): void {
    this.write('name', ['name'], value);
  }

  setScriptHeight(raw: string): void {
    const height = this.numberValue(raw);
    const box = this.script()?.virtualViewBox;
    if (box === undefined) {
      this.draft.setValue(this.focusFor('virtualViewBox.height'), ['virtualViewBox'], {height});
      return;
    }
    this.draft.setValue(this.focusFor('virtualViewBox.height'), ['virtualViewBox', 'height'], height);
  }

  // Section variant.

  setSectionName(value: string): void {
    this.write('name', ['name'], value);
  }

  setSectionMode(mode: Mode): void {
    this.write('mode', ['mode'], mode);
  }

  setSectionPromptPhase(phase: PromptPhase): void {
    this.write('promptphase', ['promptphase'], phase);
  }

  setSectionOrder(order: Order): void {
    if (order === 'SEQUENTIAL' || order === 'RANDOM') {
      this.write('order', ['order'], order);
    }
  }

  setSectionTraining(checked: boolean): void {
    this.write('training', ['training'], checked);
  }

  deleteSection(): void {
    const section = this.sectionIndex();
    if (section === null) {
      return;
    }
    this.draft.remove('section.delete', ['sections'], section);
  }

  // Group variant.

  setGroupKind(kind: 'fixed' | 'drawn'): void {
    const group = this.group();
    if (group === null || this.pathFor('promptItems') === null) {
      return;
    }
    if (kind === 'drawn' && !this.isDrawn()) {
      this.write('promptItems', ['promptItems'], [bankPlaceholder(this.bankList())]);
      return;
    }
    if (kind === 'fixed' && this.isDrawn()) {
      this.write('promptItems', ['promptItems'], fixedItemsFromDrawn(group.promptItems ?? []));
    }
  }

  setGroupOrder(order: Order): void {
    this.write('order', ['order'], order);
  }

  /**
   * The item whose `prefill.bank` the bank-rule controls edit: the selected item, or the group's
   * drawn placeholder when the group itself is selected (D-W: the panel is reached from the item).
   */
  private prefillTargetIndex(): number | null {
    const selection = this.selection();
    return selection.kind === 'item' ? selection.item : this.placeholderIndex();
  }

  /** Writes one bank-source field at the active placeholder, whichever variant is selected. */
  private bankWrite(field: string, tail: ReadonlyArray<string | number>, value: unknown): void {
    const section = this.sectionIndex();
    const group = this.groupIndex();
    const target = this.prefillTargetIndex();
    if (section === null || group === null || target === null) {
      return;
    }
    this.draft.setValue(this.focusFor(field),
      ['sections', section, 'groups', group, 'promptItems', target, 'prefill', 'bank', ...tail], value);
  }

  setGroupBank(bankId: string): void {
    this.bankWrite('bank', ['bank'], bankId);
    this.bankRequested.emit(bankId);
  }

  setGroupCount(raw: string): void {
    this.bankWrite('count', ['count'], this.numberValue(raw));
  }

  setGroupFixedBy(value: 'SESSION' | 'SPEAKER' | 'SCRIPT'): void {
    this.bankWrite('fixedBy', ['fixedBy'], value);
  }

  setGroupSkipRecorded(checked: boolean): void {
    this.bankWrite('skipRecordedBySpeaker', ['skipRecordedBySpeaker'], checked);
  }

  setGroupPrefix(value: string): void {
    this.bankWrite('itemcodePrefix', ['itemcodePrefix'], value);
  }

  splitGroup(): void {
    const group = this.group();
    const groupIndex = this.groupIndex();
    const sectionIndex = this.sectionIndex();
    if (group === null || groupIndex === null || sectionIndex === null) {
      return;
    }
    const {first, second} = splitGroupItems(group);
    if (second.length === 0) {
      return;
    }
    this.draft.insert(this.focusFor('split'), ['sections', sectionIndex, 'groups'], groupIndex + 1,
      {order: group.order, promptItems: second});
    this.draft.setValue(this.focusFor('split'), ['sections', sectionIndex, 'groups', groupIndex, 'promptItems'], first);
  }

  deleteGroup(): void {
    const groupIndex = this.groupIndex();
    if (groupIndex === null) {
      return;
    }
    const sectionIndex = this.sectionIndex();
    if (sectionIndex === null) {
      return;
    }
    this.draft.remove('group.delete', ['sections', sectionIndex, 'groups'], groupIndex);
  }

  // Prompt item variant.

  setItemcode(value: string): void {
    this.write('itemcode', ['itemcode'], value);
  }

  setItemType(recording: boolean): void {
    this.write('type', ['type'], recording ? undefined : 'nonrecording');
  }

  setPromptMediaKind(kind: PromptMediaKind): void {
    const items = this.item()?.mediaitems ?? [];
    this.write('media', ['mediaitems'], setPromptMediaKind(items, kind));
  }

  setPromptText(value: string): void {
    if (this.mediaKind(this.item()) === 'formatted') {
      this.write('text', ['mediaitems', 0, 'promptDoc'], promptDocFromText(value));
      return;
    }
    this.write('text', ['mediaitems', 0, 'text'], value);
  }

  setPromptFile(value: string): void {
    this.write('file', ['mediaitems', 0, 'src'], value);
  }

  setPromptAlt(value: string): void {
    this.write('alt', ['mediaitems', 0, 'alt'], value);
  }

  setPromptHeight(raw: string): void {
    const mediaitem = this.item()?.mediaitems?.[0];
    const box = {...(mediaitem?.defaultVirtualViewBox ?? {}), height: this.numberValue(raw)};
    this.write('virtualHeight', ['mediaitems', 0, 'defaultVirtualViewBox'], box);
  }

  setInstructions(value: string): void {
    this.write('instructions', ['recinstructions'], withInstructions(this.item()?.recinstructions, value));
  }

  setPreDelay(raw: string): void {
    this.write('prerecdelay', ['prerecdelay'], this.numberValue(raw));
  }

  setRecDuration(raw: string): void {
    this.write('recduration', ['recduration'], this.numberValue(raw));
  }

  setPostDelay(raw: string): void {
    this.write('postrecdelay', ['postrecdelay'], this.numberValue(raw));
  }

  setDisplayDuration(raw: string): void {
    this.write('duration', ['duration'], this.numberValue(raw));
  }

  // Randomised-items panel (D-W, data-model §2.2).

  /** Switches the prefill source; exactly one of `source`/`bank` survives. */
  setPrefillKind(kind: 'none' | 'word' | 'sentence' | 'bank'): void {
    const item = this.item();
    const path = this.pathFor('prefill');
    if (item === null || path === null) {
      return;
    }
    const focus = this.focusFor('prefill.source');
    if (kind === 'none') {
      this.listFlavour.set(null);
      this.draft.setValue(focus, path, undefined);
      return;
    }
    if (kind === 'bank') {
      this.listFlavour.set(null);
      this.draft.setValue(focus, path, {bank: item.prefill?.bank ?? defaultBankSource(this.bankList())});
      return;
    }
    this.listFlavour.set({key: selectionPath(this.selection()), value: kind});
    this.draft.setValue(focus, path, {
      source: item.prefill?.source ?? '',
      select: 'random',
      itemcodeFormat: item.prefill?.itemcodeFormat ?? '{n}',
    });
  }

  setPrefillSource(value: string): void {
    this.write('prefill.listSource', ['prefill', 'source'], value);
  }

  setPrefillSelect(value: string): void {
    if (value === 'random') {
      this.write('prefill.select', ['prefill', 'select'], value);
    }
  }

  setPrefillItemcodeFormat(value: string): void {
    this.write('prefill.itemcodeFormat', ['prefill', 'itemcodeFormat'], value);
  }

  /** The generated itemcodes of a list `itemcodeFormat`, or `''` when it is empty. */
  prefillFormatPreview(itemcodeFormat: string): string {
    const codes = listCodePreview(itemcodeFormat);
    return codes.length === 0
      ? ''
      : fillTemplate(PREFILL_STRINGS.listPreview, {codes: codes.join(', ')});
  }

  // Playback block.

  addAudio(): void {
    const items = this.item()?.mediaitems ?? [];
    const path = this.pathFor('mediaitems');
    if (path === null) {
      return;
    }
    this.draft.insert(this.focusFor('playback.add'), path, items.length, {mimetype: 'audio/wav'});
  }

  removeAudio(): void {
    const index = this.audioIndex();
    if (index < 0) {
      return;
    }
    const path = this.pathFor('mediaitems');
    if (path === null) {
      return;
    }
    this.draft.remove(this.focusFor('playback.remove'), path, index);
  }

  setAudioSrc(src: string): void {
    if (src === '') {
      return;
    }
    const entry = this.media().find((candidate) => candidate.src === src);
    const mimetype = entry?.mimetype ?? 'audio/wav';
    const index = this.audioIndex();
    if (index < 0) {
      const items = this.item()?.mediaitems ?? [];
      this.write('playback.file', ['mediaitems'], withAudioMedia(items, {src, mimetype}));
      return;
    }
    this.write('playback.file', ['mediaitems', index, 'src'], src);
  }

  setAudioAlt(value: string): void {
    const index = this.audioIndex();
    if (index >= 0) {
      this.write('playback.alt', ['mediaitems', index, 'alt'], value);
    }
  }

  setAudioAutoplay(checked: boolean): void {
    const index = this.audioIndex();
    if (index >= 0) {
      this.write('playback.autoplay', ['mediaitems', index, 'autoplay'], checked);
    }
  }

  setAudioReplay(checked: boolean): void {
    const index = this.audioIndex();
    if (index >= 0) {
      this.write('playback.replay', ['mediaitems', index, 'replay'], checked);
    }
  }

  private writePlayback(field: string, patch: Partial<Playback>): void {
    const item = this.item();
    if (item === null) {
      return;
    }
    this.write(`playback.${field}`, ['playback'], withPlayback(item, patch));
  }

  setPlaybackWhen(when: PlaybackWhen): void {
    this.writePlayback('when', {when});
  }

  setPlaybackRepeats(raw: string): void {
    this.writePlayback('repeats', {repeats: this.numberValue(raw) ?? 1});
  }

  setPlaybackGap(raw: string): void {
    this.writePlayback('gap', {gap: this.numberValue(raw) ?? 0});
  }

  setPlaybackReplayable(checked: boolean): void {
    this.writePlayback('replayable', {replayable: checked});
  }

  setPlaybackMaxReplays(raw: string): void {
    this.writePlayback('maxReplays', {maxReplays: this.numberValue(raw) ?? undefined});
  }

  setPlaybackHeadphones(checked: boolean): void {
    this.writePlayback('headphones', {headphones: checked});
  }

  onAudioUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined || file === null) {
      return;
    }
    this.uploadError.set(null);
    this.mediaApi.upload(this.project(), file, file.name).subscribe({
      next: (result) => void this.attachUploaded(file, result),
      error: () => this.uploadError.set(X.inspector.playback.uploadFailed),
    });
  }

  private async attachUploaded(file: File, result: MediaUploadResult): Promise<void> {
    const item = this.item();
    const items = item?.mediaitems ?? [];
    const mimetype = result.mimetype ?? file.type ?? 'audio/wav';
    const focus = this.focusFor('playback.upload');
    const path = this.pathFor('mediaitems');
    if (path === null) {
      return;
    }
    this.draft.setValue(focus, path, withAudioMedia(items, {src: result.src, mimetype}));
    let duration = typeof result.durationMs === 'number' ? result.durationMs : null;
    if (duration === null) {
      duration = await this.mediaApi.measureDurationMs(file);
    }
    if (duration !== null && item !== null) {
      this.draft.setValue(focus, ['playback'], withPlayback(item, {durationMs: duration}));
    }
    this.mediaChanged.emit();
  }

  deleteMedia(): void {
    const src = this.audio()?.src;
    if (src === undefined || src === '') {
      return;
    }
    // The media service documents deletion as outside the draft's undo stack, so this asks first
    // (ui-spec §1) exactly as the bank's remove does.
    if (this.confirming() !== 'media') {
      this.confirming.set('media');
      return;
    }
    this.confirming.set(null);
    this.deleteError.set(null);
    this.mediaApi.remove(this.project(), src).subscribe({
      next: () => {
        this.deleteError.set(null);
        this.mediaChanged.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.deleteError.set(error.status === 409 ? X.inspector.playback.inUse : X.inspector.playback.deleteFailed);
      },
    });
  }
}
