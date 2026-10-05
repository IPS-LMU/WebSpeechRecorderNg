import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Router, provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {firstValueFrom, timer} from 'rxjs';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import type {ScriptSummary} from '../core/script.model';
import {ScriptApiService} from '../core/script-api.service';
import {ScriptLibrary} from './script-library';

/**
 * Script library states (ui-spec §9, library row: empty = "one line plus the two actions", loading
 * = "skeleton rows", error = "retry with the server message"; §2 for the row contents). The
 * component reads the list through `ScriptApiService`, so `HttpTestingController` stands in for
 * the receiver and no fixture file is fetched.
 *
 * These specs pin the states that the milestone checklist in §9 calls out and nothing else: they
 * fail if a state branch is removed, if the server message stops reaching the error state, or if
 * a state stops being distinguishable from the ready table.
 */

const ROWS: ScriptSummary[] = [
  {
    scriptId: '1245',
    name: 'Dysarthria test',
    status: 'DRAFT',
    sections: 5,
    fixedItems: 22,
    drawnItems: 0,
    modified: '2026-10-01',
    sessions: {total: 14, started: 14, byVersion: {'3': 14}},
  },
  {
    scriptId: '3456',
    name: 'Random test',
    status: 'PUBLISHED',
    publishedVersion: 2,
    sections: 4,
    fixedItems: 18,
    drawnItems: 0,
    modified: '2026-09-30',
  },
];

const ROUTES = [
  {path: 'project/:p/script', component: ScriptLibrary},
  {path: 'project/:p/script/:id/edit', component: ScriptLibrary},
];

interface Harness {
  harness: RouterTestingHarness;
  root: HTMLElement;
  http: HttpTestingController;
}

async function setup(url = '/project/Demo1/script'): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1}},
      ScriptApiService,
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return {harness, root: harness.routeNativeElement as HTMLElement, http: TestBed.inject(HttpTestingController)};
}

/** The one `GET project/{p}/script` the library issues on mount. */
function listRequest(http: HttpTestingController) {
  return http.expectOne((request) => request.method === 'GET'
    && request.urlWithParams.split('?')[0].endsWith('/project/Demo1/script'));
}

