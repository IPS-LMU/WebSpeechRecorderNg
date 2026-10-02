# Recording script editor — implementation guide

An online editor for recording scripts, built as a **second application in this Angular
workspace** that consumes the `speechrecorderng` library and talks to the same REST API as the
recorder.

Visual source of truth: the design canvas
<https://claude.ai/artifact/DAiLsAmG3cC2PXRSJbgQSe> (seven artboards: script library, editor,
speaker preview, JSON source and checks, prompt and playback variants, item bank and draw rule,
and the per-session draw record).

| Document | Contents |
|---|---|
| This file | decisions, architecture, workspace integration, deployment, milestones, testing |
| [data-model.md](data-model.md) | the script model as it is today and the additions the editor writes |
| [rest-api.md](rest-api.md) | every endpoint the editor needs, with request and response shapes |
| [ui-spec.md](ui-spec.md) | screen by screen: regions, data, interactions, accessibility |
| [validation.md](validation.md) | the check catalogue, severities and the publish gate |

## 1. Scope

In scope: authoring scripts (sections, groups, prompt items), authoring media played to the
speaker, authoring draw rules against item banks, previewing, validating, importing and
exporting JSON, publishing versions, and inspecting what each session drew.

Out of scope for this application: recording, uploading, annotating, and the recording-file
editor. Those stay in the recorder and in the library (`/spr/db/recordingfile/...`).

Two features drive most of the new work:

- **Media played to the speaker.** A prompt item can play audio or video before recording,
  inside the pre-recording delay, while recording runs, or on the speaker's request.
- **Items drawn at random from a bank.** A group can hold a draw rule instead of a fixed list.
  The draw is resolved once, when a session is created.

## 2. Decisions

Short records. Each is a decision already taken with the project owner; change them here if they
change in reality.

### D1 — The editor is a separate application in this workspace

**Context.** The library is a single eager `NgModule` that declares every component and
registers every route (`SPR_ROUTES` in
[speechrecorderng.module.ts](../../projects/speechrecorderng/src/lib/speechrecorderng.module.ts)).
Participants open the recorder by session URL, often on poor connections.

**Decision.** Add `projects/spr-script-editor` as a second application. It consumes the library
through its public API. The editor is never loaded into the participant's application.

**Consequences.** No bundle cost for participants; the editor can be protected by path in the
web server; each application keeps its own service-worker policy. Cost: a second build target
and a second application shell. Shared model types, theme and CI stay shared, because it is one
repository.

### D2 — Draws are resolved when a session is created

**Decision.** The server resolves every draw rule at session creation and stores the chosen
items with the session. Re-opening a session never reshuffles. A session that has started cannot
be re-drawn; an unstarted one can.

**Consequences.** The recorder needs **no** change for drawn groups: it receives a plain
resolved list of prompt items, exactly as today. Reproducibility holds even when the bank gains
items later. The editor needs a read-only view of resolved draws
([ui-spec.md](ui-spec.md) §7) and the server needs a draw record ([rest-api.md](rest-api.md) §4).

### D3 — Banks are project-local, except banks shipped with the application

**Decision.** An item bank belongs to a project and is edited there. Banks that ship with
SpeechRecorder are read-only in every installation and are copied into a project when a
researcher needs their own wording or their own recordings.

**Consequences.** A script that draws from a shipped bank can be reused in another installation.
An application upgrade may add items to a shipped bank, which widens later draws but never
changes a draw a session has already made (D2). Bank identity carries its source
(`bankSource: 'PROJECT' | 'BUILTIN'`).

### D4 — Playback is its own block on the prompt item

**Decision.** What the speaker **hears** is a `playback` object on the prompt item, separate from
`mediaitems`, which is what the speaker **sees**.

**Consequences.** An item can show nothing and still play something (listen-and-repeat), or show
a text and play a cue. Playback carries its own timing, which the recorder must honour before the
editor is useful (see milestone M1). Playback files are project resources, fetched the way image
prompts already are, so the recorder needs no new fetch mechanism.

### D5 — Scripts have drafts and published versions

**Decision.** Editing writes a draft. Publishing freezes a numbered version. New sessions get the
latest published version; started sessions keep theirs. Draft writes use `If-Match` so two
researchers cannot silently overwrite each other.

