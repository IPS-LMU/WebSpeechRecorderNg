import {HttpRequest} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {firstValueFrom, timer} from 'rxjs';
import {ApiType, type Bank, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {BankItemPage} from '../core/script.model';
import {ScriptApiService} from '../core/script-api.service';
import {BANK_STRINGS} from './bank-strings';
import {BankBrowser} from './bank-browser';

@Component({selector: 'spr-spec-dummy', template: ''})
class Dummy {}

const BANKS: Bank[] = [
  {bankId: 'demo-sentences', title: 'Demo sentences', source: 'PROJECT', project: 'Demo1', itemCount: 4},
  {bankId: 'std-passages', title: 'Standard passages and vowels', source: 'BUILTIN', shippedWith: '3.12', itemCount: 6},
];

const PAGE: BankItemPage = {
  matchCount: 2,
  withoutAudio: 1,
  offset: 0,
  items: [
    {bankItemId: 'demo-001', text: 'Ställ klockan, sju.', category: 'sentence', words: 6, tags: ['demo']},
    {bankItemId: 'demo-002', text: 'Katterna sover i solen.', category: 'sentence', words: 6, tags: ['demo', 'balanced']},
  ],
};

const EMPTY: BankItemPage = {matchCount: 0, withoutAudio: 0, offset: 0, items: []};

const SCRIPT = {
  type: 'script',
  scriptId: 'bank-draw',
  name: 'Bank draw',
  sections: [{
    mode: 'MANUAL',
    promptphase: 'RECORDING',
    groups: [{
      order: 'SEQUENTIAL',
      promptItems: [{
        itemcode: 'RB',
        mediaitems: [{mimetype: 'text/plain', text: 'Read the sentence aloud.'}],
        prefill: {
          bank: {
            bank: 'std-passages',
            bankSource: 'BUILTIN',
            filter: {category: 'sentence'},
            count: 2,
            order: 'SEQUENTIAL',
            fixedBy: 'SESSION',
            itemcodePrefix: 'RB',
          },
        },
      }],
    }],
  }],
};

const ROUTES = [
  {path: 'project/:p/bank', component: BankBrowser},
  {path: 'project/:p/script/:id/bank/:groupRef', component: BankBrowser},
  {path: 'project/:p/script', component: Dummy},
  {path: 'project/:p/script/:id/edit', component: Dummy},
  {path: 'project/:p/script/:id/draws', component: Dummy},
];

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

function texts(root: HTMLElement, selector: string): string[] {
  return Array.from(root.querySelectorAll(selector)).map((element) => element.textContent?.trim() ?? '');
}

function buttonWith(root: HTMLElement, selector: string, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>(selector))
    .find((button) => (button.textContent ?? '').includes(label));
  if (found === undefined) {
    throw new Error(`no ${selector} labelled “${label}”`);
  }
  return found;
}

/**
 * Waits for the request the debounced stream schedules. The table and the rule panel debounce for
 * 120 ms, which `whenStable()` does not reliably cover, so the tests poll the backend instead.
 */
async function take(
  state: Pick<State, 'harness' | 'http'>,
  match: (request: HttpRequest<unknown>) => boolean,
  label = 'request',
): Promise<TestRequest> {
  for (let attempt = 0; attempt < 40; attempt++) {
    await firstValueFrom(timer(25));
    state.harness.detectChanges();
    const [request] = state.http.match(match);
    if (request !== undefined) {
      return request;
    }
  }
  const received = state.http.match(() => true)
    .map((request) => `${request.request.method} ${request.request.url}`)
    .join(', ');
  throw new Error(`no ${label} appeared; open requests: ${received}`);
}

/** Flushes every matching request until the stream goes quiet, so one or two both work. */
async function flushAll(state: State, match: (request: HttpRequest<unknown>) => boolean): Promise<void> {
  let flushed = 0;
  let quiet = 0;
  for (let attempt = 0; attempt < 60 && quiet < 8; attempt++) {
    await firstValueFrom(timer(25));
    state.harness.detectChanges();
    const pending = state.http.match(match);
    if (pending.length === 0) {
      quiet++;
      continue;
    }
    quiet = 0;
    for (const request of pending) {
      request.flush(PAGE);
      flushed++;
    }
    state.harness.detectChanges();
  }
  if (flushed === 0) {
    throw new Error('no item request appeared');
  }
}

interface State {
  harness: RouterTestingHarness;
  root: HTMLElement;
  http: HttpTestingController;
}

async function setup(url: string, mode: ApiType): Promise<State> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: SPEECHRECORDER_CONFIG,
        useValue: {apiEndPoint: mode === ApiType.FILES ? 'test' : 'api/v1', apiType: mode, apiVersion: 1},
      },
      BankApiService,
      ScriptApiService,
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return {harness, root: harness.routeNativeElement as HTMLElement, http: TestBed.inject(HttpTestingController)};
}

