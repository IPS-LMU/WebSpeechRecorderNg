import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {ScriptApiService} from './script-api.service';

function setup(config: SpeechRecorderConfig) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: config},
      ScriptApiService,
    ],
  });
  return {
    service: TestBed.inject(ScriptApiService),
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

describe('ScriptApiService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('builds the library list URL and the FILES-mode suffix in development', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1, withCredentials: true});

    service.list('Demo1').subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'test/project/Demo1/script.json');
    expect(queryOf(request.request.urlWithParams).has('requestUUID')).toBe(true);
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('builds the same paths relative to the REST base in production', () => {
    const {service, http} = setup({apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1, withCredentials: true});

    service.list('Demo1').subscribe();
    service.version().subscribe();
    service.getScript(1245).subscribe();

    const list = http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/script');
    expect(queryOf(list.request.urlWithParams).toString()).toBe('');
    list.flush([]);

    http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/version').flush({recorderVersion: '3.11.26'});
    http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/script/1245').flush({sections: []});
  });

  it('reads one script from the fixtures in FILES mode', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});

    service.getScript(1245).subscribe();

    http.expectOne((req) => pathOf(req.urlWithParams) === 'test/script/1245.json').flush({scriptId: 1245, sections: []});
  });
});