**Consequences.** The server needs version storage and an ETag on the draft. The recorder keeps
reading `GET script/{scriptId}`, which returns the latest published version.

### D6 — Preview has two tiers

**Decision.** Tier 1 is an editor-side mock of the stage (the Preview artboard): instant, steps
through items and phases, shows when the prompt appears and when a clip plays. Tier 2 is a dry
run of the real recorder against an ephemeral preview session with uploads disabled.

**Consequences.** Tier 1 risks drifting from the recorder. Mitigation: the prompt-visibility rule
and the timing arithmetic move into the library as pure functions and are used by both the
recorder and the editor (§5, M2).

### D7 — Legacy shapes are normalised on request, never silently

**Decision.** The editor keeps `prerecording`/`postrecording` and `RANDOMIZED` as it found them
and offers a one-click fix in the checks panel. Saving does not rewrite them on its own.

**Consequences.** Imported third-party scripts come back out unchanged unless a human asked for
the fix. See [validation.md](validation.md) N01, N02.

## 3. Architecture

```
projects/speechrecorderng   library (npm: speechrecorderng)
  ├── model types (script.ts …)      ← shared, single definition
  ├── services (ScriptService …)     ← shared HTTP conventions
  ├── theme (_palette, _tokens, theme.ts)
  └── recorder components            ← used by the recorder app only

src/                        recorder/demo application (participants)
projects/spr-script-editor  editor application (researchers)   ← new

                    both talk to the same REST API
```

The editor holds no recording code: no `AudioContext`, no uploader, no IndexedDB. It plays audio
only to audition a bank item or a playback clip, with the library's player.

## 4. Workspace integration

### 4.1 Project entry

Add to [angular.json](../../angular.json) under `projects`:

```json
"spr-script-editor": {
  "projectType": "application",
  "root": "projects/spr-script-editor",
  "sourceRoot": "projects/spr-script-editor/src",
  "prefix": "spre",
  "schematics": { "@schematics/angular:component": { "style": "scss" } },
  "architect": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "outputPath": { "base": "dist/spr-script-editor" },
        "index": "projects/spr-script-editor/src/index.html",
        "browser": "projects/spr-script-editor/src/main.ts",
        "polyfills": ["zone.js"],
        "tsConfig": "projects/spr-script-editor/tsconfig.app.json",
        "inlineStyleLanguage": "scss",
        "assets": ["projects/spr-script-editor/src/assets"],
        "styles": ["projects/spr-script-editor/src/main.scss"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "900kb", "maximumError": "1.5mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "all"
        },
        "development": { "optimization": false, "sourceMap": true }
      }
    },
    "serve": { "builder": "@angular/build:dev-server", "configurations": {
      "development": { "buildTarget": "spr-script-editor:build:development" } } },
    "test": { "builder": "@angular/build:karma",
      "options": { "polyfills": ["zone.js", "zone.js/testing"],
        "tsConfig": "projects/spr-script-editor:tsconfig.spec.json" } }
  }
}
```

The editor's budget is deliberately larger than the recorder's: it is a desktop tool for
researchers, not a field application. Keep the recorder's existing 500 kB / 1 MB budget
untouched — that is the point of D1.

Scripts in [package.json](../../package.json):

```json
"start_editor": "ng serve spr-script-editor --host=127.0.0.1 --configuration development",
"build_editor": "ng build spr-script-editor --configuration production",
"test_editor": "ng test spr-script-editor"
```

### 4.2 Source layout

```
projects/spr-script-editor/src/
  index.html
  main.ts                     bootstrapApplication + providers
  main.scss                   imports the library's theme partials (see 4.4)
  app/
    app.routes.ts
    shell/                    toolbar, breadcrumb, error and auth surfaces
    library/                  script list                     (ui-spec §2)
    editor/                   outline, centre, inspector       (ui-spec §3)
      outline/ items-table/ inspector/
    preview/                  tier 1 stage mock                (ui-spec §4)
    source/                   JSON view and checks             (ui-spec §5)
    bank/                     bank browser and draw rule       (ui-spec §6)
    draws/                    resolved draws per session       (ui-spec §7)
    core/
      script-draft.service.ts draft state, undo/redo, autosave
      script-api.service.ts   write endpoints (rest-api.md §2)
      bank-api.service.ts     banks and bank items (§3)
      draw-api.service.ts     resolved draws (§4)
      validation/             the check catalogue (validation.md)
      normalise.ts            D7 fixes, applied only on request
```

