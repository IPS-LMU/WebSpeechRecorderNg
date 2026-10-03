import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, type TestRequest} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {DrawApiService} from '../core/draw-api.service';
import {ScriptApiService} from '../core/script-api.service';
import type {DrawPage, SessionDrawTrace} from '../core/script.model';
import {DrawsView} from './draws-view';
import {DrawsService} from './draws.service';

const PAGE: DrawPage = {
  total: 1,
  rows: [
    {
      sessionId: 'bank-draw--s1',
      speaker: 'sp-13',
      status: 'CREATED',
      preview: false,
      scriptVersion: 3,
      drawnDate: '2026-10-03T16:32:44.796Z',
      bank: 'std-passages',
      bankSource: 'BUILTIN',
      drawn: 2,
      recorded: 1,
      items: [
        {itemcode: 'RB001', bankItemId: 'std-001', recorded: true},
        {itemcode: 'RB002', bankItemId: 'std-002', recorded: false},
      ],
    },
  ],
};

const TRACE: SessionDrawTrace = {
  sessionId: 'bank-draw--s1',
  script: 'bank-draw',
  scriptVersion: 3,
  drawnDate: '2026-10-03T16:32:44.796Z',
  redraw: 0,
  prefills: {},
  bankDraws: [
    {
      kind: 'bank',
      placeholderItemcode: 'RB',
      bank: 'std-passages',
      bankSource: 'BUILTIN',
      filter: {category: 'sentence'},
      count: 2,
      fixedBy: 'SESSION',
      key: 'session:bank-draw--s1',
      itemcodePrefix: 'RB',
      items: [
        {itemcode: 'RB001', bankItemId: 'std-001'},
        {itemcode: 'RB002', bankItemId: 'std-002'},
      ],
      refilled: true,
      skippedRecorded: true,
      speakerFallback: false,
      drawnForVersion: 3,
    },
  ],
};

const BANK_ITEMS = {matchCount: 2, items: [{bankItemId: 'std-001', text: 'The bench stood by the station.'}]};

interface Harness {
  http: HttpTestingController;
  root: HTMLElement;
}

let currentHarness: RouterTestingHarness;

function requestFor(http: HttpTestingController, predicate: (url: string) => string | null): TestRequest {
  return http.expectOne((request) => predicate(request.urlWithParams) !== null);
}

async function setup(url: string): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          {path: 'project/:p/draws', component: DrawsView},
          {path: 'project/:p/script/:id/draws', component: DrawsView},
        ],
        withComponentInputBinding(),
      ),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: SPEECHRECORDER_CONFIG,
        useValue: {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1, withCredentials: true},
      },
      DrawApiService,
      BankApiService,
      ScriptApiService,
      DrawsService,
    ],
  });
  currentHarness = await RouterTestingHarness.create(url);
  return {http: TestBed.inject(HttpTestingController), root: currentHarness.routeNativeElement as HTMLElement};
}

/** Flush the record, then the trace and the bank-text lookup the detail opens. */
async function settleDetail(state: Harness): Promise<void> {
  requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null)).flush(PAGE);
  detect();
  requestFor(state.http, (url) => (url.includes('/session/bank-draw--s1/draws') && !url.includes('_redraw') ? 'trace' : null))
    .flush(TRACE);
  detect();
  requestFor(state.http, (url) => (url.includes('/bank/std-passages/item') ? 'bank' : null)).flush(BANK_ITEMS);
  detect();
}

/** `RouterTestingHarness` does not auto-detect between flushes. */
function detect(): void {
  currentHarness.detectChanges();
}

