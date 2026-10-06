# Cavox

Capture your voice — a speech recording tool implemented as an Angular 20 module. This module is published as the `speechrecorderng` npm package.

## Migrate from version 2.x.x to 3.x.x
For backwards compatibility to server REST API v1 set the property `apiVersion: 1` in your environment file.

## Integrate SpeechRecorder module to your web application

### Install NPM package
Speechrecorder module is available as NPM package.
Add `"speechrecorderng": "3.11.26"` to the `dependencies` array property in the `package.json` file of your application. Run `npm install` to install the package.
### Module integration
Add SpeechRecorderNg module to 'imports' property of your `AppModule` annotation. The module main component `SpeechRecorder` should be activated by an Angular route.

#### Example `app.module.ts`
```
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import {SpeechrecorderngComponent, SpeechRecorderConfig, SpeechrecorderngModule} from 'speechrecorderng'
import {RouterModule, Routes} from '@angular/router';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MdButtonModule, MdDialogModule, MdIconModule, MdMenuModule, MdToolbarModule} from "@angular/material";

const MY_APP_ROUTES: Routes = [
  { path: 'spr', component: SpeechrecorderngComponent}
];

const SPR_CFG:SpeechRecorderConfig={
  apiEndPoint: '/myapppath/api/v1'
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    RouterModule.forRoot(MY_APP_ROUTES),BrowserModule,BrowserAnimationsModule,SpeechrecorderngModule.forRoot(SPR_CFG)
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### HTML/CSS integration
 Speechrecorder is intended to run in a layout which always fits to the browser viewport without scrollbars. The subject should not be distracted from performing the recording session.
 Therefore the module should be embedded in HTML page with 100% height and without padding or margin.
 At least the CSS properties `margin-top`,`margin-bottom`,`padding-top`,`padding-bottom` should be zero and `height` should be `100%` for the DOM elements `html` and `body`
#### Example `index.html`
 ```
   <!doctype html>
   <html lang="en" style="height:100%;margin:0;padding:0">
   <head>
     <meta charset="utf-8">
     <title>My application</title>
     <base href="/">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
   </head>
   <body style="height:100%;margin:0;padding:0">
     <app-root class="mat-typography"></app-root>
   </body>
   </html>
   ```
 The SpeechRecorder component will appear in the Angular `router-outlet` element, if a route for the `SpeechRecorder` component is matched.  
   
 #### Example `app.component.html` with Material Design menubar 
 ```
 <md-toolbar color="primary">
 
   <button md-button [mdMenuTriggerFor]="menu">
     <md-icon>menu</md-icon>
   </button>
   <md-menu #menu="mdMenu" yPosition="below" [overlapTrigger]="false">
     <button md-menu-item  [mdMenuTriggerFor]="helpMenu">Help</button>
     <md-menu #helpMenu="mdMenu" xPosition="after" [overlapTrigger]="false">
       <p>My application</p>
     </md-menu>
   </md-menu>
   &nbsp;<span>My Application</span>
 </md-toolbar>
 <router-outlet></router-outlet>
 ```
   
## Theme (Umeå University)

The recorder is themed with the Umeå University palette. Everything visual is a CSS custom
property, so an application can drop the recorder into its own brand without touching
component code.

    huvudfärger       #2A4765 (chrome)   #000000 (canvas, traffic light)
                      text on these is always white
    komplementfärger  #73A790 #D7B17C #EABAB9 #F1EFE4
                      text on these is always black

### Include the theme

```scss
@use '@angular/material' as mat;
@use 'speechrecorderng/theme' as spr;

html {
  @include mat.theme((
    color: (primary: my-primary-palette, theme-type: light),
    typography: 'Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
    density: 0,
  ));
}

