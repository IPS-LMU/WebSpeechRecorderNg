/**
 * Draft state and write protocol for one script (plan M3, `E3 draft service`; decisions D-C, D-N,
 * D2 in implementation-plan.md §2, protocol in rest-api.md §2.3).
 *
 * The service owns the operator's draft: the parsed model the screens edit, whole-draft undo/redo
 * snapshots (D-C), the per-save-window edit intent used to re-apply a structural edit after a 412,
 * the 2 s debounce / blur flush / single-flight save, the local backup of unacked changes (D-N) and
 * the rule that invalid JSON text is never PUT (D2). It talks to the receiver through the
 * `readDraft`/`writeDraft` methods on `ScriptApiService`; this service makes no HTTP calls itself.
 *
 * Public surface for a UI slice:
 * - state: `model`, `text`, `sourceText`, `dirty`, `saving`, `writesDisabled`, `conflict`,
 *   `lastSaved`, `lastError`, `etag`, `canUndo`, `canRedo`;
 * - lifecycle: `load(projectId, scriptId)`, `reload()`;
 * - editing: `setValue/insert/remove/move(focus, path, …)` (each records an edit intent; `focus`
 *   is the field key that coalesces an undo snapshot) and `setText(text)` for the source view;
 * - history: `undo()`, `redo()`, `snapshot()`;
 * - saving: `flush()` (call on blur and route-leave), `save()`, `resolveConflict(choice)`.
 *
 * The few user-visible strings live here as `DRAFT_STRINGS` (checked with the parent: E1 owns
 * `editor-strings.ts`, so the draft service keeps its own small set rather than appending there).
 */
import {HttpErrorResponse} from '@angular/common/http';
import {computed, inject, Injectable, signal} from '@angular/core';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {firstValueFrom} from 'rxjs';
import {loadScript} from './load';
import {ScriptApiService} from './script-api.service';
import type {EditorScript} from './script.model';
import {parseJsonSource, serialiseJson} from './validation';

/** The draft-service strings (see the file header: kept local, not appended to `editor-strings.ts`). */
export const DRAFT_STRINGS = {
  conflict: 'The draft changed on the server while you were editing.',
  saveFailed: 'The draft could not be saved.',
  filesMode: 'This deployment serves the fixtures read-only (FILES mode): changes stay local and are never saved.',
} as const;

/** A JSON path into the draft, e.g. `['sections', 0, 'groups']`. */
export type DraftPath = ReadonlyArray<string | number>;

/** Both sides of a 412, kept so the operator can choose (rest-api.md §2.3). */
export interface DraftConflict {
  /** The editor's draft text at the moment the conflict was detected. */
  localText: string;
  /** The server's current draft, serialised for display/diff. */
  remoteText: string;
  /** The server's validator, used to retry once the operator has chosen. */
  remoteEtag: string;
  /** The server's parsed draft, adopted by `resolveConflict('remote')`. */
  remote: EditorScript | null;
}

export type ConflictChoice = 'local' | 'remote';

interface ArrayGuard {
  /** The array's length when the op was recorded; a different length means the structure moved. */
  length: number;
}

interface ValueGuard {
  /** The value at the path when the op was recorded. */
  previous: unknown;
}

/**
 * One structural or textual edit made in a save window. Re-applied in order over `details.current`
 * after a 412; each op carries the index/identity guard that says whether that is still safe (D-C).
 */
type IntentOp =
  | {op: 'add'; path: DraftPath; index: number; value: unknown; guard: ArrayGuard}
  | {op: 'remove'; path: DraftPath; index: number; item: unknown; guard: ArrayGuard}
  | {op: 'move'; path: DraftPath; from: number; to: number; item: unknown; guard: ArrayGuard}
  | {op: 'replace'; path: DraftPath; value: unknown; guard: ValueGuard}
  | {op: 'replaceDocument'};

interface DraftErrorEnvelope {
  error?: string;
  message?: string;
  code?: string;
  details?: {current?: unknown; currentEtag?: string};
}

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 2000;
const BACKUP_PREFIX = 'spr-script-draft';

function readPath(root: unknown, path: DraftPath): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (cursor === null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string | number, unknown>)[key];
  }
  return cursor;
}

function writePath(root: unknown, path: DraftPath, value: unknown): void {
  if (path.length === 0) {
    return;
  }
  const parent = readPath(root, path.slice(0, -1));
  if (parent === null || typeof parent !== 'object') {
    return;
  }
  (parent as Record<string | number, unknown>)[path[path.length - 1]] = value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return serialiseJson(a, {indent: '', sortKeys: true}) === serialiseJson(b, {indent: '', sortKeys: true});
}

