import {Routes} from '@angular/router';
import {DEFAULT_PROJECT} from './editor.config';
import {ScriptLibrary} from './library/script-library';

/**
 * Editor routes (ui-spec §1). The selected node of the editor lives in `?sel=`; every route is
 * deep-linkable so a reload restores the view.
 *
 * Screens owned by later slices mount lazily through the shared `NotYetBuilt` placeholder; those
 * slices replace the target under `app/editor/…`, `app/source/…`, `app/bank/…`, `app/draws/…` and
 * `app/preview/…` (README §4.2).
 */
const notYetBuilt = () => import('./core/not-yet-built').then((m) => m.NotYetBuilt);
const editorScreen = () => import('./editor/editor-screen').then((m) => m.EditorScreen);
const jsonSource = () => import('./source/json-source').then((m) => m.JsonSource);
const bankBrowser = () => import('./bank/bank-browser').then((m) => m.BankBrowser);
const drawsView = () => import('./draws/draws-view').then((m) => m.DrawsView);

export const APP_ROUTES: Routes = [
  {path: '', pathMatch: 'full', redirectTo: `project/${DEFAULT_PROJECT}/script`},

  // ui-spec §2
  {path: 'project/:p/script', component: ScriptLibrary, title: 'Script library'},

  // ui-spec §3 — the selected node is in `?sel=`
  {path: 'project/:p/script/:id/edit', loadComponent: editorScreen, title: 'Script editor'},
  // ui-spec §4
  {path: 'project/:p/script/:id/preview',
   loadComponent: () => import('./preview/script-preview').then((m) => m.ScriptPreview),
   title: 'Preview'},
  // ui-spec §5
  {path: 'project/:p/script/:id/source', loadComponent: jsonSource, title: 'JSON source'},
  // ui-spec §6
  {path: 'project/:p/script/:id/bank/:groupRef', loadComponent: bankBrowser, title: 'Item bank'},
  // ui-spec §7
  {path: 'project/:p/script/:id/draws', loadComponent: drawsView, title: 'Resolved draws'},

  // Project-scoped entry points that are not tied to one script (ui-spec §1/§2). A source view is
  // always per script, so the project-scoped form goes to the library instead of a placeholder.
  {path: 'project/:p/source', redirectTo: 'project/:p/script', pathMatch: 'full'},
  {path: 'project/:p/bank', loadComponent: bankBrowser, title: 'Item banks'},
  {path: 'project/:p/draws', loadComponent: drawsView, title: 'Resolved draws'},

  {path: '**', redirectTo: ''},
];
