/**
 * The one write the resolved-draws screen performs: re-drawing an unstarted session
 * (`POST project/{p}/session/{s}/draws/_redraw`, rest-api §4.3).
 *
 * Read methods stay in `core/draw-api.service.ts`; this slice-local service adds only the write, so
 * no shared service another slice is editing has to move. It follows the same URL rules
 * (`api-base.ts`) as the read services.
 */
import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, withQuery} from '../core/api-base';
import type {SessionDrawTrace} from '../core/script.model';

@Injectable({providedIn: 'root'})
export class DrawsService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /**
   * Re-resolves the session from its **original** script id and answers the new trace. The receiver
   * refuses anything but a `CREATED` session with `409 SESSION_ALREADY_STARTED`, and a script with
   * no bank source with `409 NO_BANK_SOURCES`; the screen disables the action in the first case
   * instead of letting it fail.
   */
  redraw(projectId: string, sessionId: string | number): Observable<SessionDrawTrace> {
    return this.http.post<SessionDrawTrace>(
      withQuery(projectPath(this.base, projectId, 'session', sessionId, 'draws', '_redraw'), this.config),
      {},
      {withCredentials: this.withCredentials},
    );
  }
}
