import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath, withQuery} from './api-base';
import {MediaEntry, MediaUsedBy} from './script.model';

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

  /**
   * `POST project/{p}/media` with `X-Filename` (rest-api.md §5): the clip is stored under the
   * project and its `durationMs` comes back for the timeline and W05. A name a published version
   * references is refused with `409 MEDIA_IN_USE`, like a delete. The upload happens immediately
   * and outside the draft's undo stack (B1) — the caller warns while the file is unreferenced.
   */
  upload(projectId: string, blob: Blob, filename: string): Observable<MediaUploadResult> {
    return this.http.post<MediaUploadResult>(
      projectPath(this.base, projectId, 'media'),
      blob,
      {
        headers: {
          'Content-Type': blob.type === '' ? 'application/octet-stream' : blob.type,
          'X-Filename': filename,
        },
        withCredentials: this.withCredentials,
      },
    );
  }

  /**
   * `DELETE project/{p}/media/{name}` (rest-api.md §5). `src` is the draft's `media/foo.wav`; the
   * route takes the basename. A file a **published** version references is refused with
   * `409 MEDIA_IN_USE`, whose body lists the users; a draft-only reference is returned instead.
   */
  remove(projectId: string, src: string): Observable<MediaDeleteResult> {
    const name = src.split('/').pop() ?? src;
    return this.http.delete<MediaDeleteResult>(
      projectPath(this.base, projectId, 'media', name),
      {withCredentials: this.withCredentials},
    );
  }

  /**
   * D-G fallback when the server could not measure a clip: decode it with an editor-local
   * `HTMLMediaElement` (never Web Audio, README §3). `null` when the environment or the file
   * cannot produce metadata — the timeline and W05 then say "unknown".
   */
  async measureDurationMs(blob: Blob): Promise<number | null> {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null;
    }
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise<number | null>((resolve) => {
        const element = document.createElement('audio');
        const done = (value: number | null) => {
          element.removeAttribute('src');
          resolve(value);
        };
        element.preload = 'metadata';
        element.addEventListener('loadedmetadata', () => {
          const seconds = element.duration;
          done(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null);
        });
        element.addEventListener('error', () => done(null));
        element.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** `POST project/{p}/media` response (rest-api.md §5). `durationMs` is `null` when unmeasurable. */
export interface MediaUploadResult {
  src: string;
  mimetype?: string;
  durationMs?: number | null;
  bytes?: number;
}

/** `DELETE project/{p}/media/{name}` response; `usedBy` lists draft-only users. */
export interface MediaDeleteResult {
  src: string;
  deleted: boolean;
  usedBy?: MediaUsedBy[];
}
