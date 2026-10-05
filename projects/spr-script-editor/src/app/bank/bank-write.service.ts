/**
 * Bank **write** endpoints (rest-api.md §3.3): create or copy a bank and upsert/delete an item.
 * `BankApiService` is read-only and is not extended here; a bank item’s model recording is uploaded
 * through the shared `MediaService.upload` (rest-api.md §5), not through this service.
 *
 * The receiver is last-write-wins for banks (no validator); the caller reloads the bank after each
 * write. Writes are impossible in `ApiType.FILES` mode, where the screens disable them.
 */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import type {Bank, BankItem} from 'speechrecorderng';
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from 'speechrecorderng';
import {Observable} from 'rxjs';
import {normaliseApiEndPoint, projectPath} from '../core/api-base';

/** The fields of an item this screen can write; the server sanitises the rest away. */
export type BankItemPatch = Partial<Pick<BankItem,
  'bankItemId' | 'text' | 'promptDoc' | 'src' | 'mimetype' | 'alt' | 'audioSrc' | 'audioMimetype'
  | 'category' | 'words' | 'tags'>>;

@Injectable()
export class BankWriteService {
  private readonly base: string;
  private readonly withCredentials: boolean;

  constructor(private readonly http: HttpClient,
              @Inject(SPEECHRECORDER_CONFIG) private readonly config?: SpeechRecorderConfig) {
    this.base = normaliseApiEndPoint(config);
    this.withCredentials = config?.withCredentials ?? false;
  }

  /** `POST project/{p}/bank` — a new empty bank, or a copy of an existing one (`copyFrom`). */
  create(projectId: string, body: {title?: string; copyFrom?: string}): Observable<Bank> {
    return this.http.post<Bank>(projectPath(this.base, projectId, 'bank'), body, {
      withCredentials: this.withCredentials,
    });
  }

  /** `POST` (new) or `PUT` (existing) `…/bank/{b}/item[/{id}]`. */
  saveItem(projectId: string, bankId: string, item: BankItemPatch, itemId?: string | null): Observable<BankItem> {
    const headers = new HttpHeaders({'Content-Type': 'application/json'});
    const options = {headers, withCredentials: this.withCredentials};
    if (itemId === undefined || itemId === null || itemId === '') {
      return this.http.post<BankItem>(projectPath(this.base, projectId, 'bank', bankId, 'item'), item, options);
    }
    return this.http.put<BankItem>(
      projectPath(this.base, projectId, 'bank', bankId, 'item', itemId), item, options);
  }

  /** `DELETE …/bank/{b}/item/{id}`. */
  deleteItem(projectId: string, bankId: string, itemId: string): Observable<{bankId: string; itemCount: number}> {
    return this.http.delete<{bankId: string; itemCount: number}>(
      projectPath(this.base, projectId, 'bank', bankId, 'item', itemId),
      {withCredentials: this.withCredentials},
    );
  }

  /**
   * `POST …/bank/{b}/_import` with `text/csv` (rest-api.md §3.3): columns `text,category,words,tags,
   * audio`, a header row when the first row names them. The receiver **appends** the parsed items and
   * answers what it took and what it refused, so the caller reloads the bank.
   */
  importCsv(projectId: string, bankId: string, csv: string): Observable<BankImportResult> {
    return this.http.post<BankImportResult>(
      projectPath(this.base, projectId, 'bank', bankId, '_import'),
      csv,
      {
        headers: new HttpHeaders({'Content-Type': 'text/csv'}),
        withCredentials: this.withCredentials,
      },
    );
  }
}

/** `200` body of `_import`: the counts, plus one entry per refused line. */
export interface BankImportResult {
  imported: number;
  skipped: number;
  errors: ReadonlyArray<{line: number; message: string}>;
}