### 4.3 Bootstrapping, without importing the library module

`SpeechrecorderngModule` registers the recorder's routes and declares the recorder's components.
The editor must not import it. Provide the library's injectables directly:

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { SPEECHRECORDER_CONFIG, ProjectService, ScriptService } from 'speechrecorderng';
import { APP_ROUTES } from './app/app.routes';
import { AppShell } from './app/shell/app-shell';
import { EDITOR_CFG } from './app/editor.config';

bootstrapApplication(AppShell, {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    { provide: SPEECHRECORDER_CONFIG, useValue: EDITOR_CFG },
    ProjectService,
    ScriptService
  ]
});
```

`EDITOR_CFG` reuses `SpeechRecorderConfig`
([spr.config.ts](../../projects/speechrecorderng/src/lib/spr.config.ts)) so `apiEndPoint`,
`withCredentials`, `apiType` and `logLevel` behave exactly as in the recorder. Set
`enableUploadRecordings: false` and leave `uploadConfig` unset: the editor never uploads
recordings.

During development, point the editor at the file fixtures the repository already ships
(`apiType: ApiType.FILES`, fixtures in [src/test/script](../../src/test/script)). The read side of
the editor can then be built with no server at all. Write endpoints need a stub; a tiny
express or `json-server` process is enough and belongs in `bin/`, not in the application.

The editor uses Angular forms. Nothing in the repository does today, so fix the convention once:
**typed reactive forms** (`FormGroup`, `FormControl<T>`), never `ngModel`. The peer dependency is
already declared in
[projects/speechrecorderng/package.json](../../projects/speechrecorderng/package.json).

### 4.4 Theme

The editor must obey the same rule as the library: **no colour literals in components**, only
`var(--spr-*, <fallback>)`. `main.scss` mirrors [src/main.scss](../../src/main.scss): build the
Material theme from the brand ramps, then emit the tokens and the role pins at the top level.

```scss
@use '../../speechrecorderng/src/lib/theme/tokens' as spr;
// mat.theme(...) first, then:
@include spr.spr-token-styles(light);
@include spr.spr-token-styles(dark, ':root[data-spr-scheme="dark"]');
@include spr.spr-material-role-tokens();
```

The audit script takes a URL, so it covers the editor too:

```bash
node bin/theme_audit.mjs --url http://127.0.0.1:4300/edit/script/1245 \
  --viewports 1366x768,1920x1080
