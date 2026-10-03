import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {MediaService} from './media.service';

function setup(config: SpeechRecorderConfig) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: config},
      MediaService,
    ],
  });
  return {
    service: TestBed.inject(MediaService),
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

describe('MediaService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reads the project media list', () => {
    const {service, http} = setup({apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1});

    service.list('Demo1').subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/media');
    expect(queryOf(request.request.urlWithParams).toString()).toBe('');
    request.flush([]);
  });

  it('uses the FILES-mode suffix in development', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});

    service.list('Demo1').subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'test/project/Demo1/media.json');
    expect(queryOf(request.request.urlWithParams).has('requestUUID')).toBe(true);
    request.flush([]);
  });
});
