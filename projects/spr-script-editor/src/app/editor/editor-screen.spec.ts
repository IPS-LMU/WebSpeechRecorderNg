import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {firstValueFrom, timer} from 'rxjs';
import {BankApiService} from '../core/bank-api.service';
import {MediaService} from '../core/media.service';
import {ScriptApiService} from '../core/script-api.service';
import {EditorScreen} from './editor-screen';

/**
 * Editor-screen states (ui-spec §9, editor row: empty = "script with no sections: one card inviting
 * a section", loading = "outline skeleton, inspector blank", error = "draft load failure blocks
 * editing, never shows an empty script as if it were real"). §3.2 and §3.3 define the centre card
 * and the four inspector variants the deep link `?sel=` chooses.
 *
 * The screen reads its draft through the real `ScriptDraftService`, so the tests flush the draft
 * `GET` exactly like `script-draft.service.spec.ts`, then the injection-context requests
 * (`loadContext`) that the screen fans out. Nothing here changes a component: each assertion fails
 * if the corresponding §9 branch is removed.
 */

const SCRIPT_WITH_GROUP = {
  scriptId: '1245',
  name: 'Selection test',
  sections: [{
    name: 'A',
    mode: 'MANUAL',
    promptphase: 'RECORDING',
    groups: [{
      order: 'SEQUENTIAL',
      promptItems: [{itemcode: 'E01', mediaitems: [{mimetype: 'text/plain', text: 'Read this.'}]}],
    }],
  }],
};

const EMPTY_SCRIPT = {scriptId: '1245', name: 'No sections', sections: []};

const ROUTES = [{path: 'project/:p/script/:id/edit', component: EditorScreen}];

interface Harness {
  harness: RouterTestingHarness;
  root: HTMLElement;
  http: HttpTestingController;
}

async function mount(url = '/project/Demo1/script/1245/edit'): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1}},
      ScriptApiService,
      BankApiService,
      MediaService,
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return {harness, root: harness.routeNativeElement as HTMLElement, http: TestBed.inject(HttpTestingController)};
}

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

/**
 * Flushes the draft `GET` with `text`, then every request `loadContext` fans out (bank list, media
 * list, recorder version, version index, library summaries). A script with no bank source issues
 * no bank-item request, which keeps the fixture inline instead of touching `/test`.
 */
async function loadDraft(state: Harness, text: string): Promise<void> {
  state.http.expectOne((request) => request.method === 'GET'
    && pathOf(request.urlWithParams).endsWith('/project/Demo1/script/1245/draft'))
    .flush(text, {headers: {ETag: '"A"'}});
  // `start` awaits the draft and then fans out its context requests in a later microtask; a real
  // macrotask lets those continuations run before the requests are matched.
  await firstValueFrom(timer(0));
  state.harness.detectChanges();

  state.http.expectOne((request) => pathOf(request.urlWithParams).endsWith('/project/Demo1/bank')).flush([]);
  state.http.expectOne((request) => pathOf(request.urlWithParams).endsWith('/project/Demo1/media')).flush([]);
  state.http.expectOne((request) => pathOf(request.urlWithParams) === 'api/v1/version')
    .flush({recorderVersion: '3.12'});
  state.http.expectOne((request) => pathOf(request.urlWithParams).endsWith('/project/Demo1/script/1245/version')).flush([]);
  state.http.expectOne((request) => pathOf(request.urlWithParams).endsWith('/project/Demo1/script')).flush([]);

  await state.harness.fixture.whenStable();
  state.harness.detectChanges();
}

