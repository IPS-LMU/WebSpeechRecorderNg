/**
 * Draft-service protocol specs (plan M3, `E3 draft service`; rest-api.md §2.3, decisions D-C/D-N/D2).
 *
 * `HttpTestingController` stands in for the receiver: the specs assert the exact request shape
 * (method, `If-Match`, body), the debounce/flush timing, single-flight coalescing, the 412
 * re-apply-with-guards path, the 428 reload-and-retry, the invalid-JSON rule, the local backup and
 * the FILES-mode read-only behaviour. They are the executable contract the receiver conformance
 * run then re-checks with real status codes and ETags.
 */
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {ScriptApiService} from './script-api.service';
import {ScriptDraftService} from './script-draft.service';

const DRAFT = '{"name":"x","sections":[]}';
const ETAG_A = '"A"';
const WRITE_OK = {scriptId: 1, draftVersion: 2, etag: '"B"'};

function setup(config: SpeechRecorderConfig = {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: config},
      ScriptApiService,
    ],
  });
  return {service: TestBed.inject(ScriptDraftService), http: TestBed.inject(HttpTestingController)};
}

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

function expectDraft(http: HttpTestingController, method: string): TestRequest {
  return http.expectOne((request) => request.method === method && pathOf(request.urlWithParams).endsWith('/script/1/draft'));
}

/** Loads `text` at `etag` and settles the GET so the service has a model. */
function loadDraft(service: ScriptDraftService, http: HttpTestingController, text = DRAFT, etag = ETAG_A): void {
  void service.load('Demo1', 1);
  expectDraft(http, 'GET').flush(text, {headers: {ETag: etag}});
  tick();
}

function conflictBody(current: unknown, currentEtag: string) {
  return {
    error: 'The draft changed since you loaded it.',
    message: 'The draft changed since you loaded it.',
    code: 'SCRIPT_DRAFT_CONFLICT',
    details: {current, currentEtag},
  };
}

