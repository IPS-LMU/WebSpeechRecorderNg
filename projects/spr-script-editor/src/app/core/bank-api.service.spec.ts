import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {BankApiService} from './bank-api.service';

function setup(config: SpeechRecorderConfig) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: config},
      BankApiService,
    ],
  });
  return {
    service: TestBed.inject(BankApiService),
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

describe('BankApiService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reads the bank list in FILES mode', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});

    service.list('Demo1').subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank.json');
    expect(queryOf(request.request.urlWithParams).has('requestUUID')).toBe(true);
    request.flush([]);
  });

  it('serialises the frozen filter semantics, repeated tags included', () => {
    const {service, http} = setup({apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1});

    service.items('Demo1', 'std-passages', {
      category: 'sentence',
      minWords: 6,
      maxWords: 12,
      hasAudio: true,
      tags: ['balanced', 'vowel'],
      q: 'free text',
      limit: 50,
      offset: 0,
    }).subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank/std-passages/item');
    const query = queryOf(request.request.urlWithParams);
    expect(query.get('category')).toBe('sentence');
    expect(query.get('minWords')).toBe('6');
    expect(query.get('maxWords')).toBe('12');
    expect(query.get('hasAudio')).toBe('true');
    expect(query.getAll('tag')).toEqual(['balanced', 'vowel']);
    expect(query.get('q')).toBe('free text');
    expect(query.get('limit')).toBe('50');
    expect(query.get('offset')).toBe('0');
    request.flush({matchCount: 0, items: []});
  });

  it('appends the FILES-mode UUID after the filter query', () => {
    const {service, http} = setup({apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1});

    service.items('Demo1', 'std-passages', {q: 'vowel'}).subscribe();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'test/project/Demo1/bank/std-passages/item.json');
    const query = queryOf(request.request.urlWithParams);
    expect(query.get('q')).toBe('vowel');
    expect(query.has('requestUUID')).toBe(true);
    request.flush({matchCount: 0, items: []});
  });
});