@include spr.theme();       // --spr-* tokens + brand values for the Material roles
@include spr.theme-dark();  // optional: needs <html data-spr-scheme="dark">
```

Include `spr.theme()` *after* your Material theme, and at the top level of the stylesheet:
it pins `--mat-sys-primary`, `--mat-sys-error`, the surface roles and the toolbar colors to
the brand values, so the source order decides. The mixin emits its own `:root` block, so
nesting it inside another selector would produce a selector that never matches. Without any
theme include the recorder still renders, because every `var(--spr-*, …)` carries the brand
value as a fallback.

### Palette and roles

| Token | Value | Role |
|---|---|---|
| `--spr-chrome` / `--spr-chrome-ink` | `#2A4765` / `#FFFFFF` | toolbar, primary buttons, selected row (9.60:1) |
| `--spr-chrome-grad` / `--spr-chrome-glow` | navy ramp + warm glow | app bar background |
| `--spr-page` | `#EEF1F5` | application background |
| `--spr-surface` / `--spr-surface-2` / `--spr-surface-3` | `#FFFFFF` / `#F8FAFD` / `#EDF2F8` | panels, table header, inset |
| `--spr-stage` / `--spr-stage-ink` | `#F1EFE4` / `#000000` | prompt stage (18.21:1) |
| `--spr-ink` / `--spr-ink-muted` / `--spr-ink-subtle` | `#1F3044` / `#4A6288` / `#6D7C98` | body, secondary, non-essential |
| `--spr-border` / `--spr-border-strong` / `--spr-divider` | `#D8DFE8` / `#C7D1DF` / `#E9EDF3` | lines |
| `--spr-ok` / `--spr-caution` / `--spr-alert` | `#73A790` / `#D7B17C` / `#EABAB9` | recording-done, warning/level, error — text *on* the fill is `--spr-*-ink` (black); text in the status colour *on a surface* is `--spr-*-text` (`#1B5E20` / `#7A5A16` / `#7F1D1D` light, the brand colour dark) |
| `--spr-canvas` / `--spr-canvas-ink` / `--spr-canvas-signal` | `#0E1A26` / `#FFFFFF` / `#73A790` | signal + spectrogram surface |
| `--spr-black` / `--spr-lamp-off` | `#000000` / navy 55% | traffic light housing and unlit lamp |
| `--spr-r-sm … --spr-r-xl` | 6 / 12 / 14 / 22 px | radii |
| `--spr-shadow-card` / `-bar` / `-cta` / `-overlay` | blue-tinted shadows | elevation |

`app-simpletrafficlight` is the subject-facing state signal. The state is encoded three
ways — lamp position, lamp colour and a caption ("Recording", "Get ready", …), which is
also announced through `role="status"`.

### Overriding

```scss
:root {
  --spr-chrome: #123456;
}
```

Canvas painters (waveform, spectrogram, level meter) read the same tokens through
`sprToken('spr-canvas-signal')` and friends, so an override reaches them as well.
`SPR_SPECTRUM_RAMP` (exported from the package) is the luminance-monotonic spectrogram
ramp; `buildSpectrumLut()` turns it into the table the sonagram worker paints with.

### Translations

The recorder's strings have English built in and are overridable per application, so the
library does not force an i18n runtime on anyone:

```ts
// the library's fallback catalogue and the token it reads at runtime
import {SPR_STRINGS, SPEECHRECORDER_STRINGS, SprTranslator} from 'speechrecorderng';

// an application that already uses an i18n library supplies the catalogue, e.g. Transloco:
{
  provide: SPEECHRECORDER_STRINGS,
  deps: [TranslocoService],
  useFactory: (transloco: TranslocoService) => new Proxy({} as Record<string, string>, {
    get: (_t, key) => typeof key === 'string' ? (transloco.translate(key) === key ? undefined : transloco.translate(key)) : undefined,
  }),
}
```

* A key the application does not provide falls back to `SPR_STRINGS`, so a partial translation
  degrades to English rather than to a key name.
* Placeholders use `{{name}}`: `spr.status.upload` is `Upload progress: {{value}}`.
* `SPR_STRINGS` is the list to translate. `bin/build_i18n.mjs` (in this repository) generates the
  catalogues from it plus the shell's own strings, and `bin/validate_i18n.mjs` fails when a locale
  misses a key, carries an empty value, or when the source references a key the catalogue does not
  define.
* Key-binding labels (`Space`, `Esc`) are key names, not prose, and stay as they are; their
  descriptions are translatable through `KeyBinding.descriptionKey`.

The demo application in this repository is the reference: Transloco with `assets/i18n/{en,sv}.json`,
a language switch in the toolbar, the choice persisted in `localStorage` under `spr.lang`, and
`<html lang>` kept in sync. Date and number formats come from `LOCALE_ID`, which Angular resolves
at bootstrap: switching language updates the text immediately, and the formats after a reload.

### Dark scheme

The dark values ship with the theme and are opt-in through a root attribute — no
`prefers-color-scheme` rule, because a recording session runs in controlled lighting and the
operator decides:

```js
document.documentElement.setAttribute('data-spr-scheme', 'dark');   // back to light: removeAttribute
```

The Material role pins follow automatically (they reference the tokens, not the values), and
canvas painters repaint with the new values: `theme.ts` watches the attribute, drops the
resolved-token cache and dispatches a `resize`, which is what makes the audio layers redraw.

### Logos (branding)

The recorder renders the deploying institution's marks in four slots. It ships no image
files: an application points at its own assets.