/** The bytes to PUT for a model: the editor's `_shuffled*` mirrors are stripped, key order kept. */
function draftTextOf(model: EditorScript): string {
  const copy = structuredClone(model) as EditorScript;
  for (const section of copy.sections ?? []) {
    delete (section as Record<string, unknown>)['_shuffledGroups'];
    for (const group of section.groups ?? []) {
      delete (group as Record<string, unknown>)['_shuffledPromptItems'];
    }
  }
  return serialiseJson(copy, {sortKeys: false, indent: '  '});
}

interface IntentOutcome {
  ok: boolean;
  value?: unknown;
  reason?: string;
}

/**
 * Re-applies the intent over the server's current draft. Every op is index-guarded: a container of
 * the wrong length, or an item that is no longer where it was, fails the whole reapply so the
 * service goes to the conflict state instead of guessing (D-C, risk D1).
 */
function applyIntent(doc: unknown, ops: ReadonlyArray<IntentOp>): IntentOutcome {
  const working = structuredClone(doc);
  for (const op of ops) {
    if (op.op === 'replaceDocument') {
      return {ok: false, reason: 'a whole-document edit cannot be merged'};
    }
    if (op.op === 'replace') {
      if (!deepEqual(readPath(working, op.path), op.guard.previous)) {
        return {ok: false, reason: 'the value changed'};
      }
      writePath(working, op.path, structuredClone(op.value));
      continue;
    }
    const container = readPath(working, op.path);
    if (!Array.isArray(container)) {
      return {ok: false, reason: 'the target is no longer an array'};
    }
    if (container.length !== op.guard.length) {
      return {ok: false, reason: 'the array changed size'};
    }
    if (op.op === 'add') {
      container.splice(op.index, 0, structuredClone(op.value));
    } else if (op.op === 'remove') {
      if (!deepEqual(container[op.index], op.item)) {
        return {ok: false, reason: 'the item moved'};
      }
      container.splice(op.index, 1);
    } else {
      if (!deepEqual(container[op.from], op.item)) {
        return {ok: false, reason: 'the item moved'};
      }
      const [moved] = container.splice(op.from, 1);
      container.splice(op.to, 0, moved);
    }
  }
  return {ok: true, value: working};
}

@Injectable({providedIn: 'root'})
export class ScriptDraftService {
  private readonly api = inject(ScriptApiService);
  private readonly config = inject(SPEECHRECORDER_CONFIG, {optional: true});
  private readonly storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage;

  private projectId: string | null = null;
  private scriptId: string | null = null;

  private rawModel: EditorScript | null = null;
  private readonly modelVersion = signal(0);
  private readonly validTextSignal = signal('');
  private readonly sourceTextSignal = signal('');
  private readonly ackedTextSignal = signal('');
  private readonly etagSignal = signal<string | null>(null);
  private readonly savingSignal = signal(false);
  private readonly conflictSignal = signal<DraftConflict | null>(null);
  private readonly writesDisabledSignal = signal(false);

  private undoStack: EditorScript[] = [];
  private redoStack: EditorScript[] = [];
  private readonly historyVersion = signal(0);
  private currentFocus: string | null = null;
  private intent: IntentOp[] = [];
  private intentIncomplete = false;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private queued = false;

  /** The parsed draft the screens edit (with `_shuffled*` filled by `loadScript`). */
  readonly model = computed<EditorScript | null>(() => {
    this.modelVersion();
    return this.rawModel;
  });

  /** The last valid JSON text — exactly what a write will send (D2). */
  readonly text = this.validTextSignal.asReadonly();
  /** The operator's text, which can be invalid JSON; the source view shows this. */
  readonly sourceText = this.sourceTextSignal.asReadonly();
  readonly etag = this.etagSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly conflict = this.conflictSignal.asReadonly();
  readonly lastSaved = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly writesDisabled = this.writesDisabledSignal.asReadonly();

  readonly dirty = computed(() =>
    this.validTextSignal() !== this.ackedTextSignal() || this.sourceTextSignal() !== this.validTextSignal());

  readonly canUndo = computed(() => {
    this.historyVersion();
    return this.undoStack.length > 0;
  });
  readonly canRedo = computed(() => {
    this.historyVersion();
    return this.redoStack.length > 0;
  });

