import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
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
});