```ts
const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: 'api/v1',
  branding: {
    promptStage: {src: 'assets/img/visp_slogan_sv.svg', alt: 'VISP — Visible Speech', height: 32},
    controlsLeft: [{src: 'assets/img/sweclarin_logo.png', alt: 'SweCLARIN logo',
                    href: 'https://www.sweclarin.se/', height: 24}],
    controls: [{src: 'assets/img/bas.png', alt: 'Bavarian Archive for Speech Signals logo',
                href: 'https://www.bas.uni-muenchen.de/Bas/BasHomeeng.html', height: 26},
               {src: 'assets/img/clarin-d.png', alt: 'CLARIN-D logo',
                href: 'https://www.clarin-d.net/en/', height: 28}],
  },
};
```

| Slot | Where | Notes |
|---|---|---|
| `promptStage` | bottom left of the prompt stage, below the prompt | single mark; at 1568×1334 it costs 4 px of the auto-fit prompt size (74 px against 78 px without it) |
| `progressFooter` | below the prompt list, sticky at the bottom of the rail | list of marks, centred; hidden below 768 px, like the rail itself; unused by the demo |
| `controlsLeft` | left of the transport bar, before the status message | list of marks; stays at laptop widths, because nothing but the status message shares that end |
| `controls` | right of the transport bar, before the state indicators | the marks step aside one at a time as the row narrows: a third from 1250 px, the second from 1100 px, none below 768 px |

The transport-bar thresholds are measured, not guessed: the right cluster can spend about 250 px
at 1100 px, so a third mark there costs about 100 px and has to give way first — which is why a
mark that must stay visible on a laptop belongs in `controlsLeft`. Marks never shrink or squash;
the slot drops them instead.

* `height` is per mark (the slot default applies when omitted); width follows the aspect
  ratio, which the theme audit verifies against the file.
* Marks with `href` open the owner's site in a new tab; without it the marker is plain. `alt`
  is required — the audit fails on a mark without it.
* Marks keep their own brand colours. In the dark scheme they sit on a white plate
  (`--spr-logo-plate`, transparent in the light scheme); `srcDark` picks an official light
  variant instead, if one exists. Recolouring a third-party mark with a CSS filter is not
  supported.
* The assets themselves are the property of their owners and are not covered by this package's
  licence. The demo application in this repository serves them from `src/assets/img`; keep the
  clear space the owner's guidelines specify.

### Respondent display

A session can be mirrored to a second window, so a respondent reads the prompts on their own
screen. The mirror shows the stage and nothing else — the instruction line
(`spr-recinstructions`), the prompt itself (plain text, decorated prompt blocks or an image) and
the start/stop light; no progress rail, no audio view, no transport, no status. The mark of
`branding.promptStage` sits at the bottom left of the prompt area in both windows, and the
instruction line scales with the window (it is a caption on the operator's screen, not on the
respondent's).

* **`D` opens the window, `D` again brings it to the front.** The key is configurable:
  `respondentDisplayKey` in `SpeechRecorderConfig` takes any `KeyboardEvent.key` value; a key that
  another shortcut already uses is reported at startup and the default is kept. The transport bar
  carries the same control, which is the way in on machines without a keyboard.
* The mirror is a route of its own, `spr/respondent/:id`, registered with `SPR_ROUTES` — a
  consumer gets it with the module, no wiring. A window opened by hand (drag the tab to the
  second screen) works too: it announces itself and is answered with the current stage, and until
  that answer arrives it says that it is waiting. The route carries
  `data: {sprRespondentDisplay: true}`: an application that owns window chrome (a toolbar, a
  footer) can hide it for that route, and the mirror covers whatever is left with a fixed,
  full-viewport host. Run one recorder window per session — the mirror follows the session's
  channel, so a second recorder on the same session would drive it as well.
* Transport: a session scoped `BroadcastChannel`, with `postMessage` to the window handle as the
  second path for contexts where the channel is partitioned (a recorder embedded cross-site) or
  missing. Snapshots carry a sequence number, so a duplicate on the slower path is ignored.
  `BroadcastChannel` needs Safari/iOS 15.4 or newer, Chrome 50, Firefox 38 or Edge 15 — every
  browser this library supports has it; without a channel a window opened by the recorder still
  works over the handle, and one opened by hand says that it is unsupported instead of staying
  blank.
* The mirror follows the operator: prompt changes, a hidden prompt (`showPrompt`), the start/stop
  light, the session's end, the language (the shell switches it in every window — this repository
  listens for the `spr.lang` storage event) and the scheme (`data-spr-scheme`).
* The recorder does not read anything back from the mirror: it is output only.

### Recording device

The audio view — the one with the spectrogram — carries a microphone picker in its top right
corner. It lists the browser's `audioinput` devices, remembers the choice under
`localStorage['spr.captureDevice']` (device id **and** label: browsers rotate ids per origin, so
the label is the fallback), and refreshes when devices are plugged or unplugged.

* Browsers hide device labels until microphone access has been granted once. The picker offers a
  button that asks for it on the click (the browser requires a user gesture).
