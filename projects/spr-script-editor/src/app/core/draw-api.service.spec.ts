import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {DrawApiService} from './draw-api.service';

function setup(config: SpeechRecorderConfig) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: config},
      DrawApiService,
    ],
  });
  return {
    service: TestBed.inject(DrawApiService),
    http: TestBed.inject(HttpTestingController),
  };
}

/** `HttpRequest.url` keeps the query string; match on the path and parse the query separately. */
function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

function queryOf(urlWithParams: string): URLSearchParams {
  return new URLSearchParams(urlWithParams.split('?')[1] ?? '');
}

describe('DrawApiService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reads the session trace', () => {
    const {service, http} = setup({apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1});

    service.sessionDraws('Demo1', 2042).subscribe();

    http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/session/2042/draws').flush({});
  });

  it('reads the script-scoped draw record with its query, in FILES mode', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});

    service.scriptDraws('Demo1', 1245, {version: 3, limit: 50, offset: 0, includePreview: true}).subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'test/project/Demo1/script/1245/draws.json');
    const query = queryOf(request.request.urlWithParams);
    expect(query.get('version')).toBe('3');
    expect(query.get('limit')).toBe('50');
    expect(query.get('offset')).toBe('0');
    expect(query.get('includePreview')).toBe('true');
    expect(query.has('requestUUID')).toBe(true);
    request.flush({total: 0, rows: []});
  });
});
