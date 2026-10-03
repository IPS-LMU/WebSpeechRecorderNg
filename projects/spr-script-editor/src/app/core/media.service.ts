import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, withQuery} from './api-base';
import {MediaEntry} from './script.model';

/**
 * Playback media read endpoint (rest-api.md §5). Playback files are project resources; upload and
 * delete are M3 write endpoints.
 */
@Injectable()
export class MediaService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /** `GET project/{p}/media` — the project's media with `usedBy` (feeds W11). */
  list(projectId: string): Observable<MediaEntry[]> {
    return this.http.get<MediaEntry[]>(
      withQuery(projectPath(this.base, projectId, 'media'), this.config),
      {withCredentials: this.withCredentials},
    );
  }
}