* The project's `audioDevices` list stays authoritative: when it names a device and that device is
  present, the picker shows it and disables the choice. The existing behaviour for a *missing*
  required device is unchanged (error dialog, recorder read-only).
* The choice is handed to `AudioCapture.open(…, deviceId, …)`, so the per-browser constraint
  building stays in one place. It applies at the next capture start; a switch between takes
  reopens the capture right away, and one made during a take is remembered and applied as soon as
  the take is over. A remembered device that is gone is reported (the picker marks it) instead of
  being substituted silently — the capture then uses the browser default.

### Migrating from the previous theme

The recorder no longer ships the Material green/amber/red palette, and no component keeps
its old hard-coded colours. If you styled the recorder yourself, pick one of:

* **Include the shipped theme.** Add `@include spr.theme();` after your own `mat.theme()`
  call (see above). This is the supported path and needs no other change.
* **Only override what you must.** Without the theme include the recorder still renders
  (every token has a literal fallback), and you can set individual values, e.g.
  `:root { --spr-chrome: #123456; --spr-chrome-ink: #FFFFFF; }`. Keep the ink pairs
  together: the palette rules are "white ink on the main colours, black ink on the
  complement colours", and the audit checks the resulting contrast.

Component-internal selectors changed as well: the transport and audio controls are plain
buttons styled by the library (previously browser-default `buttonface`), the traffic light
takes its state from `app-simpletrafficlight` (lamp + caption, `role="status"`), and the
detail overlay lost its debug background. If your application overrode those elements by
class, re-check them against the token list.

### Audit

`bin/theme_audit.mjs` renders the application in a headless Chrome (DevTools Protocol) and
fails on legacy colour literals, contrast below WCAG AA, text below 13.6 px, a Material role
that stopped following its brand token, or a document that scrolls:

```
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr \
  --viewports 1024x768,1366x768,1568x1334,1920x1080 --verbose
```

States behind an interaction are reached with `--prepare <fixture>.js`, which is evaluated in
the page after load and before measuring — `bin/audit/open-detail-view.js` opens the detailed
audio view, `bin/audit/open-error-dialog.js` opens the error dialog:

```
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr/session/2 \
  --prepare bin/audit/open-error-dialog.js
```

### Deployment on the server
See [Angular Deployment/Server Configuration](https://angular.io/guide/deployment#server-configuration) for details.

To distinguish between the REST API base paths and the path for the web application the application should not be deployed to the top level directory of your Web-server.
Choose an arbitrary base path for the app e.g. `/wsr/ng/dist/` and build the app accordingly:
```
ng build --base-href=/wsr/ng/dist/ --prod
```
Copy the dist folder to ```/wsr/ng/``` on your Web-Server and setup the fallback configuration for this path in your Web-Server.


   
### Server REST API

Cavox requires a HTTP server providing a REST API. The server code is not part of this package.
The package only contains a minimal file structure for testing. The files reside in `src/test`.

Versions 2.x.x of the recorder (then WebSpeechRecorderNg) use the REST API version v1, Versions 3.x.x may use API version v1 and  v2. Set environment property apiVersion accordingly (default: `apiVersion: 1`) 

## Configuration

By default the API Endpoint ({apiEndPoint}) is an empty string, the API is then expected to be relative to the base path of the application. 

### The options

`SpeechRecorderConfig` (`spr.config.ts`) carries these, and an application's environment file
normally lists them directly — `src/environments/environment.ts` in the demo does, and the
production sample beside it is the deployment-specific copy:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `apiEndPoint` | `string \| null` | `null` | API base; relative to the application's path unless set. |
| `apiType` | `ApiType \| null` | `null` | `NORMAL` talks to the REST API, `FILES` reads `.json` fixtures instead. |
| `apiVersion` | `number` | `1` | The API version segment. |
| `withCredentials` | `boolean` | `false` | Send cookies; see Security below. |
| `enableDownloadRecordings` | `boolean` | `false` | Offer the download action for recordings. |
| `enableUploadRecordings` | `boolean` | `true` | Upload recordings to the server. |
| `uploadConfig` | `UploadConfig` | see below | Upload retries, concurrency and idempotency. |
| `logLevel` | `SprLogLevel` | `INFO` | The logger's gate; see Logging below. |
| `encryptPersistentRecordings` | `boolean` | `false` | Encrypt chunks at rest in IndexedDB; see Security below. |
| `branding` | `SpeechRecorderBranding` | unset | Logos per slot; unset renders no marks at all. |
| `respondentDisplayKey` | `string \| null` | `null` | Key that opens the respondent display; unset keeps `keybindings.ts`'s default. |

An application's environment may add its own fields on top: the demo adds `defaultSessionId` (the
session the start page's action leads to) and `configurationCatalogUrl` (the catalogue the
configuration picker offers) — neither is part of this class.