describe('BankBrowser (project bank, FILES mode)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mounts through the route and lists the banks grouped by origin with chips', async () => {
    const {harness, root, http} = await setup('/project/Demo1/bank', ApiType.FILES);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank.json')).flush(BANKS);
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank/demo-sentences/item.json')).flush(PAGE);
    harness.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain(BANK_STRINGS.browserTitle);
    expect(texts(root, '.picker-group h3')).toEqual([
      BANK_STRINGS.picker.groupProject,
      BANK_STRINGS.picker.groupBuiltin,
    ]);
    expect(texts(root, '.bank-name')).toEqual(['Demo sentences', 'Standard passages and vowels']);
    expect(texts(root, '.bank-row .chip')).toEqual([
      BANK_STRINGS.picker.originProject,
      BANK_STRINGS.picker.originBuiltin,
    ]);

    // The browse filter is visibly distinct and says it is never written to the draft.
    expect(root.querySelector('.browse-filter legend')?.textContent).toContain(BANK_STRINGS.filter.browseLegend);
    expect(root.querySelector('.browse-filter .hint')?.textContent).toContain('never written to the draft');
    // There is no rule panel on the project-scoped route.
    expect(root.querySelector('spre-draw-rule')).toBeNull();

    expect(texts(root, '.items thead th')).toContain(BANK_STRINGS.table.columnId);
    expect(root.querySelector('.pager-text')?.textContent).toContain('Showing 1–2 of 2');
    // FILES mode disables writes and says so.
    expect(root.querySelector('.files-mode')?.textContent).toContain('read-only');
  });

  it('marks a shipped bank read-only and offers to copy it into the project', async () => {
    const {harness, root, http} = await setup('/project/Demo1/bank', ApiType.FILES);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank.json')).flush(BANKS);
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item.json'))).flush(PAGE);
    harness.detectChanges();

    buttonWith(root, '.bank-row', 'Standard passages and vowels').click();
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/std-passages/item.json'))).flush(PAGE);
    harness.detectChanges();

    expect(root.querySelector('.read-only')?.textContent).toContain(BANK_STRINGS.picker.readOnlyTitle);
    expect(root.querySelector('.read-only button')?.textContent).toContain(BANK_STRINGS.picker.copy);
    expect(texts(root, '.actions button')).not.toContain(BANK_STRINGS.table.edit);
  });

  it('offers to widen the filter when it matches nothing', async () => {
    const {harness, root, http} = await setup('/project/Demo1/bank', ApiType.FILES);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank.json')).flush(BANKS);
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item.json'))).flush(PAGE);
    harness.detectChanges();

    const search = root.querySelector('.browse-filter input[type="search"]') as HTMLInputElement;
    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item.json'))).flush(EMPTY);
    harness.detectChanges();

    expect(root.querySelector('.state.empty h3')?.textContent).toContain(BANK_STRINGS.table.emptyTitle);
    expect(buttonWith(root, '.state.empty button', BANK_STRINGS.filter.browseWiden)).toBeTruthy();
  });
});

describe('BankBrowser (drawn group, FILES mode)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function openGroup(ref: string, itemSuffix: string): Promise<State> {
    const state = await setup(`/project/Demo1/script/bank-draw/bank/${ref}`, ApiType.FILES);
    (await take(state, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank.json')).flush(BANKS);
    state.harness.detectChanges();
    (await take(state, (req) => pathOf(req.urlWithParams) === 'test/project/Demo1/script/bank-draw/draft.json'))
      .flush(JSON.stringify(SCRIPT), {headers: {ETag: '"d1"'}});
    state.harness.detectChanges();
    await flushAll(state, (req) => pathOf(req.urlWithParams).endsWith(itemSuffix));
    return state;
  }

  it('mounts through the group route and shows the rule beside the browse filter', async () => {
    const {root} = await openGroup('g:0:0', '/std-passages/item.json');

    expect(root.querySelector('h1')?.textContent).toContain(BANK_STRINGS.ruleScreenTitle);
    // Both filters exist and are distinct.
    expect(root.querySelector('.browse-filter legend')?.textContent).toContain(BANK_STRINGS.filter.browseLegend);
    expect(root.querySelector('spre-draw-rule .rule-filter legend')?.textContent)
      .toContain(BANK_STRINGS.filter.ruleLegend);
    // The rule was read from the draft and its count is validated against matchCount.
    const panel = root.querySelector('spre-draw-rule') as HTMLElement;
    expect((panel.querySelector('#rule-prefix') as HTMLInputElement).value).toBe('RB');
    expect(panel.querySelector('#rule-count-msg')?.textContent).toContain('matches 2 of 6');
    expect(root.querySelector('.rule-column a')?.getAttribute('href')).toContain('/draws');
  });

  it('says so, pointing right, when the group does not draw from a bank', async () => {
    const {root} = await openGroup('g:9:9', '/demo-sentences/item.json');

    expect(root.querySelector('.rule-column h3')?.textContent).toContain(BANK_STRINGS.group.missingTitle);
  });
});

