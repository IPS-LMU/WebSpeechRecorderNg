import {Component, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {TranslocoService} from '@jsverse/transloco';
import {environment} from '../../environments/environment';

/**
 * A stored recording configuration the user can pick and try out.
 *
 * The catalogue lives next to the application (`assets/configurations.json`), so a standalone
 * install — one that is not served with a recording procedure script — still offers something to
 * record against. An entry either names a session that already exists in the data the app is
 * served with (`sessionId`), or names a script from the bank (`script`), in which case a fresh
 * session bound to that script is started on every pick (see `freshSessionId` and the
 * evaluation receiver's `autoCreate`, `server/api.mjs`).
 */
export interface RecordingConfiguration {
  id: string;
  sessionId?: string | number;
  script?: string;
  project?: string;
  name: Record<string, string>;
  description?: Record<string, string>;
}

@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  styleUrls: ['sessions.css'],
  standalone: false
})
export class SessionsComponent implements OnInit {

  configurations: Array<RecordingConfiguration> = [];
  selected: RecordingConfiguration | null = null;
  manualId = '';
  loadError = false;

  constructor(private http: HttpClient, private router: Router, private transloco: TranslocoService) {}

  ngOnInit(): void {
    const url = environment.configurationCatalogUrl ?? 'assets/configurations.json';
    this.http.get<Array<RecordingConfiguration>>(url).subscribe({
      next: (catalogue) => {
        this.configurations = Array.isArray(catalogue) ? catalogue : [];
      },
      error: () => {
        this.loadError = true;
      }
    });
  }

  /** The catalogue entry is localised; fall back to English, then to the first name, then the id. */
  labelOf(configuration: RecordingConfiguration): string {
    const lang = this.transloco.getActiveLang();
    return configuration.name[lang]
      ?? configuration.name['en']
      ?? configuration.name[Object.keys(configuration.name)[0]]
      ?? configuration.id;
  }

  descriptionOf(configuration: RecordingConfiguration): string {
    if (!configuration.description) {
      return '';
    }
    const lang = this.transloco.getActiveLang();
    return configuration.description[lang] ?? configuration.description['en'] ?? '';
  }

  openSelected(): void {
    if (!this.selected) {
      return;
    }
    const target = this.selected.sessionId ?? this.freshSessionId(this.selected);
    this.router.navigate(['/spr/session', target]);
  }

  /**
   * A session id the evaluation receiver has never seen, encoding which script it should bind to
   * (`{scriptId}--{uuid}`, decoded by `autoCreate` in `server/api.mjs`) — a protocol picked from
   * the bank always starts a clean session instead of reusing one shared slot.
   */
  private freshSessionId(configuration: RecordingConfiguration): string {
    return `${configuration.script}--${crypto.randomUUID()}`;
  }

  openManual(): void {
    const id = this.manualId.trim();
    if (id !== '') {
      this.router.navigate(['/spr/session', id]);
    }
  }
}
