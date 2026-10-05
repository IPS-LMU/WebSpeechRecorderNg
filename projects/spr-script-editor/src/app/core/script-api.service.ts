import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, Script, SpeechRecorderConfig, minRecorderVersionFor} from 'speechrecorderng';
import {map, Observable, switchMap} from 'rxjs';
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

/** `POST …/publish` (rest-api.md §2.4). */
export interface PublishResult {
  version: number;
  publishedDate?: string;
  minRecorderVersion?: string | null;
}

/** One row of `GET …/version` (rest-api.md §2.5). */
export interface ScriptVersion {
  version: number;
  publishedDate?: string;
  publishedBy?: string;
  note?: string;
  /** Session count is joined from the library list's `sessions.byVersion` (D5), not this endpoint. */
  sessions?: number;
}

/** `POST …/script` (rest-api.md §2.2). The receiver returns ids and the `ETag`, not the body. */
export interface CreateScriptResult {
  scriptId: string | number;
  draftVersion: number;
  etag: string;
}

/** The metadata `PATCH …/script/{id}` changes (rest-api.md §2.6). */
export interface ScriptPatch {
  name?: string;
  archived?: boolean;
}

/** The publisher's note and the exact draft the publish must freeze (rest-api.md §2.4). */
export interface PublishBody {
  fromDraftEtag: string;
  note?: string;
}

/** `POST …/script` body; `from` duplicates an existing script (rest-api.md §2.2). */
export interface CreateScriptBody {
  name?: string;
  from?: {scriptId: string | number; version?: number};
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

  /**
   * `PUT project/{p}/script/{id}/draft` with `If-None-Match: *` (rest-api.md §2.3): the create form
   * for a script that has published versions and no draft yet — what the receiver's legacy
   * migration leaves behind (`server/draft.test.mjs`). `If-None-Match: *` asserts emptiness, so the
   * server answers `412` if a draft appeared meanwhile and this can never overwrite one.
   */
  createDraft(projectId: string, scriptId: string | number, text: string): Observable<DraftReadResult> {
    const url = projectPath(this.base, projectId, 'script', scriptId, 'draft');
    return this.http.put<DraftWriteResult>(withQuery(url, this.config), text, {
      withCredentials: this.withCredentials,
      headers: {'Content-Type': 'application/json', 'If-None-Match': '*'},
    }).pipe(switchMap(() => this.readDraft(projectId, scriptId)));
  }

  /**
   * `POST project/{p}/script/{id}/publish` (rest-api.md §2.4). `fromDraftEtag` is the publisher's
   * `If-Match`: the server freezes exactly that draft or answers `409` with `details.checks`
   * (errors) or `FEATURE_FLOOR_UNKNOWN`.
   */
  publish(projectId: string, scriptId: string | number, body: PublishBody): Observable<PublishResult> {
    const url = projectPath(this.base, projectId, 'script', scriptId, 'publish');
    return this.http.post<PublishResult>(url, body, {withCredentials: this.withCredentials});
  }

  /** `GET project/{p}/script/{id}/version` — the version index, newest first. */
  versions(projectId: string, scriptId: string | number): Observable<ScriptVersion[]> {
    return this.get<ScriptVersion[]>(projectPath(this.base, projectId, 'script', scriptId, 'version'));
  }

  /** `GET project/{p}/script/{id}/version/{n}` — one published version. */
  publishedVersion(projectId: string, scriptId: string | number, n: number | string): Observable<Script> {
    return this.get<Script>(projectPath(this.base, projectId, 'script', scriptId, 'version', n));
  }

  /**
   * `POST …/draft/_restore {version}` with `If-Match` (rest-api.md §2.5). The receiver answers
   * `{scriptId, draftVersion, etag}` — rest-api claims it echoes the draft, it does not — so a
   * follow-up `GET draft` supplies the bytes the draft service adopts.
   */
  restoreVersion(projectId: string, scriptId: string | number, version: number | string, ifMatch: string | null): Observable<DraftReadResult> {
    const url = projectPath(this.base, projectId, 'script', scriptId, 'draft', '_restore');
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (ifMatch !== null && ifMatch !== '') {
      headers['If-Match'] = ifMatch;
    }
    return this.http.post<CreateScriptResult>(url, {version}, {headers, withCredentials: this.withCredentials}).pipe(
      switchMap(() => this.readDraft(projectId, scriptId)),
    );
  }

  /** `PATCH project/{p}/script/{id}` — name and/or archive flag (rest-api.md §2.6). */
  patchScript(projectId: string, scriptId: string | number, patch: ScriptPatch): Observable<ScriptSummary> {
    const url = projectPath(this.base, projectId, 'script', scriptId);
    return this.http.patch<ScriptSummary>(url, patch, {withCredentials: this.withCredentials});
  }

  /** `POST project/{p}/script` — a new draft, optionally duplicated from `from` (rest-api.md §2.2). */
  createScript(projectId: string, body: CreateScriptBody = {}): Observable<CreateScriptResult> {
    return this.http.post<CreateScriptResult>(projectPath(this.base, projectId, 'script'), body, {
      withCredentials: this.withCredentials,
    });
  }

  /** `POST` with `{from}` — rest-api.md §2.2's duplicate. */
  duplicate(projectId: string, from: {scriptId: string | number; version?: number}, name?: string): Observable<CreateScriptResult> {
    return this.createScript(projectId, name === undefined ? {from} : {name, from});
  }

  /**
   * The feature floor the draft needs, from the library's `minRecorderVersionFor`/`FEATURE_VERSIONS`
   * (script-api consumers must never re-derive the table); `null` when no feature has a floor.
   */
  minRecorderVersion(script: unknown): string | null {
    return minRecorderVersionFor(script as Script | null | undefined);
  }

  private get<T>(url: string, params?: QueryParam[]): Observable<T> {
    return this.http.get<T>(withQuery(url, this.config, params), {withCredentials: this.withCredentials});
  }
}
