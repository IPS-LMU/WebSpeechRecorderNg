import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {Bank, BankItem, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, QueryParam, withQuery} from './api-base';
import {BankItemPage, BankItemQuery} from './script.model';

/**
 * Bank read endpoints (rest-api.md §3.1, §3.2). A bank list mixes the project's own banks with the
 * read-only banks that ship with the application; the caller distinguishes them by `source`.
 */
@Injectable()
export class BankApiService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /** `GET project/{p}/bank`. */
  list(projectId: string): Observable<Bank[]> {
    return this.get<Bank[]>(projectPath(this.base, projectId, 'bank'));
  }

  /**
   * `GET project/{p}/bank/{bankId}/item` — filtered items plus the `matchCount` the draw rule
   * validates `count` against (E04) and `withoutAudio` for W04. Filter semantics are frozen.
   */
  items(projectId: string, bankId: string, query: BankItemQuery = {}): Observable<BankItemPage> {
    const params: QueryParam[] = [];
    if (query.category !== undefined) params.push({name: 'category', value: query.category});
    if (query.minWords !== undefined) params.push({name: 'minWords', value: query.minWords});
    if (query.maxWords !== undefined) params.push({name: 'maxWords', value: query.maxWords});
    if (query.hasAudio !== undefined) params.push({name: 'hasAudio', value: query.hasAudio});
    if (query.tags !== undefined && query.tags.length > 0) params.push({name: 'tag', value: query.tags});
    if (query.q !== undefined) params.push({name: 'q', value: query.q});
    if (query.limit !== undefined) params.push({name: 'limit', value: query.limit});
    if (query.offset !== undefined) params.push({name: 'offset', value: query.offset});
    return this.get<BankItemPage>(projectPath(this.base, projectId, 'bank', bankId, 'item'), params);
  }

  private get<T>(url: string, params?: QueryParam[]): Observable<T> {
    return this.http.get<T>(withQuery(url, this.config, params), {withCredentials: this.withCredentials});
  }
}

export type {BankItem};