describe('DrawsView', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows the one-line empty state when the script has no sessions', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws');
    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null))
      .flush({total: 0, rows: []});
    detect();

    expect(state.root.querySelector('.state')?.textContent).toContain('No session has drawn from this script yet.');
    expect(state.root.querySelector('.draws-table')).toBeNull();
    expect(state.root.querySelector('.skeleton')).toBeNull();
  });

  it('renders skeleton rows while the record loads', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws');

    expect(state.root.querySelectorAll('.skeleton-row')).toHaveSize(3);
    expect(state.root.querySelector('.state')?.textContent).toContain('Loading the draw record');

    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null))
      .flush({total: 0, rows: []});
    detect();
  });

  it('renders the record and the deep-linked session trace with its bank texts', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws?session=bank-draw--s1');
    await settleDetail(state);

    const cells = Array.from(state.root.querySelectorAll('.draws-table tbody tr:first-child td'))
      .map((cell) => cell.textContent?.trim() ?? '');
    expect(cells[0]).toContain('bank-draw--s1');
    expect(cells[1]).toBe('sp-13');
    expect(cells[2]).toBe('Not started');
    expect(cells[3]).toBe('2');
    expect(cells[4]).toBe('1');
    expect(cells[5]).toBe('RB001, RB002');
    expect(state.root.querySelector('tr[aria-current="true"] .row-select')?.textContent).toContain('bank-draw--s1');

    // The trace: the seed inputs and the flags, then the materialised items.
    const detail = state.root.querySelector('.detail')?.textContent ?? '';
    expect(detail).toContain('session:bank-draw--s1');
    expect(detail).toContain('Session (a fresh draw per session)');
    expect(detail).toContain('std-passages');
    expect(detail).toContain('Ships with SpeechRecorder');
    expect(detail).toContain('Fixed by');

    const notes = Array.from(state.root.querySelectorAll('.notes li')).map((li) => li.textContent ?? '');
    expect(notes).toHaveSize(2);
    expect(notes[0]).toContain('already recorded were skipped');
    expect(notes[1]).toContain('put back');

    const texts = Array.from(state.root.querySelectorAll('.items tbody tr')).map((row) => ({
      itemcode: row.querySelector('td')?.textContent?.trim(),
      text: row.querySelector('.text')?.textContent?.trim(),
      recorded: row.querySelector('.recorded-dot')?.textContent?.trim(),
    }));
    expect(texts).toEqual([
      {itemcode: 'RB001', text: 'The bench stood by the station.', recorded: '\u25cf'},
      {itemcode: 'RB002', text: 'not in the bank now', recorded: '\u25cb'},
    ]);

    // A CREATED session can be re-drawn; the reason line is not shown.
    const redraw = state.root.querySelector('.redraw') as HTMLButtonElement;
    expect(redraw.disabled).toBe(false);
    expect(state.root.querySelector('.redraw-reason')).toBeNull();
    expect(state.root.querySelector('.download')).not.toBeNull();
  });

  it('disables re-draw with the reason once the session has started', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws');
    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null)).flush({
      total: 1,
      rows: [{...PAGE.rows[0], status: 'STARTED'}],
    } as DrawPage);
    detect();
    requestFor(state.http, (url) => (url.includes('/session/bank-draw--s1/draws') && !url.includes('_redraw') ? 'trace' : null))
      .flush(TRACE);
    detect();
    requestFor(state.http, (url) => (url.includes('/bank/std-passages/item') ? 'bank' : null)).flush(BANK_ITEMS);
    detect();

    const redraw = state.root.querySelector('.redraw') as HTMLButtonElement;
    expect(redraw.disabled).toBe(true);
    expect(redraw.getAttribute('title')).toContain('has started');
    expect(state.root.querySelector('.redraw-reason')?.textContent).toContain('has started');
  });

  it('re-draws a CREATED session and shows the new trace', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws?session=bank-draw--s1');
    await settleDetail(state);

    (state.root.querySelector('.redraw') as HTMLButtonElement).click();
    requestFor(state.http, (url) => (url.includes('/session/bank-draw--s1/draws/_redraw') ? 'redraw' : null))
      .flush({...TRACE, redraw: 1});
    detect();

    expect(state.root.querySelector('.redraw-message')?.textContent).toContain('re-resolved');
    // The table is reloaded so the record and the trace disagree of nothing.
    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null)).flush(PAGE);
    detect();
    requestFor(state.http, (url) => (url.includes('/bank/std-passages/item') ? 'bank' : null)).flush(BANK_ITEMS);
    detect();

    expect(state.root.querySelector('.redraw-message')?.textContent).toContain('keeps its id');
  });

  it('shows the receiver\u2019s refusal when a re-draw races a started session', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws?session=bank-draw--s1');
    await settleDetail(state);

    (state.root.querySelector('.redraw') as HTMLButtonElement).click();
    requestFor(state.http, (url) => (url.includes('/session/bank-draw--s1/draws/_redraw') ? 'redraw' : null))
      .flush({error: 'session has started', code: 'SESSION_ALREADY_STARTED'}, {status: 409, statusText: 'Conflict'});
    detect();

    const message = state.root.querySelector('.redraw-message')?.textContent ?? '';
    expect(message).toContain('The re-draw was refused.');
    expect(message).toContain('SESSION_ALREADY_STARTED');
  });

  it('shows the server message when the record cannot be loaded', async () => {
    const state = await setup('/project/Demo1/script/bank-draw/draws');
    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null))
      .flush({error: 'boom'}, {status: 500, statusText: 'Server Error'});
    detect();

    expect(state.root.querySelector('.state-error')?.textContent).toContain('500');
  });

  it('lets the project-scoped entry pick a script', async () => {
    const state = await setup('/project/Demo1/draws');
    requestFor(state.http, (url) =>
      url.includes('/project/Demo1/script') && !url.includes('/draws') ? 'scripts' : null,
    ).flush([{scriptId: 'bank-draw', name: 'Bank draw', status: 'DRAFT'}]);
    detect();

    expect(state.root.querySelector('.script-picker select')).not.toBeNull();
    expect(state.root.querySelector('.state')?.textContent).toContain('Choose a script');

    const select = state.root.querySelector('#draws-script') as HTMLSelectElement;
    select.value = 'bank-draw';
    select.dispatchEvent(new Event('change'));
    await currentHarness.fixture.whenStable();
    detect();

    requestFor(state.http, (url) => (url.includes('/script/bank-draw/draws') ? 'record' : null)).flush(PAGE);
    detect();
    requestFor(state.http, (url) => (url.includes('/session/bank-draw--s1/draws') && !url.includes('_redraw') ? 'trace' : null))
      .flush(TRACE);
    detect();
    requestFor(state.http, (url) => (url.includes('/bank/std-passages/item') ? 'bank' : null)).flush(BANK_ITEMS);
    detect();

    expect(state.root.querySelector('.row-select')?.textContent).toContain('bank-draw--s1');
  });
});