describe('BankBrowser (project bank, NORMAL mode: write affordances)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function open(): Promise<State> {
    const state = await setup('/project/Demo1/bank', ApiType.NORMAL);
    (await take(state, (req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank')).flush(BANKS);
    state.harness.detectChanges();
    (await take(state, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item'))).flush(PAGE);
    state.harness.detectChanges();
    return state;
  }

  it('edits a project bank item and only offers editing there', async () => {
    const {harness, root, http} = await open();

    buttonWith(root, '.actions button', BANK_STRINGS.table.edit).click();
    harness.detectChanges();
    const text = root.querySelector('#item-text') as HTMLTextAreaElement;
    expect(text.value).toBe('Ställ klockan, sju.');
    text.value = 'Ställ klockan, åtta.';
    text.dispatchEvent(new Event('input'));
    harness.detectChanges();
    (root.querySelector('.item-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    harness.detectChanges();

    const put = await take({harness, http}, (req) => req.method === 'PUT' && req.url.endsWith('/bank/demo-sentences/item/demo-001'), 'PUT item');
    expect(put.request.body.text).toBe('Ställ klockan, åtta.');
    put.flush({bankItemId: 'demo-001', text: 'Ställ klockan, åtta.'});
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank', 'bank list reload')).flush(BANKS);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item'), 'demo item page')).flush(PAGE);
    harness.detectChanges();

    // The shipped bank is read-only: no Edit, a Copy button instead.
    buttonWith(root, '.bank-row', 'Standard passages and vowels').click();
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/std-passages/item'), 'std item page')).flush(PAGE);
    harness.detectChanges();
    expect(texts(root, '.actions button')).not.toContain(BANK_STRINGS.table.edit);

    buttonWith(root, '.read-only button', BANK_STRINGS.picker.copy).click();
    harness.detectChanges();
    const copy = await take({harness, http}, (req) => req.method === 'POST' && req.url.endsWith('/project/Demo1/bank'), 'POST copy');
    expect(copy.request.body).toEqual({copyFrom: 'std-passages'});
    copy.flush({bankId: 'standard-passages-and-vowels', title: 'Copy', source: 'PROJECT', itemCount: 6});
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank', 'bank list reload')).flush(BANKS);
    harness.detectChanges();
  });

  it('uploads a model recording through the project media endpoint, then stores its src', async () => {
    const {harness, root, http} = await open();

    const file = new File([new Uint8Array([1, 2, 3])], 'model.wav', {type: 'audio/wav'});
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = root.querySelector('.audio-cell input[type="file"]') as HTMLInputElement;
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    harness.detectChanges();

    const upload = await take({harness, http}, (req) => req.method === 'POST' && req.url.endsWith('/project/Demo1/media'));
    expect(upload.request.headers.get('X-Filename')).toBe('model.wav');
    upload.flush({src: 'media/model.wav', mimetype: 'audio/wav', durationMs: 1000});
    harness.detectChanges();

    const put = await take({harness, http}, (req) => req.method === 'PUT' && req.url.endsWith('/bank/demo-sentences/item/demo-001'), 'PUT item');
    expect(put.request.body.audioSrc).toBe('media/model.wav');
    expect(put.request.body.audioMimetype).toBe('audio/wav');
    put.flush({bankItemId: 'demo-001', audioSrc: 'media/model.wav'});
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank', 'bank list reload')).flush(BANKS);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item'), 'demo item page')).flush(PAGE);
    harness.detectChanges();
  });

  it('deletes an item only after a second, explicit confirmation', async () => {
    const {harness, root, http} = await open();

    buttonWith(root, '.actions button', BANK_STRINGS.table.delete).click();
    harness.detectChanges();
    expect(http.match((req) => req.method === 'DELETE')).toHaveSize(0);

    buttonWith(root, '.actions button', BANK_STRINGS.table.deleteConfirm).click();
    harness.detectChanges();

    const remove = await take({harness, http}, (req) => req.method === 'DELETE' && req.url.endsWith('/bank/demo-sentences/item/demo-001'));
    remove.flush({bankId: 'demo-sentences', itemCount: 1});
    harness.detectChanges();
    (await take({harness, http}, (req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank', 'bank list reload')).flush(BANKS);
    (await take({harness, http}, (req) => pathOf(req.urlWithParams).endsWith('/demo-sentences/item'), 'demo item page')).flush(PAGE);
    harness.detectChanges();
  });
});