describe('EditorScreen states', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows the outline skeleton, not an editor, while the draft is in flight', async () => {
    const state = await mount();

    const loading = state.root.querySelector('.state[role="status"]');
    expect(loading).withContext('the loading state is announced').not.toBeNull();
    expect(loading?.textContent).toContain('Loading script…');
    expect(loading?.querySelectorAll('.skeleton .bar').length).withContext('six skeleton bars').toBe(6);
    expect(state.root.querySelector('.editor')).withContext('the three columns stay blank').toBeNull();
    expect(state.root.querySelector('spr-editor-inspector')).toBeNull();

    await loadDraft(state, JSON.stringify(EMPTY_SCRIPT));
  });

  it('invites a section for a script with no sections and shows no real-looking editor', async () => {
    const state = await mount();
    await loadDraft(state, JSON.stringify(EMPTY_SCRIPT));

    const card = state.root.querySelector('.empty-card') as HTMLElement;
    expect(card).withContext('the invite card replaces the centre').not.toBeNull();
    expect(card.textContent).toContain('This script has no sections');
    expect(card.textContent).toContain('A script needs at least one section with one group before anything can be recorded.');

    const add = Array.from(card.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Add section');
    expect(add).withContext('the Add section action exists').toBeDefined();

    // "never an empty editor that looks real": the section editor is not mounted.
    expect(state.root.querySelector('spr-editor-centre')).withContext('no centre editor').toBeNull();
    expect(state.root.querySelector('.state[role="status"]')).toBeNull();
  });

  it('blocks editing on a draft load failure with the server message and a Retry action', async () => {
    const state = await mount();

    state.http.expectOne((request) => request.method === 'GET'
      && pathOf(request.urlWithParams).endsWith('/project/Demo1/script/1245/draft'))
      .flush('nope', {status: 500, statusText: 'Server Error'});
    await firstValueFrom(timer(0));
    state.harness.detectChanges();

    const error = state.root.querySelector('.state.error[role="alert"]');
    expect(error).withContext('the failure is announced').not.toBeNull();
    expect(error?.textContent).toContain('The draft could not be loaded');
    expect(error?.textContent).toContain('Editing is blocked until the draft loads. This is not an empty script.');
    expect(error?.textContent).toContain('The script list could not be loaded. (HTTP 500)');
    const retry = Array.from(error?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Retry');
    expect(retry).withContext('a Retry action exists').toBeDefined();

    // "never shows an empty script as if it were real": neither the editor nor the empty card.
    expect(state.root.querySelector('.editor')).toBeNull();
    expect(state.root.querySelector('.empty-card')).toBeNull();
  });

  it('resolves ?sel=g:0:0 to the group inspector variant', async () => {
    const state = await mount('/project/Demo1/script/1245/edit?sel=g:0:0');
    await loadDraft(state, JSON.stringify(SCRIPT_WITH_GROUP));

    const inspector = state.root.querySelector('spr-editor-inspector') as HTMLElement;
    expect(inspector).not.toBeNull();
    expect(inspector.querySelector('h2')?.textContent?.trim()).toBe('Group');
    expect(inspector.querySelectorAll('[name="group-kind"]').length).withContext('the group variant radios').toBe(2);
    expect(inspector.querySelector('#script-id')).withContext('not the script variant').toBeNull();
  });

  it('selects the section variant for ?sel=s:0', async () => {
    const state = await mount('/project/Demo1/script/1245/edit?sel=s:0');
    await loadDraft(state, JSON.stringify(SCRIPT_WITH_GROUP));
    const inspector = state.root.querySelector('spr-editor-inspector') as HTMLElement;
    expect(inspector.querySelector('h2')?.textContent?.trim()).toBe('Section');
    expect(inspector.querySelectorAll('[name="section-mode"]').length).toBe(3);
  });

  it('defaults to the script variant with no query, not a stale node', async () => {
    const state = await mount();
    await loadDraft(state, JSON.stringify(SCRIPT_WITH_GROUP));
    const inspector = state.root.querySelector('spr-editor-inspector') as HTMLElement;
    expect(inspector.querySelector('h2')?.textContent?.trim()).toBe('Script');
    expect(inspector.querySelector('#script-id')).not.toBeNull();
    expect(inspector.querySelectorAll('[name="group-kind"]').length).toBe(0);
  });
});
