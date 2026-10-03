import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {EditorFindingsService, FINDINGS_DEBOUNCE_MS} from '../core/editor-findings.service';
import {MediaService} from '../core/media.service';
import {isObject} from '../core/validation/walk';
import {ScriptApiService} from '../core/script-api.service';
import {JsonSource} from './json-source';

const WITH_FINDING = '{\n  "name": "x",\n  "sections": [\n    {\n      "groups": [\n        {\n          "order": "RANDOMIZED",\n          "promptItems": [{"itemcode": "A1", "mediaitems": [{"mimetype": "text/plain", "text": "hi"}]}]\n        }\n      ]\n    }\n  ]\n}';
const CLEAN = '{"name":"x","sections":[{"groups":[{"order":"SEQUENTIAL","promptItems":[{"itemcode":"A1","mediaitems":[{"mimetype":"text/plain","text":"hi"}]}]}]}]}';
const DUPLICATE_ITEMCODE = '{"name":"x","sections":[{"groups":[{"order":"SEQUENTIAL","promptItems":[{"itemcode":"A1","mediaitems":[{"mimetype":"text/plain","text":"hi"}]},{"itemcode":"A1","mediaitems":[{"mimetype":"text/plain","text":"ho"}]}]}]}]}';

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

function inputEvent(value: string): Event {
  return {target: {value}} as unknown as Event;
}

function setup(apiType: ApiType = ApiType.NORMAL) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [JsonSource],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({p: 'Demo1', id: 'demo'}))}},
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: 'api/v1', apiType, apiVersion: 1, withCredentials: true}},
      ScriptApiService,
      BankApiService,
      MediaService,
    ],
  });
  const fixture = TestBed.createComponent(JsonSource);
  fixture.detectChanges();
  return {fixture, http: TestBed.inject(HttpTestingController)};
}