### Offline and fixture mode

`apiType: 'files'` reads scripts, banks, media and recordings from `.json` fixtures under
`apiEndPoint` instead of talking to a REST API. The defaults for that mode are exported from the
public API as `SPEECHRECORDER_ENVIRONMENT_DEFAULTS` — `apiType: 'files'`, `apiEndPoint: 'test'`,
downloads on, uploads off — which is deliberately not what this class defaults to, since the class's
defaults describe a normal deployment. The demo application ships the same values in
`src/environments/environment.demo.sample.ts` — with `production: true`, as an environment file needs —
so copy it over `environment.ts` to run the demo offline.

### Logging

All library log output goes through a level gated logger. The level is configured with `logLevel` in `SpeechRecorderConfig` (`SprLogLevel.DEBUG`, `INFO` (default), `WARN`, `ERROR`, `OFF`). With the default level, debug output is suppressed.

### Security

* The application must be served over HTTPS: browser microphone access requires a secure context, and recordings may contain sensitive personal information.
* When `withCredentials: true` is configured (cookie based authentication), the server must implement CSRF protection, e.g. by requiring a CSRF token on state changing requests or by setting `SameSite=Strict`/`SameSite=Lax` on the session cookie. The client does not add a CSRF token.
* Prefer token based authentication via the `Authorization` header over cookies.
* A strict Content-Security-Policy must allow blob workers and blob audio worklet modules: `worker-src 'self' blob:`, `media-src blob:`.
* Recording files and their metadata are considered personal data; the server should apply access control, transport encryption and retention policies accordingly.
* When recordings are stored client side in IndexedDB (`DB_CHUNKED` storage), they are plaintext by default. Set `encryptPersistentRecordings: true` in `SpeechRecorderConfig` to encrypt chunks at rest with AES-GCM (WebCrypto). The key is session scoped: a page reload in the same browser session can still decrypt, a browser restart cannot (stale encrypted chunks become unreadable and should be cleaned up server side). Playback and download of encrypted recordings work transparently.

## Cavox REST API description

### Entity Project

REST Path: GET {apiEndPoint}project/{projectId}

Content-type: application/json

Example for Mono recordings:

```
{
 "name": "My project",
 "audioFormat" : {
   "channels": 1
  }
}
```
### Entity Session

Current recording session data.

REST Path: GET {apiEndPoint}session/{sessionId}

Content-type: application/json

Properties: 
 * sessionId: number: Unique ID of the session
 * script: number: Unique ID of recording script 

Example:
```
{
  "sessionId": "2",
  "project": "My project",
  "script": "1245"
}
```  

During the session the application will try to update the session object on the server by HTTP PATCH requests.
The session properties status,loadedDate,startedTrainingDate,startedDate,completedDate and restartedDate 
will be patched accordingly to the session events.

REST Path: PATCH {apiEndPoint}session/{sessionId}

Content-type: application/json

Properties (only changed properties are set): 
 * status: enum: "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED"  status of the session 
 * loadedDate: string: date/time when session was loaded
 * startedTrainingDate: string: date/time when a training section was started
 * startedDate: string: date/time of recording start
 * completedDate: string: date/time of session completed
 * restartedDate: string: date/time of a session restart (continue) 

For example when the session and script is loaded successfully, this PATCH request might be sent:
```
 {"status":"LOADED","loadedDate":"2020-03-25T12:52:12.616Z"}
```

### Entity Script

Recording script controls recording session procedure. 

REST Path: GET {apiEndPoint}script/{scriptId}

Content-type: application/json

Properties:
 * type: script: constant: Must be `"script"`
 * scriptId: number: Unique ID of the script
 * sections: array: Array of recording session sections

### Embedded entity Section

Properties:
 * name: Optional name of section
 * mode: enum: `MANUAL`, `AUTOPROGRESS` or `AUTORECORDING`
 * promptUnits: array: List of prompt units.
 * training: boolean: Section is intended as training for the subject. The recording items of a training section are ignored when the completeness of the session (each prompt item is recorded) is checked.

### Embedded entity Prompt Unit

Properties:

 * recpromptId: Unique ID of this recording prompt 
 * itemcode: string: In the scope of the script unique identifier of an recording item
 * mediaitems: array: List of media items for this prompt. Currently only a single mediaitem element in the array is supported.

### Embedded entity Media item

