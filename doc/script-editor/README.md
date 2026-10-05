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

**Consequences.** The recorder needs **no** change for drawn groups: at creation the server
materialises a plain resolved script for the session and points `Session.script` at its id, so the
recorder's existing `GET script/{sess.script}` receives a plain list of prompt items, exactly as
today (rest-api §4.1). Reproducibility holds even when the bank gains items later. The editor
needs a read-only view of resolved draws ([ui-spec.md](ui-spec.md) §7) and the server needs a
draw record ([rest-api.md](rest-api.md) §4). The alternative — a session-scoped script endpoint
plus one changed call site in the recorder — is an M0 decision, not the default.

### D3 — Banks are project-local, except banks shipped with the application

**Decision.** An item bank belongs to a project and is edited there. Banks that ship with
SpeechRecorder are read-only in every installation and are copied into a project when a
researcher needs their own wording or their own recordings.

**Consequences.** A script that draws from a shipped bank can be reused in another installation.
An application upgrade may add items to a shipped bank, which widens later draws but never
changes a draw a session has already made (D2). Bank identity carries its source
(`bankSource: 'PROJECT' | 'BUILTIN'`).

### D4 — Playback extends the prompt audio

**Decision.** The sound a speaker hears is the item's **audio mediaitem**, which the recorder
already plays as the prompt (`Mediaitem.autoplay`, repeat via `Mediaitem.replay`). The editor adds
an optional `playback` modifier on the item that takes over placement (`when`), repeats (`repeats`,
`gap`), the replay rule (`replayable`, `maxReplays`) and the headphone requirement; when absent, the
mediaitem flags keep their shipped meaning (owner decision, 2026-10-02; see
[implementation-plan.md](implementation-plan.md) §10.3).

**Consequences.** An item can show one thing and play another (text or image in `mediaitems[0]`,
audio elsewhere in `mediaitems`), or show nothing and play. The recorder must honour the four extra
placements before the editor is useful (M1); the default `WITH_PROMPT` is the shipped behaviour, so
existing scripts need no migration. Playback files are project resources, fetched the way image
prompts already are.

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
the fix. See [validation.md](validation.md) N01, N02. The same rule covers tree shapes, not only
field names: a section that predates `groups` and carries `promptUnits` opens read-only and
migrates only on request (N06), so saving can never add an empty `groups` beside the old data.

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
only to audition a bank item or a playback clip, through a small editor-local `<audio>` player.
The library's `AudioPlayer`/`AudioDisplay` are NgModule-only components built on Web Audio, so
importing them would drag in `SpeechrecorderngModule` and break the rule above.

## 4. Workspace integration

### 4.1 Project entry

