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
 * record against. Each entry names a session that exists in the data the app is served with.
 */
export interface RecordingConfiguration {
  id: string;
  sessionId: string | number;
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
    if (this.selected) {
      this.router.navigate(['/spr/session', this.selected.sessionId]);
    }
  }

  openManual(): void {
    const id = this.manualId.trim();
    if (id !== '') {
      this.router.navigate(['/spr/session', id]);
    }
  }
}
