import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {EditorFindingsService} from '../core/editor-findings.service';
import {AccessService} from '../core/access.service';
import {ScriptApiService} from '../core/script-api.service';
import type {DraftConflict} from '../core/script-draft.service';
import {ScriptDraftService} from '../core/script-draft.service';
import {AppShell} from './app-shell';

/** The shell reads the draft service and the URL; everything else it needs is real. */
class FakeDraft {
  readonly model = signal<{name?: string} | null>(null);
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly conflict = signal<DraftConflict | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly etag = signal<string | null>(null);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly writesDisabled = signal(false);
  readonly legacy = signal(false);
  readonly loadedProject = signal<string | null>(null);
  readonly loadedScript = signal<string | null>(null);

  readonly flush = jasmine.createSpy('flush').and.returnValue(Promise.resolve());
  readonly save = jasmine.createSpy('save').and.returnValue(Promise.resolve());
  readonly undo = jasmine.createSpy('undo');
  readonly redo = jasmine.createSpy('redo');
  readonly setValue = jasmine.createSpy('setValue');
  readonly resolveConflict = jasmine.createSpy('resolveConflict').and.returnValue(Promise.resolve());
  readonly load = jasmine.createSpy('load').and.returnValue(Promise.resolve());
}

const ROUTES = [
  {path: 'project/:p/script', component: AppShell},
  {path: 'project/:p/script/:id/edit', component: AppShell},
  {path: 'project/:p/script/:id/source', component: AppShell},
];

interface Harness {
  harness: RouterTestingHarness;
  root: HTMLElement;
  draft: FakeDraft;
  findings: EditorFindingsService;
  http: HttpTestingController;
}

async function setup(url: string): Promise<Harness> {
  const draft = new FakeDraft();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES),
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: '', apiType: ApiType.NORMAL, apiVersion: 1}},
      {provide: ScriptDraftService, useValue: draft},
      ScriptApiService,
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return {
    harness,
    root: harness.routeNativeElement as HTMLElement,
    draft,
    findings: TestBed.inject(EditorFindingsService),
    http: TestBed.inject(HttpTestingController),
  };
}

/** Mounts the shell on the editor route with a loaded draft, ready to publish. */
async function setupEditor(): Promise<Harness> {
  const state = await setup('/project/Demo1/script/1245/edit');
  state.draft.loadedScript.set('1245');
  state.draft.model.set({name: 'Test1'});
  state.draft.etag.set('"A"');
  state.harness.detectChanges();
  return state;
}

async function settle(state: Harness): Promise<void> {
  await state.harness.fixture.whenStable();
  state.harness.detectChanges();
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(element).withContext(`the ${label} button exists`).not.toBeNull();
  return element as HTMLButtonElement;
}

const warning = {id: 'W01', severity: 'warning', path: 'sections[0]', message: 'The section has no items.'} as const;
const error = {id: 'E01', severity: 'error', path: 'sections[0]', message: 'The group is empty.'} as const;
const serverCheck = {
  id: 'E02',
  severity: 'error',
  path: 'sections[2].groups[0].promptItems[1].itemcode',
  message: 'Two items share an itemcode.',
} as const;