describe('ScriptDraftService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('debounces a write by 2 s and flushes it immediately on demand', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http);

    service.setValue('name', ['name'], 'debounced');
    tick(1999);
    http.expectNone((request) => request.method === 'PUT');

    tick(1);
    const debounced = expectDraft(http, 'PUT');
    expect(debounced.request.headers.get('If-Match')).toBe(ETAG_A);
    debounced.flush(WRITE_OK);
    tick();

    // A flush does not wait for the debounce.
    service.setValue('name', ['name'], 'flushed');
    void service.flush();
    const flushed = expectDraft(http, 'PUT');
    expect(flushed.request.body as string).toContain('flushed');
    flushed.flush({scriptId: 1, draftVersion: 3, etag: '"C"'});
    tick();
    expect(service.dirty()).toBe(false);
  }));

  it('single-flights the write and coalesces edits that arrive while one is in flight', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http);

    service.setValue('name', ['name'], 'first');
    void service.flush();
    const first = expectDraft(http, 'PUT');
    expect(first.request.body as string).toContain('first');

    service.setValue('name', ['name'], 'second');
    void service.flush();
    http.expectNone((request) => request.method === 'PUT');

    first.flush(WRITE_OK);
    tick();

    const second = expectDraft(http, 'PUT');
    expect(second.request.body as string).toContain('second');
    expect(second.request.headers.get('If-Match')).toBe('"B"');
    second.flush({scriptId: 1, draftVersion: 3, etag: '"C"'});
    tick();
    expect(service.dirty()).toBe(false);
  }));

  it('sends If-Match with the ETag of the last response', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, DRAFT, ETAG_A);

    service.setValue('name', ['name'], 'one');
    void service.flush();
    const one = expectDraft(http, 'PUT');
    expect(one.request.headers.get('If-Match')).toBe('"A"');
    one.flush(WRITE_OK);
    tick();
    expect(service.etag()).toBe('"B"');

    service.setValue('name', ['name'], 'two');
    void service.flush();
    const two = expectDraft(http, 'PUT');
    expect(two.request.headers.get('If-Match')).toBe('"B"');
    two.flush({scriptId: 1, draftVersion: 3, etag: '"C"'});
    tick();
    expect(service.etag()).toBe('"C"');
    expect(service.text()).toContain('two');
  }));

  it('re-applies the structural intent once after a 412 and retries with the fresh ETag', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, '{"name":"x","sections":[{"name":"a"}]}', '"A"');

    service.insert('sections', ['sections'], 1, {name: 'b'});
    void service.flush();
    const first = expectDraft(http, 'PUT');
    expect(first.request.headers.get('If-Match')).toBe('"A"');
    expect(JSON.parse(first.request.body as string).sections.length).toBe(2);

    // A second client renamed the script but left the section array alone: the guard holds.
    first.flush(conflictBody({name: 'server', sections: [{name: 'a'}]}, '"S"'), {status: 412, statusText: 'Precondition Failed'});
    tick();

    const retry = expectDraft(http, 'PUT');
    expect(retry.request.headers.get('If-Match')).toBe('"S"');
    const retried = JSON.parse(retry.request.body as string);
    expect(retried.name).toBe('server');
    expect(retried.sections.map((section: {name: string}) => section.name)).toEqual(['a', 'b']);
    retry.flush({scriptId: 1, draftVersion: 3, etag: '"D"'});
    tick();

    expect(service.conflict()).toBeNull();
    expect(service.etag()).toBe('"D"');
    expect(service.model()?.name).toBe('server');
    expect(service.dirty()).toBe(false);
  }));

  it('goes to the conflict state with both texts when an index guard fails', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, '{"name":"x","sections":[{"name":"a"}]}', '"A"');

    service.insert('sections', ['sections'], 1, {name: 'b'});
    void service.flush();
    expectDraft(http, 'PUT')
      .flush(conflictBody({name: 'server', sections: [{name: 'a'}, {name: 'c'}]}, '"S"'), {status: 412, statusText: 'Precondition Failed'});
    tick();

    // The array grew under the guard: no retry, the operator chooses.
    http.expectNone((request) => request.method === 'PUT');
    const conflict = service.conflict();
    expect(conflict).not.toBeNull();
    expect(conflict?.localText).toContain('"b"');
    expect(conflict?.remoteText).toContain('"c"');
    expect(conflict?.remoteEtag).toBe('"S"');
    expect(service.etag()).toBe('"A"');
  }));

  it('treats 428 as reload-then-retry-once', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, DRAFT, '"A"');

    service.setValue('name', ['name'], 'retry');
    void service.flush();
    expectDraft(http, 'PUT').flush(
      {error: 'If-Match is required for a draft write', message: 'If-Match is required for a draft write', code: 'PRECONDITION_REQUIRED'},
      {status: 428, statusText: 'Precondition Required'});
    tick();

    expectDraft(http, 'GET').flush(DRAFT, {headers: {ETag: '"R"'}});
    tick();

    const retry = expectDraft(http, 'PUT');
    expect(retry.request.headers.get('If-Match')).toBe('"R"');
    expect(retry.request.body as string).toContain('retry');
    retry.flush({scriptId: 1, draftVersion: 2, etag: '"R2"'});
    tick();
    expect(service.conflict()).toBeNull();
    expect(service.etag()).toBe('"R2"');
  }));

  it('never PUTs invalid JSON; it writes the last valid model instead', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, DRAFT, '"A"');

    service.setText('{"name": broken');
    expect(service.dirty()).toBe(true);
    expect(service.text()).toBe(DRAFT);

    void service.flush();
    const invalidAttempt = expectDraft(http, 'PUT');
    expect(invalidAttempt.request.body).toBe(DRAFT);
    expect(invalidAttempt.request.body as string).not.toContain('broken');
    invalidAttempt.flush(WRITE_OK);
    tick();
    // The operator's invalid text is still unsaved, so the draft stays dirty.
    expect(service.dirty()).toBe(true);
    expect(service.sourceText()).toBe('{"name": broken');

    service.setText('{"name":"valid","sections":[]}');
    void service.flush();
    const validAttempt = expectDraft(http, 'PUT');
    expect(validAttempt.request.body).toBe('{"name":"valid","sections":[]}');
    validAttempt.flush({scriptId: 1, draftVersion: 3, etag: '"C"'});
    tick();
    expect(service.dirty()).toBe(false);
  }));

  it('backs up unacked changes, restores them on load and clears them on ack', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http, DRAFT, '"A"');

    service.setValue('name', ['name'], 'backed-up');
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith('spr-script-draft'));
    expect(backupKey).toBeDefined();
    expect(localStorage.getItem(backupKey!)).toContain('backed-up');

    // Simulate a crash/reload: the server still has the original text.
    loadDraft(service, http, DRAFT, '"A"');
    expect(service.dirty()).toBe(true);
    expect(service.sourceText()).toContain('backed-up');
    expect(service.text()).toContain('backed-up');

    void service.flush();
    const restoring = expectDraft(http, 'PUT');
    expect(restoring.request.body as string).toContain('backed-up');
    restoring.flush(WRITE_OK);
    tick();
    expect(localStorage.getItem(backupKey!)).toBeNull();
    expect(service.dirty()).toBe(false);
  }));

  it('disables writes in FILES mode but still shows the draft as locally modified', fakeAsync(() => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});
    expect(service.writesDisabled()).toBe(true);

    void service.load('Demo1', 1);
    http.expectOne((request) => request.method === 'GET' && pathOf(request.urlWithParams).endsWith('/script/1/draft.json'))
      .flush(DRAFT, {headers: {ETag: ETAG_A}});
    tick();

    service.setValue('name', ['name'], 'local-only');
    expect(service.dirty()).toBe(true);

    void service.flush();
    tick(2500);
    http.expectNone((request) => request.method === 'PUT');
    expect(service.dirty()).toBe(true);
  }));

  it('coalesces undo snapshots per focused field and caps the history', fakeAsync(() => {
    const {service, http} = setup();
    loadDraft(service, http);

    service.setValue('name', ['name'], 'b');
    service.setValue('name', ['name'], 'c');
    expect(service.canUndo()).toBe(true);
    service.undo();
    expect(service.model()?.name).toBe('x');
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(true);
    service.redo();
    expect(service.model()?.name).toBe('c');

    // Distinct focuses snapshot each time, capped at 50.
    for (let i = 0; i < 60; i++) {
      service.setValue(`field-${i}`, ['name'], `v${i}`);
    }
    let undone = 0;
    while (service.undo()) {
      undone++;
    }
    expect(undone).toBe(50);

    void service.flush();
    expectDraft(http, 'PUT').flush(WRITE_OK);
    tick();
  }));
});