  constructor() {
    this.writesDisabledSignal.set(this.config?.apiType === ApiType.FILES);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', (event) => {
        if (this.dirty()) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
    }
  }

  /** Loads the draft and its validator, then restores any unacked local backup (D-N). */
  async load(projectId: string | number, scriptId: string | number): Promise<void> {
    this.projectId = String(projectId);
    this.scriptId = String(scriptId);
    this.lastError.set(null);
    const read = await firstValueFrom(this.api.readDraft(this.projectId, this.scriptId));
    this.applyServerRead(read.text, read.etag);
    this.restoreBackup();
    if (!this.dirty()) {
      this.clearBackup();
    }
    this.lastSaved.set(new Date().toISOString());
  }

  /** Re-fetches the draft, discarding local edits (the operator's explicit "use the server copy"). */
  async reload(): Promise<void> {
    if (this.projectId === null || this.scriptId === null) {
      return;
    }
    const read = await firstValueFrom(this.api.readDraft(this.projectId, this.scriptId));
    this.applyServerRead(read.text, read.etag);
    if (!this.dirty()) {
      this.clearBackup();
    }
  }

  /** Replaces the value at `path`; `focus` coalesces the undo snapshot per edited field. */
  setValue(focus: string, path: DraftPath, value: unknown): void {
    this.mutate(focus, (model) => {
      const guard: ValueGuard = {previous: structuredClone(readPath(model, path))};
      writePath(model, path, value);
      return {op: 'replace', path, value: structuredClone(value), guard};
    });
  }

  /** Inserts `value` at `index` of the array at `path`. */
  insert(focus: string, path: DraftPath, index: number, value: unknown): void {
    this.mutate(focus, (model) => {
      const container = readPath(model, path);
      if (!Array.isArray(container)) {
        return null;
      }
      const guard: ArrayGuard = {length: container.length};
      container.splice(index, 0, structuredClone(value));
      return {op: 'add', path, index, value: structuredClone(value), guard};
    });
  }

  /** Removes the element at `index` of the array at `path`. */
  remove(focus: string, path: DraftPath, index: number): void {
    this.mutate(focus, (model) => {
      const container = readPath(model, path);
      if (!Array.isArray(container)) {
        return null;
      }
      const guard: ArrayGuard = {length: container.length};
      const item = structuredClone(container[index]);
      container.splice(index, 1);
      return {op: 'remove', path, index, item, guard};
    });
  }

  /** Moves the element at `from` to `to` within the array at `path`. */
  move(focus: string, path: DraftPath, from: number, to: number): void {
    this.mutate(focus, (model) => {
      const container = readPath(model, path);
      if (!Array.isArray(container)) {
        return null;
      }
      const guard: ArrayGuard = {length: container.length};
      const item = structuredClone(container[from]);
      const [moved] = container.splice(from, 1);
      container.splice(to, 0, moved);
      return {op: 'move', path, from, to, item, guard};
    });
  }

  /**
   * Sets the operator's text (the source view). Valid JSON object text becomes the draft and the
   * bytes to PUT; invalid text is kept as the operator's source and in the local backup, while the
   * last valid model stays the write candidate (D2).
   */
  setText(text: string): void {
    this.touch('source');
    this.sourceTextSignal.set(text);
    const parsed = parseJsonSource(text);
    const value = parsed.value;
    if (parsed.ok && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      this.rawModel = loadScript(value as EditorScript);
      this.validTextSignal.set(text);
      this.intent = [{op: 'replaceDocument'}];
      this.intentIncomplete = true;
      this.modelVersion.update((version) => version + 1);
    } else {
      this.intentIncomplete = true;
    }
    this.persistBackup();
    this.scheduleSave();
  }

  /** Pushes an explicit undo checkpoint of the current draft. */
  snapshot(): void {
    if (this.rawModel === null) {
      return;
    }
    this.pushUndo(this.rawModel);
    this.redoStack = [];
    this.historyVersion.update((version) => version + 1);
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (previous === undefined || this.rawModel === null) {
      return false;
    }
    this.redoStack.push(structuredClone(this.rawModel));
    this.adoptModel(previous);
    this.intentIncomplete = true;
    this.currentFocus = null;
    this.historyVersion.update((version) => version + 1);
    this.scheduleSave();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (next === undefined) {
      return false;
    }
    if (this.rawModel !== null) {
      this.undoStack.push(structuredClone(this.rawModel));
    }
    this.adoptModel(next);
    this.intentIncomplete = true;
    this.currentFocus = null;
    this.historyVersion.update((version) => version + 1);
    this.scheduleSave();
    return true;
  }

  /** Cancels the debounce and writes now (call on blur and on route-leave). */
  flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.save();
  }

  /** Saves the last valid model. Single-flight: further calls coalesce into one follow-up write. */
  save(): Promise<void> {
    if (this.writesDisabledSignal()) {
      return Promise.resolve();
    }
    if (this.inFlight !== null) {
      this.queued = true;
      return this.inFlight;
    }
    const running = this.runSaveLoop().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = running;
    return running;
  }

  /**
   * Resolves a 412 conflict: `'local'` retries the write against the server's validator, `'remote'`
   * adopts the server's draft and discards the local text.
   */
  async resolveConflict(choice: ConflictChoice): Promise<void> {
    const conflict = this.conflictSignal();
    if (conflict === null) {
      return;
    }
    if (choice === 'remote') {
      this.adoptModel(conflict.remote);
      this.ackedTextSignal.set(this.validTextSignal());
      this.etagSignal.set(conflict.remoteEtag);
      this.conflictSignal.set(null);
      this.intent = [];
      this.intentIncomplete = false;
      if (!this.dirty()) {
        this.clearBackup();
      }
      return;
    }
    const projectId = this.projectId;
    const scriptId = this.scriptId;
    this.conflictSignal.set(null);
    this.intentIncomplete = true;
    if (projectId === null || scriptId === null) {
      return;
    }
    const outgoing = this.validTextSignal();
    try {
      const result = await firstValueFrom(this.api.writeDraft(projectId, scriptId, outgoing, conflict.remoteEtag));
      this.onAck(outgoing, result.etag);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 412) {
        this.enterConflict(error);
      } else {
        this.lastError.set(DRAFT_STRINGS.saveFailed);
      }
    }
  }

  private mutate(focus: string, edit: (model: EditorScript) => IntentOp | null): void {
    if (this.rawModel === null) {
      return;
    }
    this.touch(focus);
    const op = edit(this.rawModel);
    if (op !== null) {
      this.intent.push(op);
    }
    this.validTextSignal.set(draftTextOf(this.rawModel));
    this.sourceTextSignal.set(this.validTextSignal());
    this.modelVersion.update((version) => version + 1);
    this.persistBackup();
    this.scheduleSave();
  }

  private touch(focus: string): void {
    if (focus !== this.currentFocus) {
      if (this.rawModel !== null) {
        this.pushUndo(this.rawModel);
      }
      this.redoStack = [];
      this.currentFocus = focus;
      this.historyVersion.update((version) => version + 1);
    }
  }

  private pushUndo(model: EditorScript): void {
    this.undoStack.push(structuredClone(model));
    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.shift();
    }
  }

  private adoptModel(model: EditorScript | null): void {
    this.rawModel = model;
    const text = model === null ? '' : draftTextOf(model);
    this.validTextSignal.set(text);
    this.sourceTextSignal.set(text);
    this.modelVersion.update((version) => version + 1);
  }

  private applyServerRead(text: string, etag: string | null): void {
    const parsed = parseJsonSource(text);
    const value = parsed.value;
    this.etagSignal.set(etag);
    this.conflictSignal.set(null);
    this.intent = [];
    this.intentIncomplete = false;
    this.undoStack = [];
    this.redoStack = [];
    this.currentFocus = null;
    this.historyVersion.update((version) => version + 1);
    if (parsed.ok && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      this.rawModel = loadScript(value as EditorScript);
      this.validTextSignal.set(text);
      this.sourceTextSignal.set(text);
      this.ackedTextSignal.set(text);
    } else {
      this.rawModel = null;
      this.validTextSignal.set('');
      this.sourceTextSignal.set(text);
      this.ackedTextSignal.set('');
    }
    this.modelVersion.update((version) => version + 1);
  }

  private scheduleSave(): void {
    if (this.writesDisabledSignal()) {
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, DEBOUNCE_MS);
  }

  private async runSaveLoop(): Promise<void> {
    do {
      this.queued = false;
      await this.attemptSave();
    } while (this.queued && !this.writesDisabledSignal() && this.conflictSignal() === null);
  }

  private async attemptSave(): Promise<void> {
    const projectId = this.projectId;
    const scriptId = this.scriptId;
    if (projectId === null || scriptId === null || this.rawModel === null) {
      return;
    }
    if (this.validTextSignal() === '' || this.conflictSignal() !== null) {
      return;
    }
    this.savingSignal.set(true);
    this.lastError.set(null);
    try {
      let reloadRetried = false;
      let reapplied = false;
      for (;;) {
        const outgoing = this.validTextSignal();
        try {
          const result = await firstValueFrom(this.api.writeDraft(projectId, scriptId, outgoing, this.etagSignal()));
          this.onAck(outgoing, result.etag);
          return;
        } catch (error) {
          if (!(error instanceof HttpErrorResponse)) {
            this.lastError.set(DRAFT_STRINGS.saveFailed);
            return;
          }
          if (error.status === 428 && !reloadRetried) {
            reloadRetried = true;
            await this.reloadForRetry();
            continue;
          }
          if (error.status === 412 && !reapplied) {
            reapplied = true;
            if (this.reapplyConflict(error)) {
              continue;
            }
            this.enterConflict(error);
            return;
          }
          if (error.status === 412) {
            this.enterConflict(error);
            return;
          }
          this.lastError.set(this.messageOf(error));
          return;
        }
      }
    } finally {
      this.savingSignal.set(false);
    }
  }

  private async reloadForRetry(): Promise<void> {
    if (this.projectId === null || this.scriptId === null) {
      return;
    }
    try {
      const read = await firstValueFrom(this.api.readDraft(this.projectId, this.scriptId));
      this.etagSignal.set(read.etag);
    } catch {
      this.lastError.set(DRAFT_STRINGS.saveFailed);
    }
  }

  /** Re-applies the recorded intent over `details.current`; false means the guards failed. */
  private reapplyConflict(error: HttpErrorResponse): boolean {
    if (this.intentIncomplete || this.intent.length === 0) {
      return false;
    }
    const details = (error.error as DraftErrorEnvelope | undefined)?.details;
    const current = details?.current;
    if (current === null || current === undefined || typeof current !== 'object' || Array.isArray(current)) {
      return false;
    }
    const outcome = applyIntent(current, this.intent);
    if (!outcome.ok) {
      return false;
    }
    const merged = loadScript(outcome.value as EditorScript);
    this.rawModel = merged;
    this.validTextSignal.set(draftTextOf(merged));
    this.sourceTextSignal.set(this.validTextSignal());
    this.modelVersion.update((version) => version + 1);
    if (details?.currentEtag !== undefined) {
      this.etagSignal.set(details.currentEtag);
    }
    return true;
  }

  private enterConflict(error: HttpErrorResponse): void {
    const envelope = error.error as DraftErrorEnvelope | undefined;
    const details = envelope?.details;
    const current = details?.current;
    const rawRemote = current !== null && current !== undefined && typeof current === 'object' && !Array.isArray(current)
      ? current as EditorScript
      : null;
    this.conflictSignal.set({
      localText: this.validTextSignal(),
      remoteText: rawRemote === null ? '' : serialiseJson(rawRemote, {sortKeys: false, indent: '  '}),
      remoteEtag: details?.currentEtag ?? this.etagSignal() ?? '',
      remote: rawRemote === null ? null : loadScript(rawRemote),
    });
    this.lastError.set(envelope?.message ?? DRAFT_STRINGS.conflict);
  }

  private onAck(sentText: string, etag: string): void {
    this.etagSignal.set(etag);
    this.ackedTextSignal.set(sentText);
    this.lastSaved.set(new Date().toISOString());
    if (sentText === this.validTextSignal()) {
      this.intent = [];
      this.intentIncomplete = false;
    }
    if (!this.dirty()) {
      this.clearBackup();
    }
  }

  private messageOf(error: HttpErrorResponse): string {
    const envelope = error.error as DraftErrorEnvelope | undefined;
    return envelope?.message ?? envelope?.error ?? DRAFT_STRINGS.saveFailed;
  }

  private restoreBackup(): void {
    const record = this.readBackup();
    if (record !== null) {
      this.setText(record.text);
    }
  }

  private backupKey(): string {
    return `${BACKUP_PREFIX}:${this.projectId}:${this.scriptId}`;
  }

  private readBackup(): {text: string} | null {
    if (this.storage === null) {
      return null;
    }
    try {
      const raw = this.storage.getItem(this.backupKey());
      if (raw === null) {
        return null;
      }
      const value = JSON.parse(raw) as {text?: unknown};
      return typeof value?.text === 'string' ? {text: value.text} : null;
    } catch {
      return null;
    }
  }

  private persistBackup(): void {
    if (this.storage === null || this.projectId === null || this.scriptId === null) {
      return;
    }
    try {
      this.storage.setItem(this.backupKey(), JSON.stringify({text: this.sourceTextSignal()}));
    } catch {
      // A full or disabled storage must not break editing.
    }
  }

  private clearBackup(): void {
    if (this.storage === null || this.projectId === null || this.scriptId === null) {
      return;
    }
    try {
      this.storage.removeItem(this.backupKey());
    } catch {
      // Ignore.
    }
  }
}