function draftRequest(http: HttpTestingController) {
  return http.expectOne((request) => request.method === 'GET' && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/script/demo/draft');
}

function flushContext(http: HttpTestingController): void {
  http.expectOne((request) => request.method === 'GET' && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/bank').flush([]);
  http.expectOne((request) => request.method === 'GET' && pathOf(request.urlWithParams) === 'api/v1/project/Demo1/media').flush([]);
  http.expectOne((request) => request.method === 'GET' && pathOf(request.urlWithParams) === 'api/v1/version').flush({recorderVersion: '3.11.26'});
}

/** Runs the 2 s autosave debounce out and acks the write, so `http.verify()` sees no leftovers. */
function settleSave(http: HttpTestingController): void {
  tick(2500);
  for (const request of http.match((candidate) => candidate.method === 'PUT')) {
    request.flush({scriptId: 'demo', draftVersion: 9, etag: '"Z"'});
  }
  tick();
}

describe('JsonSource', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the draft with line numbers and a gutter dot on a finding line', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush(WITH_FINDING, {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const expectedLines = WITH_FINDING.split('\n').length;
    expect(root.querySelectorAll('.gutter-line').length).toBe(expectedLines);
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe(WITH_FINDING);

    // N02 anchors at `sections[0].groups[0].order`, which is line 7 of the fixture.
    const dot = root.querySelector('.gutter-line.dot') as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.textContent?.trim()).toBe('7');
    expect(dot.getAttribute('title')).toContain('N02');

    // The same finding is a card in the panel.
    expect(root.querySelector('.card .subject')?.textContent).toContain('Group 1.1 · order');
  }));

  it('freezes the structure on invalid text and never PUTs the broken text', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush(CLEAN, {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();

    const component = fixture.componentInstance;
    component.onInput(inputEvent('{"name": '));
    fixture.detectChanges();

    expect(component.parse().kind).toBe('syntax');
    expect(component.errorText()).toContain('line');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.parse-error')?.textContent).toContain('line');
    expect((root.querySelector('textarea') as HTMLTextAreaElement).getAttribute('aria-invalid')).toBe('true');

    tick(2500);
    for (const request of http.match((candidate) => candidate.method === 'PUT')) {
      expect(request.request.body as string).not.toContain('{"name": ');
      expect((request.request.body as string).includes('"sections"')).toBe(true);
      request.flush({scriptId: 'demo', draftVersion: 2, etag: '"B"'});
    }
    tick();

    // Restoring a valid object re-applies it and the draft moves on.
    component.onInput(inputEvent('{"name": "y", "sections": []}'));
    fixture.detectChanges();
    expect(component.parse().applicable).toBe(true);
    tick(2500);
    const put = http.expectOne((candidate) => candidate.method === 'PUT');
    expect(put.request.body as string).toContain('"y"');
    put.flush({scriptId: 'demo', draftVersion: 3, etag: '"C"'});
    tick();
    expect(component.draft.dirty()).toBe(false);
  }));

  it('blocks Publish on an error and allows it on a clean draft', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush('{"name":"x","sections":[]}', {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.actions .primary') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('Fix 1 error');
  }));

  it('renders server details.checks as findings on a refused publish', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush(CLEAN, {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.canPublish()).toBe(true);
    void component.publish();
    tick();
    const put = http.expectOne((candidate) => candidate.method === 'PUT');
    expect(put.request.headers.get('If-Match')).toBe('"A"');
    put.flush({scriptId: 'demo', draftVersion: 2, etag: '"B"'});
    tick();

    const post = http.expectOne((candidate) => candidate.method === 'POST' && pathOf(candidate.urlWithParams) === 'api/v1/project/Demo1/script/demo/publish');
    const publishBody: unknown = post.request.body;
    expect(isObject(publishBody) ? publishBody['fromDraftEtag'] : null).toBe('"B"');
    post.flush({
      error: 'The draft did not pass validation.',
      message: 'The draft did not pass validation.',
      details: {checks: [{id: 'E02', path: 'sections[0].groups[0].promptItems[0].itemcode'}]},
    }, {status: 409, statusText: 'Conflict'});
    tick();
    fixture.detectChanges();

    expect(TestBed.inject(EditorFindingsService).server().length).toBe(1);
    const card = fixture.nativeElement.querySelector('.card[data-server]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('The server refused this check (E02).');
  }));

  it('recomputes the catalogue once after a burst of edits, not per keystroke', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush(CLEAN, {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.findings()).toEqual([]);

    // Twenty valid edits in a burst; the last one duplicates an itemcode (E02).
    for (let edit = 0; edit < 19; edit++) {
      component.onInput(inputEvent(CLEAN.replace('"x"', `"x${edit}"`)));
      fixture.detectChanges();
    }
    component.onInput(inputEvent(DUPLICATE_ITEMCODE));
    fixture.detectChanges();

    // One pending recompute, not twenty: a per-keystroke run would already show E02.
    expect(component.findings()).toEqual([]);
    tick(FINDINGS_DEBOUNCE_MS - 1);
    expect(component.findings()).toEqual([]);

    tick(1);
    expect(component.findings().some((finding) => finding.id === 'E02')).toBe(true);
    settleSave(http);
  }));

  it('applies a catalogue fix through the draft service', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush(WITH_FINDING, {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();

    const component = fixture.componentInstance;
    const [orderFinding] = component.findings().filter((finding) => finding.id === 'N02');
    component.onFix({finding: orderFinding, options: {order: 'SEQUENTIAL'}});
    fixture.detectChanges();

    expect(component.draft.text()).toContain('"SEQUENTIAL"');
    expect(component.draft.text()).not.toContain('"RANDOMIZED"');
    // A fix is a discrete action: the catalogue has already re-run, with no debounce wait.
    expect(component.findings().some((finding) => finding.id === 'N02')).toBe(false);
    settleSave(http);
  }));

  it('re-indents the text on Format', fakeAsync(() => {
    const {fixture, http} = setup();
    draftRequest(http).flush('{"b":1,"a":2}', {headers: {ETag: '"A"'}});
    tick();
    flushContext(http);
    tick();

    fixture.componentInstance.format();
    expect(fixture.componentInstance.sourceText()).toBe('{\n  "b": 1,\n  "a": 2\n}');
    settleSave(http);
  }));
});