```

Add editor routes to the audit list used in CI, including one state behind an interaction (the
inspector with a draw rule selected) via a `bin/audit/*.js` fixture.

### 4.5 Deployment

Build to its own base href and serve it from a path the web server can protect, beside the
recorder:

```bash
ng build spr-script-editor --configuration production --base-href=/wsr/edit/
```

```
/wsr/ng/     recorder, public, session URLs handed to participants
/wsr/edit/   editor, behind authentication
/…           REST API
```

Reuse the SPA fallback pattern in
[apache_www_htaccess_sample.txt](../../apache_www_htaccess_sample.txt) for the new path. The
server authorises every write regardless of what the frontend shows: the path restriction reduces
attack surface, it is not the access control.

**No service worker.** The recorder has one so a participant can keep recording offline. The
editor must never serve a stale script, and `ng build` must not register a worker for this
application.

## 5. What has to be added to the library

Keep one definition of everything both applications need. Each row is a task.

| Need | Where it goes | Action |
|---|---|---|
| `Playback`, `Draw`, bank and resolved-draw types | `lib/speechrecorder/script/script.ts` | extend, export from `public-api.ts` ([data-model.md](data-model.md)) |
| Script write, publish, version endpoints | `ScriptService` | add methods; keep `scriptObservable` untouched |
| Banks, bank items, resolved draws | new `BankService`, `DrawService` in `lib/speechrecorder/bank/` | new, exported |
| Prompt visibility rule | new `lib/speechrecorder/script/phases.ts` | extract `promptVisibleAt(promptphase, phase, itemType)` from `sessionmanager.ts` and use it in both the recorder and the editor's preview (D6) |
| Item timing arithmetic | same file | extract `effectiveTiming(item)` returning pre, rec, post and playback spans, including the `prerecording`/`postrecording` fallbacks already in `sessionmanager.ts` |
| Playback execution | `sessionmanager.ts`, prompting components | recorder feature, milestone M1 |
| Audio audition in the editor | existing `AudioPlayer`, `AudioDisplay` | already exported |
| Theme partials and `sprToken()` | `lib/theme/*` | already there; the editor imports the SCSS directly |

Extracting the two pure functions is what keeps tier-1 preview honest. Unit-test them in the
library and let both applications depend on them rather than on each other.

## 6. Milestones

Each milestone ends with something demonstrable. The server work is called out per milestone
because it is the long pole.

**M0 — API agreement.** Walk [rest-api.md](rest-api.md) and
[data-model.md](data-model.md) with whoever owns the server. Settle: script write and versioning,
bank endpoints and the shipped-bank story, draw resolution at session creation, the draw record,
project resource upload for playback files. *Done when* the endpoint list and the JSON shapes are
agreed in writing, and this directory is updated to match.

**M1 — Recorder honours playback.** Library and recorder only, no editor. Implement `playback` in
the session manager and the prompting components for all four `when` values, the replay button,
the replay counter in the session log, and the headphone check before a section that plays sound.
*Done when* a hand-written script with playback runs correctly in the recorder, and the timing
functions from §5 are extracted and unit-tested.

**M2 — Editor skeleton, read-only.** The new application, the shell, the script library list, the
outline, the items table, the inspector rendering every field, and the tier-1 preview, all against
`ApiType.FILES` fixtures. No writes. *Done when* `1245.json` can be navigated and inspected, the
theme audit passes on two editor routes, and the validation catalogue runs over a loaded script.

**M3 — Write path.** Draft autosave with `If-Match`, undo and redo, the JSON view with import and
export, the checks panel with its fixes, publish with the error gate, version history. *Done when*
a script can be created, edited by two browsers without silent loss, published, and loaded by the
recorder.

**M4 — Banks and draws.** The bank browser, the draw-rule builder, project and shipped banks,
copy-to-project, the draw record view with CSV export, and the dry-run preview (tier 2) against a
preview session. *Done when* a drawn group produces a session whose items are recorded and
traceable to bank items, and re-opening that session shows identical items.

**M5 — Hardening.** Keyboard coverage and screen-reader pass on the editor
([ui-spec.md](ui-spec.md) §8), empty and error states, large-script performance (a 500-item
script must stay responsive in the outline and the table), i18n of the editor's own chrome if the
project needs it.

## 7. Testing

- **Unit (karma, the workspace's existing setup).** The validation catalogue, one spec per check
  id; the normaliser (D7) including idempotence; draw-rule serialisation; `promptVisibleAt` and
  `effectiveTiming` in the library, with the recorder's current behaviour as the oracle; the draft
  service's undo, redo and conflict handling.
- **Fixtures.** Extend [src/test/script](../../src/test/script) with a script that uses playback
  and a drawn group, and keep a copy of a pre-3.12 script to prove nothing normalises on its own.
- **Theme audit.** Editor routes in the CI list, light and dark, including one interaction state.
- **Manual, per milestone.** Dry-run a session end to end in the recorder after every change to
  the model, because the editor's job is to produce files another application must interpret.

## 8. Open questions

1. Who owns the server endpoints — upstream in Munich, or a local service for this deployment? M0
   cannot close without an answer, and the answer may split scripts (upstream) from banks and
   draws (local).
2. The script entity has no name field today
   ([session.ts](../../projects/speechrecorderng/src/lib/speechrecorder/session/session.ts) and
   the script JSON carry only ids). The library list needs one; agree whether it lives on the
   script or in a project-level index.
3. Do shipped banks ship inside the npm package, with the server, or as a separate data release?
   This decides how `bankSource: 'BUILTIN'` items are fetched.
4. The draw record shows which speaker recorded which item. Confirm with the data-protection
   officer what the editor may display, and whether pseudonyms must replace speaker ids in the UI.
5. Multi-project installations: is a bank ever shared between two projects of the same
   installation? D3 says no; if that changes, the bank id needs a scope beyond the project.
