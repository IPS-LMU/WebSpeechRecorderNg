import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, type TestRequest} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {PreviewTier2Panel} from './preview-tier2-panel';
import {describePreviewFailure, recorderSessionUrl, tier2Availability} from './preview-tier2';
import {PreviewTier2Service} from './preview-tier2.service';

interface Mounted {
  fixture: ComponentFixture<PreviewTier2Panel>;
  root: HTMLElement;
  http: HttpTestingController;
}

function mount(apiType: ApiType, recorderBaseUrl?: string): Mounted {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: 'api/v1', apiType, apiVersion: 1, withCredentials: true}},
      PreviewTier2Service,
    ],
  });
  const fixture = TestBed.createComponent(PreviewTier2Panel);
  fixture.componentRef.setInput('projectId', 'Demo1');
  fixture.componentRef.setInput('scriptId', 'demo');
  if (recorderBaseUrl !== undefined) {
    fixture.componentRef.setInput('recorderBaseUrl', recorderBaseUrl);
  }
  fixture.detectChanges();
  return {fixture, root: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController)};
}

function startRequest(http: HttpTestingController): TestRequest {
  return http.expectOne((request) => request.url.includes('/script/demo/preview-session'));
}

describe('tier-2 preview availability', () => {
  it('is enabled only when a receiver exists and the recorder has an address', () => {
    expect(tier2Availability(ApiType.NORMAL, '')).toEqual({enabled: true, reason: null});
    expect(tier2Availability(ApiType.NORMAL, 'http://127.0.0.1:8391')).toEqual({enabled: true, reason: null});
    // Fixture mode has no server to create the session.
    expect(tier2Availability(ApiType.FILES, '')).toEqual({enabled: false, reason: 'fixtures'});
    // No recorder base URL at all: nowhere to open the session.
    expect(tier2Availability(ApiType.NORMAL, undefined)).toEqual({enabled: false, reason: 'noRecorder'});
    expect(tier2Availability(undefined, undefined)).toEqual({enabled: false, reason: 'noRecorder'});
  });

  it('builds the recorder session url from the deployment base', () => {
    expect(recorderSessionUrl('', 'preview-9f2c')).toBe('/spr/session/preview-9f2c');
    expect(recorderSessionUrl('http://127.0.0.1:8391', 'preview-9f2c')).toBe('http://127.0.0.1:8391/spr/session/preview-9f2c');
    expect(recorderSessionUrl('http://host/wsr/ng/', 'preview 1')).toBe('http://host/wsr/ng/spr/session/preview%201');
  });

  it('maps the failure cases the receiver defines', () => {
    expect(describePreviewFailure(0, null)).toContain('could not be reached');
    expect(describePreviewFailure(404, {error: 'script demo has no draft to preview'})).toContain('no draft or version');
    expect(describePreviewFailure(404, {error: 'script demo has no draft to preview'})).toContain('has no draft to preview');
    expect(describePreviewFailure(403, {})).toContain('may not create a session');
    expect(describePreviewFailure(401, {})).toContain('may not create a session');
    expect(describePreviewFailure(409, {code: 'RECORDER_VERSION_TOO_OLD', message: 'too old'})).toContain('newer recorder');
    expect(describePreviewFailure(500, {message: 'boom'})).toContain('failed to create the session');
    expect(describePreviewFailure(418, {})).toContain('refused the request');
  });
});

describe('PreviewTier2Panel', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('stays disabled with the fixture-mode reason when the deployment reads development fixtures', () => {
    const state = mount(ApiType.FILES);

    const button = state.root.querySelector('.tier2-start') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(state.root.querySelector('.tier2-reason')?.textContent).toContain('development fixtures');
    // A disabled action must not touch the network.
    expect(state.http.match((request) => request.url.includes('preview-session'))).toHaveSize(0);
  });

  it('creates the dry-run session and shows the id, the expiry and the "nothing is uploaded" guarantee', () => {
    const state = mount(ApiType.NORMAL, 'http://127.0.0.1:8391');
    const button = state.root.querySelector('.tier2-start') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    button.click();
    const request = startRequest(state.http);
    expect(request.request.method).toBe('POST');
    expect(request.request.url).toContain('api/v1/project/Demo1/script/demo/preview-session');
    expect(request.request.body).toEqual({version: 'draft'});
    request.flush({sessionId: 'preview-9f2c', expires: '2026-10-03T18:33:01.431Z'});
    state.fixture.detectChanges();

    expect(state.root.querySelector('.tier2-result .tier2-facts')?.textContent).toContain('preview-9f2c');
    expect(state.root.querySelector('.tier2-result')?.textContent).toContain('2026-10-03T18:33:01.431Z');
    expect(state.root.querySelector('.tier2-guarantee')?.textContent).toContain('Nothing is uploaded');
    expect(state.root.querySelector('.tier2-guarantee')?.textContent).toContain('type "TEST"');
    const link = state.root.querySelector('.tier2-open') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('http://127.0.0.1:8391/spr/session/preview-9f2c');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('turns a 404 into the "no draft or version" message', () => {
    const state = mount(ApiType.NORMAL, '');
    (state.root.querySelector('.tier2-start') as HTMLButtonElement).click();
    startRequest(state.http).flush(
      {error: 'script demo has no draft to preview', message: 'script demo has no draft to preview'},
      {status: 404, statusText: 'Not Found'},
    );
    state.fixture.detectChanges();

    const error = state.root.querySelector('.tier2-error')?.textContent ?? '';
    expect(error).toContain('no draft or version');
    expect(error).toContain('has no draft to preview');
    expect(state.root.querySelector('.tier2-result')).toBeNull();
  });

  it('turns a 409 RECORDER_VERSION_TOO_OLD into its own message', () => {
    const state = mount(ApiType.NORMAL, '');
    (state.root.querySelector('.tier2-start') as HTMLButtonElement).click();
    startRequest(state.http).flush(
      {error: 'recorder too old', code: 'RECORDER_VERSION_TOO_OLD', message: 'recorder too old'},
      {status: 409, statusText: 'Conflict'},
    );
    state.fixture.detectChanges();

    expect(state.root.querySelector('.tier2-error')?.textContent).toContain('newer recorder');
  });

  it('turns a 500 into the server message and lets the user try again', () => {
    const state = mount(ApiType.NORMAL, '');
    (state.root.querySelector('.tier2-start') as HTMLButtonElement).click();
    startRequest(state.http).flush({error: 'boom'}, {status: 500, statusText: 'Server Error'});
    state.fixture.detectChanges();

    expect(state.root.querySelector('.tier2-error')?.textContent).toContain('boom');
    // The button is usable again.
    expect((state.root.querySelector('.tier2-start') as HTMLButtonElement).disabled).toBe(false);
  });

  it('explains the missing recorder address', () => {
    const state = mount(ApiType.NORMAL, '');
    // The dev environment sets `recorderBaseUrl: ''`, so simulate "not configured".
    state.fixture.componentRef.setInput('recorderBaseUrl', undefined);
    state.fixture.detectChanges();

    const button = state.root.querySelector('.tier2-start') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(state.root.querySelector('.tier2-reason')?.textContent).toContain('No recorder base URL');
  });
});