describe('AppShell', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('blocks Publish while the last change is unsaved, and says why', async () => {
    const state = await setupEditor();
    state.draft.lastError.set('HTTP 500');
    state.harness.detectChanges();

    const publish = state.root.querySelector<HTMLButtonElement>('button[aria-label="Publish"]') as HTMLButtonElement;
    expect(publish.disabled).withContext('an autosave that failed blocks Publish').toBe(true);
    expect(state.root.querySelector('.publish-reason')?.textContent).toContain('could not be saved');
  });

  it('names the legacy read-only reason and offers the source view', async () => {
    const state = await setupEditor();
    state.draft.legacy.set(true);
    state.draft.writesDisabled.set(true);
    state.harness.detectChanges();

    const note = state.root.querySelector('.read-only-note') as HTMLElement;
    expect(note.textContent).toContain('predates groups');
    const link = note.querySelector('a') as HTMLAnchorElement;
    expect(link).withContext('the route to the fix').not.toBeNull();
    expect(link.getAttribute('href')).toBe('/project/Demo1/script/1245/source');
  });

  it('explains a 403 with its own line and hides nothing', async () => {
    const state = await setupEditor();
    TestBed.inject(AccessService).noteForbidden();
    // The draft service folds the flag into `writesDisabled`; the shell renders what it says.
    state.draft.writesDisabled.set(true);
    state.harness.detectChanges();

    const note = state.root.querySelector('.read-only-note') as HTMLElement;
    expect(note).withContext('the one explanatory line is shown').not.toBeNull();
    expect(note.textContent).toContain('read but not change');
    expect(note.getAttribute('role')).toBe('status');
    expect(state.root.querySelector('button[aria-label="Publish"]'))
      .withContext('nothing is hidden: the control stays and disables').not.toBeNull();
  });

  it('shows the four save-state forms and retries the failed save', async () => {
    const state = await setupEditor();
    const status = () => state.root.querySelector('.save-state') as HTMLElement;

    expect(status().textContent).toContain('All changes saved');

    state.draft.dirty.set(true);
    state.harness.detectChanges();
    expect(status().textContent).toContain('Unsaved changes');

    state.draft.saving.set(true);
    state.harness.detectChanges();
    expect(status().textContent).toContain('Saving…');

    state.draft.saving.set(false);
    state.draft.lastError.set('HTTP 500');
    state.harness.detectChanges();
    expect(status().textContent).toContain('The draft could not be saved:');
    expect(status().textContent).toContain('HTTP 500');

    const retry = state.root.querySelector<HTMLButtonElement>('.save-state .retry');
    expect(retry).withContext('the Retry action exists').not.toBeNull();
    (retry as HTMLButtonElement).click();
    await settle(state);
    expect(state.draft.flush).toHaveBeenCalled();
  });

  it('keeps the unsaved form in FILES mode and shows the read-only note', async () => {
    const state = await setupEditor();
    state.draft.writesDisabled.set(true);
    state.draft.dirty.set(true);
    state.harness.detectChanges();

    expect(state.root.querySelector('.save-state')?.textContent).toContain('Unsaved changes');
    expect(state.root.querySelector('.read-only-note')).not.toBeNull();

    state.draft.dirty.set(false);
    state.harness.detectChanges();
    expect(state.root.querySelector('.read-only-note')).not.toBeNull();
  });

  it('offers both conflict choices instead of a silent failure', async () => {
    const state = await setupEditor();
    state.draft.conflict.set({localText: 'a', remoteText: 'b', remoteEtag: '"B"', remote: null});
    state.harness.detectChanges();

    const bar = state.root.querySelector('.conflict-bar');
    expect(bar?.textContent).toContain('The draft changed on the server while you were editing.');

    const useServer = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.conflict-bar button'))
      .find((element) => element.textContent?.trim() === 'Use server') as HTMLButtonElement;
    useServer.click();
    await settle(state);
    expect(state.draft.resolveConflict).toHaveBeenCalledWith('remote');

    const keepMine = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.conflict-bar button'))
      .find((element) => element.textContent?.trim() === 'Keep mine') as HTMLButtonElement;
    keepMine.click();
    await settle(state);
    expect(state.draft.resolveConflict).toHaveBeenCalledWith('local');
  });

  it('enables undo and redo from canUndo/canRedo and drives the global shortcuts', async () => {
    const state = await setupEditor();

    expect(button(state.root, 'Undo').disabled).toBe(true);
    expect(button(state.root, 'Redo').disabled).toBe(true);

    state.draft.canUndo.set(true);
    state.draft.canRedo.set(true);
    state.harness.detectChanges();
    const undo = button(state.root, 'Undo');
    const redo = button(state.root, 'Redo');
    expect(undo.disabled).toBe(false);
    expect(redo.disabled).toBe(false);

    undo.click();
    redo.click();
    await settle(state);
    expect(state.draft.undo).toHaveBeenCalledTimes(1);
    expect(state.draft.redo).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true}));
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Z', metaKey: true, shiftKey: true, bubbles: true}));
    await settle(state);
    expect(state.draft.undo).toHaveBeenCalledTimes(2);
    expect(state.draft.redo).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true}));
    await settle(state);
    expect(state.draft.flush).toHaveBeenCalled();
  });

  it('leaves the shortcuts alone while focus is in the script-name field', async () => {
    const state = await setupEditor();
    const input = state.root.querySelector<HTMLInputElement>('#shell-script-name') as HTMLInputElement;
    expect(input).not.toBeNull();

    input.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true}));
    await settle(state);
    expect(state.draft.undo).not.toHaveBeenCalled();
  });

  it('routes the breadcrumb name edit through setValue on the script path', async () => {
    const state = await setupEditor();
    const input = state.root.querySelector<HTMLInputElement>('#shell-script-name') as HTMLInputElement;
    input.value = 'Renamed';
    input.dispatchEvent(new Event('change'));
    await settle(state);
    expect(state.draft.setValue).toHaveBeenCalledWith('script.name', ['name'], 'Renamed');
  });

  it('blocks Publish with a reason for errors and for FILES mode, enables it at zero errors', async () => {
    const state = await setupEditor();
    const publish = () => button(state.root, 'Publish');

    expect(publish().disabled).toBe(false);
    expect(state.root.querySelector('.publish-reason')).toBeNull();

    state.findings.setClient([error]);
    state.harness.detectChanges();
    expect(publish().disabled).toBe(true);
    expect(publish().getAttribute('title')).toContain('must be fixed');
    expect(state.root.querySelector('.publish-reason')?.textContent).toContain('must be fixed');

    state.findings.setClient([]);
    state.draft.writesDisabled.set(true);
    state.harness.detectChanges();
    expect(publish().disabled).toBe(true);
    expect(publish().getAttribute('title')).toBe('This milestone is read-only: saving, publishing and editing are disabled.');

    state.draft.writesDisabled.set(false);
    state.harness.detectChanges();
    expect(publish().disabled).toBe(false);
  });

  it('evaluates fresh findings when Publish is attempted with a recompute still pending', async () => {
    const state = await setupEditor();

    // A scheduled recompute for a draft the catalogue rejects (E10: no sections), not run yet.
    state.findings.scheduleClient({name: 'x', sections: []});
    expect(state.findings.gate().blocked).toBe(false);

    button(state.root, 'Publish').click();
    await settle(state);

    // The attempt re-ran the catalogue before reading the gate, so the dialog never opened.
    expect(state.findings.gate().blocked).toBe(true);
    expect(state.root.querySelector('[role="dialog"]')).toBeNull();
    expect(state.http.match((request) => request.method === 'POST').length).toBe(0);
  });

  it('lists warnings in the dialog, flushes, and publishes the draft ETag and note', async () => {
    const state = await setupEditor();
    state.findings.setClient([warning]);
    state.harness.detectChanges();

    button(state.root, 'Publish').click();
    await settle(state);

    const dialog = state.root.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('W01');
    expect(dialog?.textContent).toContain('The section has no items.');

    const note = dialog?.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'added repetition';
    note.dispatchEvent(new Event('input'));
    (dialog?.querySelector('.dialog-actions button.primary') as HTMLButtonElement).click();
    await settle(state);

    expect(state.draft.flush).toHaveBeenCalled();
    const request = state.http.expectOne((req) => req.url === 'project/Demo1/script/1245/publish');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({fromDraftEtag: '"A"', note: 'added repetition'});
    request.flush({version: 4});

    await settle(state);
    expect(state.root.querySelector('[role="dialog"]')).toBeNull();
    expect(state.root.querySelector('.notice.ok')?.textContent).toContain('Published v4');
    expect(state.findings.server()).toEqual([]);
  });

  it('renders a rejected publish as server findings instead of a stuck dialog', async () => {
    const state = await setupEditor();
    button(state.root, 'Publish').click();
    await settle(state);
    (state.root.querySelector('.dialog-actions button.primary') as HTMLButtonElement).click();
    await settle(state);

    const request = state.http.expectOne((req) => req.url === 'project/Demo1/script/1245/publish');
    request.flush(
      {error: 'PUBLISH_REJECTED', message: 'The draft failed validation.', details: {checks: [serverCheck]}},
      {status: 409, statusText: 'Conflict'},
    );
    await settle(state);

    expect(state.root.querySelector('[role="dialog"]')).toBeNull();
    expect(state.findings.server()).toEqual([serverCheck]);
    expect(state.root.querySelector('.notice')?.textContent).toContain('The server refused to publish this draft.');
    expect(state.root.querySelector('.server-findings')?.textContent).toContain('E02');
    expect(state.root.querySelector('.server-findings')?.textContent).toContain('Two items share an itemcode.');
  });

  it('names the features an unknown recorder floor rejects', async () => {
    const state = await setupEditor();
    button(state.root, 'Publish').click();
    await settle(state);
    (state.root.querySelector('.dialog-actions button.primary') as HTMLButtonElement).click();
    await settle(state);

    const request = state.http.expectOne((req) => req.url === 'project/Demo1/script/1245/publish');
    request.flush(
      {error: 'FEATURE_FLOOR_UNKNOWN', details: {features: ['newAudio', 'video']}},
      {status: 409, statusText: 'Conflict'},
    );
    await settle(state);

    const notice = state.root.querySelector('.notice')?.textContent ?? '';
    expect(notice).toContain('newAudio');
    expect(notice).toContain('video');
    expect(state.root.querySelector('[role="dialog"]')).toBeNull();
  });

  it('hides the draft controls on the library route and never loads a draft itself', async () => {
    const state = await setup('/project/Demo1/script');

    expect(state.root.querySelector('.save-state')).toBeNull();
    expect(state.root.querySelector('button[aria-label="Publish"]')).toBeNull();
    expect(state.root.querySelector('button[aria-label="Undo"]')).toBeNull();
    expect(state.draft.load).not.toHaveBeenCalled();
  });

  it('hides the controls when the loaded draft belongs to another script', async () => {
    const state = await setup('/project/Demo1/script/1245/edit');
    state.draft.loadedScript.set('9999');
    state.harness.detectChanges();

    // The toolbar names the mismatch instead of claiming a save about a draft that is not there.
    expect((state.root.querySelector('.save-state') as HTMLElement).textContent).toContain('No draft loaded');
    expect(state.root.querySelector('button[aria-label="Publish"]')).toBeNull();
  });

  it('says the draft could not be loaded, and never "all changes saved", when the load failed', async () => {
    const state = await setup('/project/Demo1/script/1245/edit');
    // A failed load leaves no model and no loaded script, and carries the reason.
    state.draft.model.set(null);
    state.draft.lastError.set('HTTP 404 Not Found');
    state.harness.detectChanges();

    const status = state.root.querySelector('.save-state') as HTMLElement;
    expect(status.textContent).toContain('The draft could not be loaded:');
    expect(status.textContent).toContain('HTTP 404 Not Found');
    expect(status.textContent).not.toContain('All changes saved');
    expect(status.textContent).toContain('Retry');
    expect(state.root.querySelector('button[aria-label="Publish"]')).toBeNull();
  });

  it('keeps the save wording distinct once a draft is loaded and a save fails', async () => {
    const state = await setupEditor();
    state.draft.lastError.set('HTTP 500');
    state.harness.detectChanges();

    const status = state.root.querySelector('.save-state') as HTMLElement;
    expect(status.textContent).toContain('The draft could not be saved:');
    expect(status.textContent).not.toContain('could not be loaded');
  });
});