On current `master` the application project is named `Cavox` and the library stays
`speechrecorderng`; the editor is a third project and nothing else in the workspace moves. Add to
[angular.json](../../angular.json) under `projects`:

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
        "assets": [
          "projects/spr-script-editor/src/assets",
          {"glob": "**/*", "input": "src/test", "output": "test"},
          {"glob": "*.checks.json", "input": "doc/script-editor/checks", "output": "checks"}
        ],
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
      "options": { "polyfills": ["zone.js","zone.js/testing"],
        "assets": [
          "projects/spr-script-editor/src/assets",
          {"glob": "**/*", "input": "src/test", "output": "test"},
          {"glob": "*.checks.json", "input": "doc/script-editor/checks", "output": "checks"}
        ],
        "tsConfig": "projects/spr-script-editor/tsconfig.spec.json" } }
  }
}
```

Three additions beyond the sketch, all of them load-bearing:

- **`environments` + `fileReplacements`.** Development must read the FILES tree
  (`ApiType.FILES`, `apiEndPoint` pointing at `/test`); production must read the REST API beside the
  app. Without the replacement the production bundle would ship the fixture endpoint. Mirror
  [src/app/app.config.ts](../../src/app/app.config.ts).
- **The `assets` entry for `src/test` (and, in karma, the same array).** The dev server serves the
  repository's fixtures at `/test`, and the editor's specs run against them; the plan's E0 row owns
  this (A3).
- **The `checks` asset.** The shared corpus in [checks/](checks) is served at `/checks/*.checks.json`
  so the editor's specs and the receiver's `server/checks-corpus.test.mjs` run the same files.

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
      media.service.ts        media list, upload, delete (§5)
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
the editor can then be built with no server at all. Those fixtures travel in the editor's own asset
mapping: the dev server serves the repository's `src/test` at `/test`, which is what
`apiEndPoint: 'test'` in `environment.ts` expects. Write endpoints are served by the repository's
receiver ([server/server.mjs](../../server/server.mjs), `npm run serve:api`), which grows the
editor endpoints as track R of [implementation-plan.md](implementation-plan.md); there is no
separate stub.

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
node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/test/script/1245/edit \
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

**Two settings a mounted deployment must get right**, both because a path prefix is where relative
URLs break:

- `apiEndPoint` must be **absolute** (`/api/v1`). Both production environments ship the absolute
  form for exactly this reason: a relative `api/v1` would resolve against the mount prefix
  (`/wsr/edit/`, `/wsr/ng/`) and never reach the API. `src/environments/environment.prod.sample.ts`
  is the template a deployment copies, and it carries the reason.
- `recorderBaseUrl` (the editor's tier-2 link) must name the recorder's mount, e.g. `/wsr/ng`, or be
  left empty when the recorder is on the editor's own origin.

`bin/serve_deploy.mjs` rehearses the whole layout locally — the two mounts behind their prefixes
with the SPA fallback and an `/api/` proxy — so a sub-path deployment is tested rather than assumed:

```bash
node server/server.mjs --port 8391 --data /tmp/deploy --seed src/test --app none --migrate
node server/server.mjs --port 8391 --data /tmp/deploy --seed src/test --app none \
  --project Demo1 --script playback --quiet &
npm run build -- --base-href=/wsr/ng/
npm run build_editor -- --base-href=/wsr/edit/
node bin/serve_deploy.mjs --port 8080 --api http://127.0.0.1:8391
# http://127.0.0.1:8080/wsr/edit/project/Demo1/script and .../wsr/ng/spr/session/1
```

Note the `--migrate`: the receiver's store has no draft for a script until one is written (the
FILES-mode `draft.json` fixtures are the *editor's*, not the store's), so a mounted editor on a
fresh store shows its blocking "draft could not be loaded" state until a draft exists.

Tier-2 preview opens the recorder at `<recorder base>/spr/session/{id}`, where the base is a
deployment setting (`EDITOR_RECORDER_BASE_URL`; empty means same origin as the editor, which is what
the receiver serves locally) and the path is the recorder's own route — see [rest-api.md](rest-api.md)
§6. That instance honours `type: "TEST"` to refuse uploads in the preview tab (the receiver answers
`409 TEST_SESSION_READ_ONLY` for every recording write); where a cached older bundle cannot, the
deployment serving the preview is a separate one with `enableUploadRecordings: false`.

For local runs the receiver serves the built editor at the root
(`node server/server.mjs --app dist/spr-script-editor/browser`), which is also how the write path is
exercised end to end without CORS in the way.

**No service worker.** The recorder has one so a participant can keep recording offline. The
editor must never serve a stale script, and `ng build` must not register a worker for this
application.

## 5. What the library had to gain, and where each piece landed

One definition of everything both applications need. Every row below is implemented; the plan's
milestone rows carry the per-item evidence.

| Need | Where it landed | State |
|---|---|---|
| `Playback`, `Draw`, bank and resolved-draw types | `lib/speechrecorder/script/script.ts`, exported from `public-api.ts` ([data-model.md](data-model.md)) | Done (L1): `Playback`/`PlaybackWhen`, `PrefillBankSource`, `Bank`/`BankItem`, `DrawFilter`, and `Script.name`/`type`/`minRecorderVersion`; `PromptDoc` is exported too, because the inspector edits it. |
| Script write, publish, version endpoints | the editor's `core/script-api.service.ts`, not `ScriptService` | Done: the recorder's `scriptObservable` is untouched and the editor owns `readDraft`/`writeDraft`/`publish`/`versions`/`restoreVersion`/`patchScript`/`createScript`/`duplicate`. |
| Banks, bank items, resolved draws | editor `core/{bank-api,draw-api}.service.ts` | Done: the recorder never reads them, so they stay app-local rather than in the library. |
| Resolved session scripts | server + `Session.script` (D-K) | Done (L5): at creation the receiver materialises the resolved script (`script/sess-<id>`); the recorder's load path is unchanged. |
| Prompt visibility rule and phase transitions | `lib/speechrecorder/script/phases.ts` | Done (L2): `promptVisibleAt` and `ITEM_PHASES`/`nextPhase` extracted from `sessionmanager.ts` and used by both applications (D6). |
| Item timing arithmetic | same file | Done (L2): `effectiveTiming(item)` with the pre/rec/post fallbacks and the playback span; `playbackPlan`/`playbackStart`/`playbackTiming`/`replayAllowed`/`sectionNeedsHeadphones` sit beside it. |
| Playback execution | `sessionmanager.ts`, prompting components, `audio/prompt_audio.ts` | Done (L3): every `when`, repeats/gap, the replay cap with its persisted count, and the headphone reminder. |
| Media list, upload and delete | editor `core/media.service.ts` | Done: per [rest-api.md](rest-api.md) §5, with `durationMs` on upload and `MEDIA_IN_USE` surfaced on delete. |
| Audio audition in the editor | a small editor-local `<audio>` player (D-L) | Done: the library's `AudioPlayer`/`AudioDisplay` are NgModule-only Web Audio and are never imported. |
| Feature → recorder version map | `lib/speechrecorder/script/feature-versions.ts` | Done (L4): the comparator, the table and `minRecorderVersionFor`/`supportsRecorderVersion`; the receiver mirrors the table and refuses at session creation. |
| Theme partials and `sprToken()` | `lib/theme/*` | Already there; the editor imports the SCSS directly, and CI audits its routes. |
| Editor REST endpoints | `server/*.mjs` (the receiver) | Done: `server/{etag,validate,bank,draw,media,cors,feature-versions}.mjs` plus the routes in `server/api.mjs` — track R of [implementation-plan.md](implementation-plan.md). |

Extracting the pure functions and the phase table is what keeps tier-1 preview honest: both
applications depend on the library, not on each other.

## 6. Milestones

Status lives in [implementation-plan.md](implementation-plan.md) — each milestone's rows and its
gate record what was verified and how. The criteria below are the original acceptance bar.

Each milestone ends with something demonstrable. The server work is called out per milestone
because it is the long pole.

**M0 — API agreement.** Walk [rest-api.md](rest-api.md) and
[data-model.md](data-model.md) with whoever owns the server — which is this repository
(`server/`, `npm run serve:api`). Settle: script write and versioning, bank endpoints and the
shipped-bank story, draw resolution and materialised session scripts, the draw record, project
resource upload for playback files, the error envelope and the ETag rules (track R in
[implementation-plan.md](implementation-plan.md)). *Done when* the endpoint list and the JSON
shapes are agreed in writing, and this directory is updated to match.

**M1 — Recorder honours playback.** Library and recorder only, no editor. Implement `playback` in
the session manager and the prompting components for all four `when` values, the replay button,
the replay counter in the session log, the headphone check before a section that plays sound, and
the resolved-script delivery for drawn sessions (L5, D2). *Done when* a hand-written script with
playback runs correctly in the recorder, the replay count is persisted, and the timing functions
from §5 are extracted and unit-tested, including fake-clock tests for each `when`.

**M2 — Editor skeleton, read-only.** The new application, the shell, the script library list, the
outline, the items table, the inspector rendering every field, and the tier-1 preview, all against
`ApiType.FILES` fixtures served at `/test`. No writes. *Done when* `1245.json` can be navigated
and inspected, a legacy script opens read-only and round-trips byte-identically, the theme audit
passes on two editor routes, the validation catalogue runs over a loaded script, and the first
VoiceOver pass covers the outline and the inspector.

**M3 — Write path.** Draft autosave with `If-Match` and edit intents for the 412 reapply, undo and
redo, a local backup of unacked text, the JSON view with import and export, the checks panel with
its fixes and the server's returned findings, media list/upload/delete, publish with the error
gate, version history with a restore surface. *Done when* a script can be created, edited by two
browsers without silent loss (including a structural edit), published, and loaded by the recorder.

**M4 — Banks and draws.** The bank browser, the draw-rule builder, project and shipped banks,
copy-to-project, the draw record view with CSV export, and the dry-run preview (tier 2) against a
preview session that cannot upload. *Done when* a drawn group produces a session whose items are
recorded and traceable to bank items through the materialised-script path, and re-opening that
session shows identical items.

**M5 — Hardening.** Keyboard coverage and the closing screen-reader pass on the editor
([ui-spec.md](ui-spec.md) §8; earlier passes ran per milestone), empty and error states,
large-script performance (a 500-item script must stay responsive in the outline and the table),
preview-session cleanup, i18n of the editor's own chrome if the project needs it, and the doc
updates this work brought (rest-api §5 media endpoints, the audition decision, the legacy-shape
rule).

## 7. Testing

- **Library (karma).** `npm run test_module -- --watch=false --browsers=ChromeHeadless` — the
  recorder's behaviour as the oracle: `promptVisibleAt`, `effectiveTiming`, the phase transitions
  and the placement table for every `when` (C7), the feature→version map, the prefill utility and
  the editor's model helpers. 144 specs today.
- **Editor (karma).** `npm run test_editor -- --watch=false --browsers=ChromeHeadless` — the
  validation catalogue (one `describe` per id plus the shared corpus), the normaliser with
  idempotence, the JSON line tokenizer (escapes, tabs/CRLF, duplicate keys, unicode), the draft
  service (undo/redo, edit intent, 412 reapply with guards, 428, conflict, backup, invalid-JSON
  rule), the services in both API modes, the shell, and one spec per screen including a
  route-level mount through `APP_ROUTES` so an unprovided service fails here rather than at
  runtime; the library's five actions (create, import, duplicate, archive, export) assert their
  request shapes there too. 465 specs today.
- **Fixtures.** `src/test/script/*.json` (playback with all five placements plus a drawn group,
  a drawn-group script, legacy `promptUnits` scripts, a ~500-item script), `src/test/bank/*.json`,
  and the FILES-mode tree the editor reads at `/test` — including the library list, the deployment
  version (`test/version.json`, the value `--recorder-version` serves), each script's version index
  (`test/project/<p>/script/<id>/version.json`, the shape `GET …/version` returns), the per-script
  `draft.json` and the draw record/trace, all taken from the receiver's own responses so
  `ApiType.FILES` and REST agree by construction. `core/round-trip.spec.ts` proves every fixture
  survives load → write with no key lost, no fabricated `groups` over a legacy section and no
  persisted `_shuffled*`.
- **Contract.** `doc/script-editor/checks/*.checks.json` is the shared corpus: the editor's specs
  and `server/checks-corpus.test.mjs` both run it. The write protocol is additionally exercised
  against the receiver over `fetch` (create → publish → 412 → reapply → restore → PATCH → media),
  and the draft service's specs assert the exact request shapes.
- **Server (node --test).** `node --test server/` covers the receiver: store atomicity and ids,
  ETag/428/412, the shared check fixtures, bank filter semantics, draw determinism, the draw
  record and its CSV, media in use, multipart and WAV duration, the version gate, CORS, and that a
  `TEST` session cannot upload. 50 tests today. Development runs it with
  `npm run serve:api -- --data /tmp/… --seed src/test`; `server/data` is gitignored.
- **Theme audit.** Run the editor (or the built bundle) and drive a headless Chrome the tool can
  attach to, then audit the routes and one interaction state:

  ```bash
  npm run start_editor -- --port 4300
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/cdp about:blank &
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script --viewports 1366x768,1920x1080
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script/1245/edit --viewports 1366x768,1920x1080
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script/playback/preview --viewports 1366x768,1920x1080
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script/bank-draw/edit \
    --prepare bin/audit/open-draw-rule.js --viewports 1366x768,1920x1080
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/bank --viewports 1366x768,1920x1080
  node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script/bank-draw/draws --viewports 1366x768,1920x1080
  ```

  `bin/audit/*.js` are page scripts for states behind an interaction; `open-draw-rule.js` clicks the
  drawn-row so the draw-rule inspector is what gets measured, and it is pure DOM, so it works on a
  production build too. The house rule covers light **and** dark, so `use-dark-scheme.js` switches
  `<html data-spr-scheme="dark">` before the same routes are measured again; that pass is what found
  the link contrast failures and the invisible timeline hatch in the dark scheme (plan §11.13). CI
  also measures a phone width (390×844) on the screens that reflow — the editor stacks its columns
  below 820 px, the bank below 1100 px — which is how the editor's overlapping columns and the bank's
  document-level scrollbar were found (§11.14).
- **Accessibility audit.** `bin/a11y_audit.mjs` attaches to the same running Chrome and checks the
  machine-checkable part of ui-spec §8 on the same routes: accessible names, labels and the ARIA
  relationships that carry them, unique ids, `alt`, nothing focusable inside `aria-hidden`, tree and
  radiogroup semantics, tab order, the browser's own accessibility tree, and that every interactive
  target is at least 44 px high (a control inside a `<label>` is measured as that label; a link
  flowing inline in text is exempt). `doc/script-editor/a11y.md` lists each rule and what it caught;
  CI runs the whole list.
- **House-rule lint.** `node bin/editor_lint.mjs` reads the editor's templates and styles and fails on
  the ui-spec §8 rules that are text rather than a rendered property: a `font-size` off the
  `--spr-type-*` scale, a colour literal outside a `var(--spr-…)` fallback, and a `(click)` on a host
  that is neither a control nor carries a `role`. CI runs it in the editor job; `--verbose` prints
  the counts it checked.
- **Dry run (recorder).** `bin/audit/dry_run.mjs` reads the session's **materialised script** from the
  receiver, so it knows each item's placement and section mode, then drives the real recorder and
  asserts, per item, where the clip played relative to the take's recording window:
  `WITH_PROMPT`/`BEFORE` before the clocks (they gate them), `PRERECORDING`/`DURING` at or inside the
  window, `ONDEMAND` only when asked. It also checks the headphone reminder, the drawn group's own
  recordings, and cancels a playing sound with a pause when it can land one.

  ```bash
  npm run build
  node server/server.mjs --port 8391 --data /tmp/dryrun --seed src/test \
    --app dist/cavox/browser --project Demo1 --script playback --quiet &
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --remote-debugging-port=9333 --user-data-dir=/tmp/cdp-dry \
    --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
    --autoplay-policy=no-user-gesture-required about:blank &
  node bin/audit/dry_run.mjs --base http://127.0.0.1:8391 --port 9333 --session 1
  ```

  It drives MANUAL sections and names what it cannot drive: a section whose mode is
  AUTOPROGRESS/AUTORECORDING needs the operator's own timing at the boundary, so the fixture's P3–P5
  and the drawn rows stay in the manual pass — as does a pause that lands inside a ~1 s clip. The
  placement of all five `when` values is pinned by the library's table (`phases.spec.ts`, C7).
- **CI.** `.github/workflows/tests.yml` runs five jobs: the receiver, the library, the editor
  (karma + production build), the audit list above, and the dry run — the last one builds the
  recorder, serves it with the fixture session and drives it with Chrome's fake media stream, so
  the driver's assertions are checked on every push, not by hand.
- **Deployment rehearsal.** `bin/serve_deploy.mjs` serves the built recorder and editor behind their
  documented prefixes (`/wsr/ng/`, `/wsr/edit/`) with the SPA fallback and an `/api/` proxy — the
  commands and the two settings a mounted deployment must get right are in §4.5. It found the
  relative `apiEndPoint` that a prefix would have broken.
- **Manual, per milestone.** Dry-run a session end to end in the recorder after every change to
  the model, because the editor's job is to produce files another application must interpret — the
  parts driven headless (script load, the headphone gate, replay persistence) are recorded in
  [implementation-plan.md](implementation-plan.md) M1's gate row. VoiceOver (Safari) and NVDA
  (Firefox) passes per ui-spec §8.

## 8. Open questions, and where each stands

Answered during M0–M4; the deciding document is named, and the plan's §8 table is the index.

1. **Server endpoints and transfer.** The repo's receiver is the draft of the production server
   (D-Q); the run/backup/transfer runbook is `server/README.md`, and layout changes ship with
   `layoutVersion` + `--migrate` (R12). Production owns auth, CSRF, retention and backup —
   [implementation-plan.md](implementation-plan.md) §10.1.
2. **The script name.** It lives on the script: `Script.name` (with `type` and
   `minRecorderVersion`) is part of the library's model (D-I), and the editor writes the name.
3. **Shipped banks.** The server decides where a `BUILTIN` bank's items and their model recordings
   come from and hands the client the paths to use ([rest-api.md](rest-api.md) §3.4); the receiver
   seeds them from `src/test/bank`. How production packages them stays a deployment decision.
4. **Speaker pseudonymity.** The capability is implemented and the *choice* is the owner's: the
   receiver's `--pseudonymise-speakers` stores and returns a stable per-deployment label
   (`sp-<12 hex>`, salted from a file in the data directory) instead of the caller's id, so the draw
   record, the CSV, the session record and the "already recorded by this speaker" check agree and
   the real id is never written. Off by default, as the receiver's other privacy-relevant switches
   are. What remains is the data-protection answer: whether a deployment must turn it on. The
   editor needs no change either way — its speaker rendering stays isolated in
   `app/draws/draws-speaker.ts`.
5. **Multi-project banks.** Project-local (D3); sharing one between projects would need a scope
   beyond the project id.
6. **Resolved-script delivery.** The materialised script id on `Session.script` (D-K), exercised
   end to end in `server/draw.test.mjs` and by the recorder dry run.
7. **Authentication surface.** A session cookie with the deployment's CSRF scheme, or a bearer
   token; `401` → the deployment's login → return URL; `403` reads but does not write — the
   conventions in [rest-api.md](rest-api.md). The editor side is `core/access.service.ts` and
   `core/access.interceptor.ts`: the login URL is the deployment's `loginUrl` setting, a `403`
   flips one application-wide read-only flag that every write control reads (the draft service's
   and the bank's `writesDisabled`), and the shell shows the single explanatory line. A failed
   autosave blocks Publish with its own reason (ui-spec §1).
8. **W10's "deployment runs {actual}".** `GET {api}version` → `{recorderVersion}`, the value the
   receiver serves ([rest-api.md](rest-api.md) §1.1), so the editor never guesses from its own
   bundle.
9. **Bank and media write concurrency.** Last-write-wins with a re-read after write; media `DELETE`
   alone refuses while a published version references the file ([rest-api.md](rest-api.md) §1.2).
10. **Draft revision retention.** Keep 50 revisions / 30 days, pruned by `--gc`; published versions
    are never pruned (D3/D-N).
11. **Preview sessions.** The receiver refuses every recording write into a `TEST` session with
    `409 TEST_SESSION_READ_ONLY` (D-P); a deployment whose cached recorder bundle predates
    `type: "TEST"` must also serve that preview with `enableUploadRecordings: false`.
12. **Media orphan cleanup.** `--gc` reports orphans and `--gc-media` deletes them (B1); uploads
    the undo stack cannot remove are called out in the media UI.