function setInput(root: HTMLElement, value: string): void {
  const input = root.querySelector<HTMLInputElement>('#library-search') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function setStatus(root: HTMLElement, value: string): void {
  const select = root.querySelector<HTMLSelectElement>('#library-status') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

/** The action button with `label` in the nth data row. */
function rowButton(root: HTMLElement, index: number, label: string): HTMLButtonElement {
  const row = root.querySelectorAll('.scripts tbody tr')[index];
  const button = Array.from(row.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent?.trim() === label);
  expect(button).withContext(`the ${label} action exists in row ${index}`).toBeDefined();
  return button as HTMLButtonElement;
}

/** Hands the file input a file the way a picker does, then fires the change event. */
function importFile(root: HTMLElement, file: File): void {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', {configurable: true, value: [file]});
  input.dispatchEvent(new Event('change'));
}

/** Reading a File is a browser promise, so the specs wait a real macrotask for it to land. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('ScriptLibrary states', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows skeleton rows while the list is in flight, not a spinner on an empty page', async () => {
    const state = await setup();

    const loading = state.root.querySelector('.state[role="status"]');
    expect(loading).withContext('the loading state is announced').not.toBeNull();
    expect(loading?.textContent).toContain('Loading scripts…');
    expect(loading?.querySelectorAll('.skeleton li').length).withContext('three skeleton rows').toBe(3);
    expect(state.root.querySelector('.scripts')).withContext('no table before the rows arrive').toBeNull();

    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();
    expect(state.root.querySelector('.scripts')).not.toBeNull();
  });

  it('shows the empty state as one line plus the two header actions', async () => {
    const state = await setup();
    listRequest(state.http).flush([]);
    state.harness.detectChanges();

    const empty = state.root.querySelector('.state');
    expect(empty?.textContent).toContain('No scripts in this project yet. Create one or import a JSON file to get started.');
    expect(state.root.querySelector('.scripts')).withContext('no table for no scripts').toBeNull();

    const actions = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.library-actions button'))
      .map((button) => button.textContent?.trim());
    expect(actions).toEqual(['New script', 'Import JSON']);
  });

  it('shows the server message and a Retry action when the list fails', async () => {
    const state = await setup();
    listRequest(state.http).flush('nope', {status: 503, statusText: 'Service Unavailable'});
    state.harness.detectChanges();

    const error = state.root.querySelector('.state-error[role="alert"]');
    expect(error).withContext('the failure is announced').not.toBeNull();
    expect(error?.textContent).toContain('The script list could not be loaded. (HTTP 503)');
    const retry = Array.from(error?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Retry');
    expect(retry).withContext('a Retry action exists').toBeDefined();
    expect(state.root.querySelector('.scripts')).withContext('no table on failure').toBeNull();

    // The Retry re-issues the list request; a good answer replaces the error with the table.
    retry?.click();
    await state.harness.fixture.whenStable();
    state.harness.detectChanges();
    listRequest(state.http).flush(ROWS);
    await state.harness.fixture.whenStable();
    state.harness.detectChanges();

    expect(state.root.querySelector('.state-error')).withContext('the error is gone').toBeNull();
    expect(state.root.querySelectorAll('.scripts tbody tr').length).withContext('the rows render').toBe(2);
  });

  it('renders name, id, counts, status and updated from the list fixture', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    const rows = Array.from(state.root.querySelectorAll<HTMLTableRowElement>('.scripts tbody tr'));
    expect(rows.length).toBe(2);

    const first = rows[0];
    expect(first.querySelector('a')?.textContent?.trim()).toBe('Dysarthria test');
    expect(first.querySelector('a')?.getAttribute('href')).toContain('/project/Demo1/script/1245/edit');
    expect(first.querySelector('.script-id')?.textContent).toBe('#1245');
    // ui-spec §2's order: name (+ id), content summary, status chip, usage, last edited, actions.
    const cells = Array.from(first.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '');
    expect(cells[0]).toContain('5 sections');
    expect(cells[0]).toContain('22 + 0 drawn');
    const chip = first.querySelector('.chip');
    expect(chip?.textContent?.trim()).toBe('Draft');
    expect(chip?.getAttribute('data-status')).toBe('DRAFT');
    expect(cells[2]).withContext('the usage cell reads sessions and their versions').toBe('14 sessions (v3)');
    expect(cells[3]).toBe('2026-10-01');

    const second = rows[1];
    expect(second.querySelector('a')?.textContent?.trim()).toBe('Random test');
    expect(second.querySelector('.chip')?.textContent?.trim()).toBe('Published');
    expect(second.querySelector('.chip')?.getAttribute('data-status')).toBe('PUBLISHED');
    const secondCells = Array.from(second.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '');
    expect(secondCells[2]).withContext('a script that never ran shows the placeholder, not "0 sessions"').toBe('—');
  });

  it('shows "no match" when the text filter excludes every row, and re-widens when cleared', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    setInput(state.root, 'zzz-not-a-script');
    state.harness.detectChanges();

    const body = state.root.querySelector('.scripts tbody') as HTMLElement;
    expect(body.querySelectorAll('tr').length).withContext('only the no-match row').toBe(1);
    expect(body.textContent).toContain('No script matches the filter.');

    // The filter is live: a matching term brings the row back, so the empty row is not sticky.
    setInput(state.root, 'Random');
    state.harness.detectChanges();
    const rows = Array.from(state.root.querySelectorAll('.scripts tbody tr'));
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Random test');
  });

  it('shows the section names under the script name', async () => {
    const state = await setup();
    listRequest(state.http).flush([
      {...ROWS[0], sectionNames: ['A', 'B']},
      // A script whose sections are unnamed shows no line at all, not an empty one.
      {...ROWS[1], scriptId: '9998', name: 'Unnamed sections', sectionNames: []},
    ]);
    state.harness.detectChanges();

    const rows = Array.from(state.root.querySelectorAll<HTMLTableRowElement>('.scripts tbody tr'));
    expect(rows[0].querySelector('.section-names')?.textContent?.trim()).toBe('A · B');
    expect(rows[1].querySelector('.section-names')).withContext('no line for unnamed sections').toBeNull();
  });

  it('searches by itemcode as well as by name and id', async () => {
    const state = await setup();
    const names = () => Array.from(state.root.querySelectorAll<HTMLTableRowElement>('.scripts tbody tr'))
      .map((row) => row.querySelector('th a')?.textContent?.trim() ?? '');
    listRequest(state.http).flush([
      {...ROWS[0], itemcodes: ['ANE01', 'ANE02']},
      {...ROWS[1], itemcodes: ['RG00']},
      // A row the list never gave codes for still matches by name.
      {...ROWS[1], scriptId: '9999', name: 'No codes', itemcodes: undefined},
    ]);
    state.harness.detectChanges();

    setInput(state.root, 'rg00');
    state.harness.detectChanges();
    expect(names()).toEqual(['Random test']);

    setInput(state.root, 'ane02');
    state.harness.detectChanges();
    expect(names()).toEqual(['Dysarthria test']);

    setInput(state.root, 'no codes');
    state.harness.detectChanges();
    expect(names()).toEqual(['No codes']);

    setInput(state.root, 'nothing here');
    state.harness.detectChanges();
    expect(state.root.querySelector('.scripts tbody tr td')?.textContent).toContain('No script matches the filter.');
  });

  it('filters by status as well as by text', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    setStatus(state.root, 'PUBLISHED');
    state.harness.detectChanges();

    const rows = Array.from(state.root.querySelectorAll('.scripts tbody tr'));
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Random test');
  });

  it('creates a script with no body and opens its editor', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    const button = Array.from(state.root.querySelectorAll<HTMLButtonElement>('.library-actions button'))
      .find((candidate) => candidate.textContent?.trim() === 'New script') as HTMLButtonElement;
    button.click();
    await firstValueFrom(timer(0));

    const create = state.http.expectOne((request) => request.method === 'POST'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script');
    expect(create.request.body).toEqual({});
    create.flush({scriptId: 77, draftVersion: 1, etag: '"A"'});
    await firstValueFrom(timer(0));

    expect(TestBed.inject(Router).url).toBe('/project/Demo1/script/77/edit');
  });

  it('duplicates a row into a new draft and opens it', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    rowButton(state.root, 0, 'Duplicate').click();
    await firstValueFrom(timer(0));

    const create = state.http.expectOne((request) => request.method === 'POST'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script');
    expect(create.request.body).toEqual({from: {scriptId: '1245'}});
    create.flush({scriptId: 78, draftVersion: 1, etag: '"B"'});
    await firstValueFrom(timer(0));

    expect(TestBed.inject(Router).url).toBe('/project/Demo1/script/78/edit');
  });

  it('archives a row, re-reads the list and offers Unarchive', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    rowButton(state.root, 0, 'Archive').click();
    await firstValueFrom(timer(0));

    const patch = state.http.expectOne((request) => request.method === 'PATCH'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/1245');
    expect(patch.request.body).toEqual({archived: true});
    patch.flush({scriptId: '1245', name: 'Dysarthria test', status: 'ARCHIVED', archived: true});
    // The list is re-read so the row shows what the server now holds, not what the click assumed.
    await state.harness.fixture.whenStable();
    state.harness.detectChanges();
    listRequest(state.http).flush([{...ROWS[0], status: 'ARCHIVED' as const, archived: true}, ROWS[1]]);
    await state.harness.fixture.whenStable();
    state.harness.detectChanges();

    expect(state.root.querySelector('.scripts tbody tr .chip')?.textContent).toContain('Archived');
    expect(rowButton(state.root, 0, 'Unarchive')).toBeDefined();
  });

  it('imports a JSON file into a new script and opens it', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    const text = '{"name":"Imported","sections":[]}';
    importFile(state.root, new File([text], 'imported.json', {type: 'application/json'}));
    await settle();

    const create = state.http.expectOne((request) => request.method === 'POST'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script');
    expect(create.request.body).toEqual({name: 'imported'});
    create.flush({scriptId: 91, draftVersion: 1, etag: '"C"'});
    await settle();

    const write = state.http.expectOne((request) => request.method === 'PUT'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/91/draft');
    expect(write.request.headers.get('If-Match')).toBe('"C"');
    expect(write.request.body).toBe(text);
    write.flush({scriptId: 91, draftVersion: 2, etag: '"D"'});
    await settle();

    expect(TestBed.inject(Router).url).toBe('/project/Demo1/script/91/edit');
  });

  it('refuses a file that is not JSON before creating anything', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    importFile(state.root, new File(['not json'], 'broken.json', {type: 'application/json'}));
    await settle();
    state.harness.detectChanges();

    expect(state.root.querySelector('.action-error')?.textContent).toContain('broken.json');
    expect(TestBed.inject(Router).url).toBe('/project/Demo1/script');
    // `afterEach`'s verify() proves no create was attempted.
  });

  it('exports the draft bytes under the script id', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    const names: string[] = [];
    const blobs: Blob[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });

    rowButton(state.root, 0, 'Export JSON').click();
    await firstValueFrom(timer(0));
    state.http.expectOne((request) => request.method === 'GET'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/1245/draft')
      .flush('{"name":"Dysarthria test","sections":[]}', {headers: {ETag: '"A"'}});
    await firstValueFrom(timer(0));

    expect(names).toEqual(['script-1245.json']);
    expect(await blobs[0].text()).toContain('Dysarthria test');
  });

  it('exports the newest published version when the script has no draft', async () => {
    const state = await setup();
    listRequest(state.http).flush(ROWS);
    state.harness.detectChanges();

    const names: string[] = [];
    const blobs: Blob[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });

    rowButton(state.root, 1, 'Export JSON').click();
    await firstValueFrom(timer(0));
    state.http.expectOne((request) => request.method === 'GET'
      && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/3456/draft')
      .flush({error: 'script 3456 has no draft'}, {status: 404, statusText: 'Not Found'});
    await firstValueFrom(timer(0));
    state.http.expectOne((request) => pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/3456/version')
      .flush([{version: 2, publishedDate: '2026-09-30T00:00:00.000Z'}]);
    await firstValueFrom(timer(0));
    state.http.expectOne((request) => pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/3456/version/2')
      .flush({name: 'Random test', sections: []});
    await firstValueFrom(timer(0));

    expect(names).toEqual(['script-3456.json']);
    expect(await blobs[0].text()).toContain('"name": "Random test"');
  });
});
