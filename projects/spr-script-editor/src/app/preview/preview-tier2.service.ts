/**
 * Tier-2 dry run: `POST project/{p}/script/{id}/preview-session` (rest-api §6, plan M4 row
 * "E4 tier-2 preview").
 *
 * The receiver answers `201 {sessionId, expires}` and creates a `type: "TEST"` session over a
 * materialised copy of the draft (or a version). It never touches the source, and the session's
 * recordings cannot be uploaded anywhere. The editor only creates the session and opens it.
 */
import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, withQuery} from '../core/api-base';

/** `201` body of `POST …/script/{id}/preview-session`. */
export interface PreviewSession {
  sessionId: string;
  expires: string;
}

/** `'draft'` or a published version number (rest-api §6). */
export type PreviewVersion = 'draft' | number;

@Injectable({providedIn: 'root'})
export class PreviewTier2Service {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  start(projectId: string, scriptId: string | number, version: PreviewVersion = 'draft'): Observable<PreviewSession> {
    return this.http.post<PreviewSession>(
      withQuery(projectPath(this.base, projectId, 'script', scriptId, 'preview-session'), this.config),
      {version},
      {withCredentials: this.withCredentials},
    );
  }
}