Properties (supported properties only):

 * mimetype: string: How the item is presented. A missing mimetype means `text/plain`.
   * `text/plain` — `text` is shown as the prompt.
   * `text/x-prompt` — `promptDoc` is rendered as decorated prompt blocks.
   * `image/*` — `src` names a project resource that is shown as the prompt.
   * `audio/*` — `src` names a project resource that is played as the prompt (see
     [Prompt audio](#prompt-audio)).
   * anything else is not rendered; the stage logs a warning.
 * text: string: Text to prompt
 * src: string: Project resource of an image or a sound, e.g. `resources/images/item.jpg`,
   `resources/audio/stimulus.wav`. Resolved as `{apiEndPoint}project/{projectId}/{src}`.
 * promptDoc: object: Decorated prompt document for `text/x-prompt`.
 * alt: string: Accessible, human readable description of the item. It is what the stage shows
   for a sound prompt and what the prompt list shows for any item.
 * autoplay: boolean: `audio/*` only. Play the sound when the prompt is presented. Default: `true`;
   `false` leaves the sound to the operator's play control.
 * replay: boolean: `audio/*` only. Let the operator play the sound again — the *Prompt sound*
   control in the transport bar and the `R` key. Default: `true`; `false` is what a test section
   wants: the stimulus is played once when the take starts and cannot be repeated. A sound with
   `autoplay: false` **and** `replay: false` is never played; the stage logs that.
 * defaultVirtualViewBox: object: `{height}` the prompt is scaled against.

Example script:
```
{
  "type": "script",
  "scriptId": "1245",
  "sections": [
    {
      "mode": "MANUAL",
      "name": "Introduction",
      "groups": [
        {
          "promptItems": [
            {
              "itemcode": "I0",
              "mediaitems": [
                {
                  "text": "Välkommen till talinspelningen!"
                }
              ],
              
            },
            {
              "itemcode": "I1",
              "mediaitems": [
                {
                  "text": "Här står prompten; en kort text som du ska läsa, en fråga som du ska besvara eller en bild som du ska beskriva."
                }
              ],
              
            }
          ]
        }
      ],
      "training": false
    },
    {
      "mode": "AUTOPROGRESS",
      "name": "Recording Session",
      "groups": [
        {
          "promptItems": [
            {
              "itemcode": "N0",
              "recduration": 10000,
              "mediaitems": [
                {
                  "text": "What's your name?"
                }
              ],
              
            },
            {
              "itemcode": "S0",
              "mediaitems": [
                {
                  "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
                }
              ],
              
            }
          ]
        }
      ]
    }
  ]
}
           
```

### Prompt audio

A prompt item whose media item is a sound (`mimetype: 'audio/*'`, `src` a project resource) is
played to the respondent when the take starts. The traffic light waits for it:

| Item clock | What happens |
|---|---|
| the take is started | the prompt is presented (caption, image or the sound) and the sound is played; the light stays at **Stop** |
| the sound has played to the end | the light turns **Get ready** and `prerecdelay` (default 1000 ms) starts |
| `prerecdelay` is over | the light turns **Recording** and the voice is recorded |

Neither the gold cue nor the green recording lamp comes up while the respondent is still
listening, so nobody starts speaking over the prompt. Two flags of the media item decide what the
script allows:

| `autoplay` | `replay` | What happens |
|---|---|---|
| `true` (default) | `true` (default) | the sound plays when the take starts, the light waits for it, and the operator may repeat it with the *Prompt sound* control (key `R`) |
| `true` | `false` | played once when the take starts; no control and `R` does nothing — the stimulus of a test item |
| `false` | `true` | nothing plays automatically; the operator starts the sound with the control, before or during the take |
| `false` | `false` | never played; the stage logs that the item stays silent |

While a take is waiting for its sound, a replay restarts the sound and with it the wait — with the
clocks the take was started with, so it cannot shorten the recording window. `replay: false` turns
that off as well, so a supervised session cannot hold the recording back or repeat a stimulus that
a test wants played exactly once.

The setting is per sound (`Mediaitem.replay`). A section wide default — a training section that
allows repeats, a test section that does not — would sit on `Section` and override the item; the
per item flag is what is implemented today.

The microphone is already capturing when the sound plays (that is what `prerecording` means), so
a sound played over loudspeakers is part of the recording — which is what a shadowing task wants.
Headphones keep it out of the recording. The sound is loaded from
`{apiEndPoint}project/{projectId}/{src}`, the same route as image prompts (the evaluation receiver
serves it from `<data>/project/<id>/<src>`), and is fetched once per session, so a repeating
stimulus is played from the cache. A sound that cannot be fetched, decoded or started is reported
in the status line and the take continues without it — the light never waits forever.

The sound is played by the recorder window; the [respondent display](#respondent-display) mirrors
the stage and the signal (so its traffic light waits as well) but plays no sound of its own.

A prompt carries one media item today, so a sound prompt shows the sound's `alt` text and the
localised "Listen to the prompt." hint on the stage instead of a text prompt. A script that needs
both a text and a sound for one item is not supported yet (`PromptitemUtil.autoplayAudioitem`
already picks the sound out of a list, so lifting the restriction in the stage is the remaining
step).

`src/test/script/3457.json` (session 9) is a small sound-prompt script: one item that plays a
sound automatically and repeatably, one that leaves it to the play control (`autoplay: false`),
one that is played once without a replay (`replay: false`) and one text item.

### Recording file

Cavox stores the recording in browser memory first. The recordings are then uploaded to the server as binary encoded WAVE files.

When `enableDownloadRecordings` is set, the completion dialog offers **Export recordings**: the
session's client-side recordings are packed into a zip (one WAVE and one metadata file per
recording, plus `session.json`) and downloaded — the way a standalone install gets its recordings
out without a server. Recordings held on the server instead of the client (`NET_CHUNKED`) are not
included.

Path: POST {apiEndPoint}session/{sessionId}/recfile/{itemcode}

Content-Type: audio/wav

There might be multiple uploads for one recording item, when the subject repeats a recording. The server is responsible to handle this uploads.
The server should apply a unique identifier for each uploaded recording file. Subsequent recording uploads for the same itemcode should get different IDs and should be stored with a version number starting with zero.    
A GET request to the URL should return the latest upload.  

### Upload robustness and backend requirements

The upload queue is failure tolerant: every upload request carries an idempotency key, transient failures are retried with exponential backoff and permanent failures are reported to the user.

#### Idempotency

All upload POST requests (recording file, prepare, chunk and concat endpoints) include the header:

```
Idempotency-Key: <uuid>
```

The key identifies one logical upload and is identical across retries of the same request. A request may be retried because the client aborted a previous attempt after a timeout even though the server had already stored the payload.

The server should:

* treat the pair (idempotency key, target URL) as unique within a TTL (e.g. 24h) and return the result of the original request instead of storing a duplicate;
* additionally deduplicate chunk uploads by the recording file UUID and chunk index (`{uuid}/{chunkIdx}`);
* reject `concatChunksRequest` with a 4xx status when the stored chunk count does not match the requested `chunkCount`.

#### Chunked upload endpoints

When the client streams recordings (NET_CHUNKED storage), it uses these endpoints:

* `POST {apiEndPoint}session/{sessionId}/recfile/{uuid}/prepareChunksRequest` — FormData: `uuid`, `startedDate` (ISO date). Opens the recording file for chunked upload.
* `POST {apiEndPoint}session/{sessionId}/recfile/{uuid}/{chunkIdx}` — body: WAVE encoded audio chunk, `chunkIdx` 0-based and ascending. The `spr` route variant posts to `recfile/{itemcode}/{uuid}/{chunkIdx}` instead.
* `POST {apiEndPoint}session/{sessionId}/recfile/{uuid}/concatChunksRequest` — FormData: `uuid`, `chunkCount`. Concatenates the stored chunks and closes the recording file.

#### Status codes

The client classifies failures as follows:

| Response | Handling |
|---|---|
| 2xx | Success. The recording is marked as server persisted. |
| 408, 425, 429, 5xx | Transient: retried with exponential backoff + jitter (default up to 8 attempts, delays 1s..60s). |
| other 4xx | Permanent: not retried. The upload is marked failed and an error message is shown. The user can retry all failed uploads. |
| Network error / timeout | Transient, retried (the idempotency key prevents duplicates). |

Permanent conditions (unknown session or recording file, size limits, authentication) must therefore be answered with 4xx statuses other than 408/425/429.

#### Error responses

On 4xx the response body should be JSON `{"error": "human readable message"}` or plain text. The message is shown to the user.

#### Strict acknowledgement (optional)

By default any 2xx response counts as stored. If the server confirms storage explicitly, set `uploadConfig.requireStoredAck = true` in `SpeechRecorderConfig`; every successful store must then respond with the JSON body `{"stored": true}`.

#### Client configuration

`SpeechRecorderConfig.uploadConfig` accepts:

* `maxAttempts` (default 8) — total POST attempts per upload.
* `baseRetryDelayMs` (default 1000) and `maxRetryDelayMs` (default 60000) — bounds of the exponential retry backoff.
* `jitterRatio` (default 0.25) — relative jitter applied to retry delays.
* `requireStoredAck` (default false) — require the `{"stored": true}` response body.
* `idempotencyHeader` (default `Idempotency-Key`) — header name carrying the idempotency key.
* `maxConcurrentUploads` (default 1) — maximum number of POST requests in flight. When set above 1, the server must tolerate uploads arriving out of order (e.g. chunk POSTs in flight while the prepare request is still being processed).
* `checkStoredChunkBeforeUpload` (default false) — check via GET `{chunkUrl}/{chunkIdx}` whether the server already holds a chunk before uploading it (2xx = stored, 404 = not stored). Enables safe re-upload after a crash or reload.
* `persistQueue` (default false) — persist Blob uploads to IndexedDB before POSTing. Pending uploads survive a page reload: the library restores and re-queues them on startup with the same idempotency keys, so the server can deduplicate uploads that already succeeded before the reload.

A recording is only marked as server persisted after the server acknowledges the upload. While uploads are pending or have terminally failed, the client blocks page navigation and does not mark the session as complete.


### Start a recording session

The default routing path to start a recording session is `/spr/session/{sessionId}`. If you call this router link from your Angular application
Cavox should start and will try to load the session data from the REST API first.
 
## GUI components to view and edit your recording database

### Edit or view recording files
To edit a selection of a recording file call the router link: 
`/spr/db/recordingfile/{recordingFileId}`

To only view a recording file: 
`/spr/db/recordingfile/_view/{recordingFileId}`


The application will send in both modes the following requests to the REST API:

1. Recording file meta data

Path: POST {apiEndPoint}recordingfile/{recordingFileId}

Accept: application/json

```
{
    "recordingFileId": "5678",
    "session": 2,
    "version": 0,
    "recording": {
        "itemcode": "N0",
        "recduration": 10000,

        "recinstructions": {
            "recinstructions": "Please answer:"
        },
        "mediaitems": [
            {
                "annotationTemplate": false,
                "autoplay": false,
                "mimetype": "text/plain",
                "text": "What's your name?"
            }
        ]
    }
}
``` 

2. The recording file itself:

(Same URL however it requests an audio MIME type )

Path: POST {apiEndPoint}recordingfile/{recordingFileId}

Accept: audio/wav


and optional to navigate through recording files of the same session:

3. Session data of this recording file 

REST Path: GET {apiEndPoint}session/{sessionId}

Content-type: application/json


4. The recording file list of the session if the session ID could be retrieved:

REST Path: GET {apiEndPoint}project/{projectId}/session/{sessionId}/recfile

Content-type: application/json


A server response might look like this:

```
[ {
    "recordingFileId": "1234",
    "session": 2,
    "date" : "2020-05-01T20:03:00.456+01:00",
    "recording" : {
      "mediaitems" : [ {
        "annotationTemplate" : true,
        "text" : "I dag är det vackert vårväder!"
      } ],
      "itemcode" : "demo_99",
      "recduration" : 4000,
      "recinstructions" : {
        "recinstructions" : "Please read:"
      }
    }
  },
  {
    "recordingFileId": "5678",
    "session": 2,
    "date" : "2020-06-10T20:04:44.123+01:00",
    "version": 0,
    "recording": {
      "itemcode": "N0",
      "recduration": 10000,

      "recinstructions": {
        "recinstructions": "Please answer:"
      },
      "mediaitems": [
        {
          "annotationTemplate": false,
          "autoplay": false,
          "mimetype": "text/plain",
          "text": "What's your name?"
        }
      ]
    }
  },
  {
    "recordingFileId": "9999",
    "session": 2,
    "date" : "2020-06-15T 18:05:19.000+01:00",
    "version": 1,
    "recording": {
      "itemcode": "N0",
      "recduration": 10000,

      "recinstructions": {
        "recinstructions": "Please answer:"
      },
      "mediaitems": [
        {
          "annotationTemplate": false,
          "autoplay": false,
          "mimetype": "text/plain",
          "text": "What's your name?"
        }
      ]
    }
  }
]
```

5. Get the recording file:
Path: GET {apiEndPoint}project/{projectId}/session/{sessionId}/recfile
Accept: audio/wav

Content-type: audio/wav

   API v2 extension: 
   The server must be able to deliver sections of a recording file as a valid WAVE file.
   The section will be selected by the query parameters `startFrame` for the start position and `frameLength` for the length of the section.
   The client will not send this queries with API v1.

Path: GET {apiEndPoint}project/{projectId}/session/{sessionId}/recfile?startFrame={startFrame}&frameLength={frameLength}
Accept: audio/wav

Content-type: audio/wav

6. Save edit selection:

Path: PATCH {apiEndPoint}recordingfile/{recordingFileId}

Accept: application/json

Sends `editSampleRate`,`editStartFrame` and `editEndFrame` sample position properties of the selection, for example:

```
{
"editSampleRate": 48000,
"editStartFrame":182360,
"editEndFrame":303934
}
```

or null values to remove the edit selection:

```
{
"editSampleRate": null,
"editStartFrame":null,
"editEndFrame":null
}
```


### Development server

Run `ng serve` for a development server.
Navigate to `http://localhost:4200/spr/session/2` start a demo recording session. 
Or edit/view a test recording file ID 1234 from the demo database:
`http://localhost:4200/spr/db/recordingfile/1234`

The app will automatically reload if you change any of the source files.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.


### Build module

Run `npm run build_module` to build the module. The build artifacts will be stored in the `dist/speechrecorderng` directory.


### Clean dist

Remove folder `dist`.
