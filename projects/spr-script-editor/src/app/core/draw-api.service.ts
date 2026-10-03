import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, QueryParam, withQuery} from './api-base';
import {DrawPage, SessionDrawTrace} from './script.model';

export interface ScriptDrawsQuery {
  version?: number;
  limit?: number;
  offset?: number;
  includePreview?: boolean;
}

/**
 * Draw record read endpoints (rest-api.md §4.2). Draws are resolved by the server, at session
 * creation; the editor never resolves one and only reads the trace.
 */
@Injectable()
export class DrawApiService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /** `GET project/{p}/session/{sessionId}/draws` — the session trace (prefills + bankDraws). */
  sessionDraws(projectId: string, sessionId: string | number): Observable<SessionDrawTrace> {
    return this.get<SessionDrawTrace>(projectPath(this.base, projectId, 'session', sessionId, 'draws'));
  }

  /** `GET project/{p}/script/{scriptId}/draws` — the draw record view (ui-spec §7). */
  scriptDraws(projectId: string, scriptId: string | number, query: ScriptDrawsQuery = {}): Observable<DrawPage> {
    const params: QueryParam[] = [];
    if (query.version !== undefined) params.push({name: 'version', value: query.version});
    if (query.limit !== undefined) params.push({name: 'limit', value: query.limit});
    if (query.offset !== undefined) params.push({name: 'offset', value: query.offset});
    if (query.includePreview !== undefined) params.push({name: 'includePreview', value: query.includePreview});
    return this.get<DrawPage>(projectPath(this.base, projectId, 'script', scriptId, 'draws'), params);
  }

  private get<T>(url: string, params?: QueryParam[]): Observable<T> {
    return this.http.get<T>(withQuery(url, this.config, params), {withCredentials: this.withCredentials});
  }
}
