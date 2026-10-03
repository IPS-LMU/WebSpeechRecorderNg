import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {EDITOR_PROVIDERS} from '../app.providers';
import {APP_ROUTES} from '../app.routes';

/**
 * Route-level guard for the resolved-draws screen: it mounts the **real** `APP_ROUTES` over the
 * application's own provider list (`EDITOR_PROVIDERS`) and adds no service of its own.
 *
 * The point is NG0201: a view that injects a service the application does not provide must fail
 * here, not only in the browser. `DrawsService` (stateless) is `providedIn: 'root'` for exactly
 * this reason, and `DrawRulePanel`/`BankBrowser`-style manual providers are deliberately absent.
 */
const PAGE = {
  total: 1,
  rows: [{
    sessionId: 'bank-draw--s1',
    speaker: 'sp-13',
    status: 'CREATED',
    preview: false,
    scriptVersion: 3,
    drawnDate: '2026-10-03T16:32:44.796Z',
    bank: 'std-passages',
    bankSource: 'BUILTIN',
    drawn: 1,
    recorded: 0,
    items: [{itemcode: 'RB001', bankItemId: 'std-001', recorded: false}],
  }],
};

const TRACE = {
  sessionId: 'bank-draw--s1',
  script: 'bank-draw',
  scriptVersion: 3,
  drawnDate: '2026-10-03T16:32:44.796Z',
  redraw: 0,
  prefills: {},
  bankDraws: [{
    kind: 'bank',
    placeholderItemcode: 'RB',
    bank: 'std-passages',
    bankSource: 'BUILTIN',
    filter: {category: 'sentence'},
    count: 1,
    fixedBy: 'SESSION',
    key: 'session:bank-draw--s1',
    itemcodePrefix: 'RB',
    items: [{itemcode: 'RB001', bankItemId: 'std-001'}],
    refilled: false,
    skippedRecorded: false,
    speakerFallback: false,
    drawnForVersion: 3,
  }],
};

let harness: RouterTestingHarness;

function mount(url: string): Promise<RouterTestingHarness> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(APP_ROUTES, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...EDITOR_PROVIDERS,
    ],
  });
  return RouterTestingHarness.create(url);
}

function requestContaining(http: HttpTestingController, fragment: string) {
  return http.expectOne((request) => request.urlWithParams.includes(fragment));
}

function detect(): void {
  harness.detectChanges();
}

describe('DrawsView through the real APP_ROUTES', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the record, the trace and the detail with only the application providers', async () => {
    harness = await mount('/project/Demo1/script/bank-draw/draws');
    const http = TestBed.inject(HttpTestingController);
    const root = harness.routeNativeElement as HTMLElement;

    requestContaining(http, 'script/bank-draw/draws').flush(PAGE);
    detect();
    requestContaining(http, 'session/bank-draw--s1/draws').flush(TRACE);
    detect();
    requestContaining(http, 'bank/std-passages/item').flush({
      matchCount: 1,
      items: [{bankItemId: 'std-001', text: 'The bench stood by the station.'}],
    });
    detect();

    const cells = Array.from(root.querySelectorAll('.draws-table tbody tr:first-child td'))
      .map((cell) => cell.textContent?.trim() ?? '');
    expect(cells[0]).toContain('bank-draw--s1');
    expect(cells[1]).toBe('sp-13');
    expect(cells[2]).toBe('Not started');
    expect(cells[5]).toBe('RB001');

    expect(root.querySelector('.detail .detail-session')?.textContent).toContain('bank-draw--s1');
    expect(root.querySelector('.items tbody td.text')?.textContent).toContain('The bench stood');
  });

  it('opens the project-scoped entry and renders its script picker', async () => {
    harness = await mount('/project/Demo1/draws');
    const http = TestBed.inject(HttpTestingController);
    const root = harness.routeNativeElement as HTMLElement;

    requestContaining(http, 'project/Demo1/script').flush([{scriptId: 'bank-draw', name: 'Bank draw', status: 'DRAFT'}]);
    detect();

    expect(root.querySelector('#draws-script')).not.toBeNull();
    expect(root.querySelector('.state')?.textContent).toContain('Choose a script');
  });
});
