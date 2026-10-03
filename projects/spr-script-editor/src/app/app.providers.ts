import {type Provider} from '@angular/core';
import {provideAnimations} from '@angular/platform-browser/animations';
import {ProjectService, SPEECHRECORDER_CONFIG, ScriptService} from 'speechrecorderng';
import {BankApiService} from './core/bank-api.service';
import {DrawApiService} from './core/draw-api.service';
import {MediaService} from './core/media.service';
import {ScriptApiService} from './core/script-api.service';
import {EDITOR_CFG} from './editor.config';

/**
 * The app-scoped providers of the editor (README §4.3): the library injectables the views read, the
 * editor's own API services and the deployment configuration. `main.ts` bootstraps with these, and
 * a route-level spec reuses the same list, so a view that injects something the application does not
 * provide fails in the suite instead of only in the browser (NG0201, the `DrawsService` miss).
 *
 * Services that are stateless and genuinely app-wide register themselves with
 * `providedIn: 'root'` (`ScriptDraftService`, `EditorFindingsService`, `DrawsService`,
 * `PreviewTier2Service`) and are deliberately absent here: a route must not have to list them.
 */
export const EDITOR_PROVIDERS: Provider[] = [
  provideAnimations(),
  {provide: SPEECHRECORDER_CONFIG, useValue: EDITOR_CFG},
  ProjectService,
  ScriptService,
  ScriptApiService,
  BankApiService,
  DrawApiService,
  MediaService,
];
