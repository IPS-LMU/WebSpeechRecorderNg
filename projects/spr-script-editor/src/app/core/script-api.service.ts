import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, Script, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {apiPath, normaliseApiEndPoint, projectPath, QueryParam, withQuery} from './api-base';
import {RecorderVersion, ScriptSummary} from './script.model';

/**
 * Read endpoints of the script API (rest-api.md §1.1, §2.1). Write endpoints (create, draft,
 * publish, versions) arrive in M3; this service is read-only for M2.
 */
@Injectable()
export class ScriptApiService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /** `GET {api}version` — the recorder version the deployment serves. */
  version(): Observable<RecorderVersion> {
    return this.get<RecorderVersion>(apiPath(this.base, 'version'));
  }

  /** `GET project/{p}/script` — the library list. */
  list(projectId: string): Observable<ScriptSummary[]> {
    return this.get<ScriptSummary[]>(projectPath(this.base, projectId, 'script'));
  }

  /** `GET script/{id}` — the latest published version of one script. */
  getScript(scriptId: string | number): Observable<Script> {
    return this.get<Script>(apiPath(this.base, 'script', scriptId));
  }

  private get<T>(url: string, params?: QueryParam[]): Observable<T> {
    return this.http.get<T>(withQuery(url, this.config, params), {withCredentials: this.withCredentials});
  }
}
