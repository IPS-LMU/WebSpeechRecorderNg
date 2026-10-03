import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, Script, SpeechRecorderConfig} from 'speechrecorderng';
import {map, Observable} from 'rxjs';
import {apiPath, normaliseApiEndPoint, projectPath, QueryParam, withQuery} from './api-base';
import {RecorderVersion, ScriptSummary} from './script.model';

/** `GET project/{p}/script/{id}/draft` — the stored bytes verbatim plus the strong `ETag`. */
export interface DraftReadResult {
  /** The draft exactly as stored; unknown keys and their order must survive a round trip. */
  text: string;
  /** The strong validator (`"4-17"`), or `null` when the response carried none. */
  etag: string | null;
}

/** The body a draft write returns (`rest-api.md` §2.3); the `ETag` header repeats `etag`. */
export interface DraftWriteResult {
  scriptId: string | number;
  draftVersion: number;
  etag: string;
}

/**
 * Script API. Read endpoints (rest-api.md §1.1, §2.1) plus the draft's conditional read/write
 * (§2.3), which is what `ScriptDraftService` drives. Create/publish/versions/metadata belong to
 * their own slices of M3.
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

  /**
   * `GET project/{p}/script/{id}/draft` — the stored bytes and their strong validator. The body is
   * read as text so a round trip cannot reorder or normalise it (rest-api.md §2.3).
   */
  readDraft(projectId: string, scriptId: string | number): Observable<DraftReadResult> {
    const url = projectPath(this.base, projectId, 'script', scriptId, 'draft');
    return this.http.get(withQuery(url, this.config), {
      withCredentials: this.withCredentials,
      observe: 'response',
      responseType: 'text',
    }).pipe(map((response) => ({text: response.body ?? '', etag: response.headers.get('ETag')})));
  }

  /**
   * `PUT project/{p}/script/{id}/draft` with `If-Match` (rest-api.md §2.3). The body is sent as
   * received text, never re-serialised here. A missing precondition is the server's `428`; a stale
   * one its `412` with the current draft in `details.current`.
   */
  writeDraft(projectId: string, scriptId: string | number, text: string, ifMatch: string | null): Observable<DraftWriteResult> {
    const url = projectPath(this.base, projectId, 'script', scriptId, 'draft');
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (ifMatch !== null && ifMatch !== '') {
      headers['If-Match'] = ifMatch;
    }
    return this.http.put<DraftWriteResult>(withQuery(url, this.config), text, {
      withCredentials: this.withCredentials,
      headers,
    });
  }

  private get<T>(url: string, params?: QueryParam[]): Observable<T> {
    return this.http.get<T>(withQuery(url, this.config, params), {withCredentials: this.withCredentials});
  }
}
