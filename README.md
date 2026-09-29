# SpeechRecorderNg

A Speech Recording Tool implemented as an Angular 20 module.

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

The demo application and the library are themed with the Umeå University palette — see
[Theme in the module README](projects/speechrecorderng/README.md#theme-umeå-university) for
the full token list, the consumer setup and the
[migration notes](projects/speechrecorderng/README.md#migrating-from-the-previous-theme).

Short version:

* `src/main.scss` builds the Material theme from the brand tone ramps
  (`projects/speechrecorderng/src/lib/theme/_palette.scss`) and then emits the semantic
  tokens and the Material role pins (`_tokens.scss`) — at the top level, because a token
  block nested inside another selector would compile to a selector that never matches.
* Components never contain a colour literal; they use `var(--spr-*, <fallback>)`.
* Canvas painters (waveform, spectrogram, level meter, traffic light) resolve the same
  tokens through `sprToken()` in `projects/speechrecorderng/src/lib/theme/theme.ts`.
* `bin/theme_audit.mjs` verifies the result (legacy literals, WCAG AA contrast, minimum
  text size, token pin integrity, no document scrollbars) against a running dev server:

```sh
npm run serve:api   # the API the development server proxies /api/v1 to
npm start
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 about:blank &
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr --viewports 1024x768,1366x768,1568x1334,1920x1080
```

States behind an interaction (the detailed audio view, the error dialog, the dark scheme) are
reached with `--prepare bin/audit/<fixture>.js`, e.g.

```
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr/session/2 \
  --prepare bin/audit/open-error-dialog.js
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr \
  --prepare bin/audit/use-dark-scheme.js
```

* `bin/layout_probe.mjs` measures what a screenshot cannot: where the instruction line's text sits
  against the centre line of the header it is in — it belongs centred, in the operator's window and
  in the respondent mirror, whose caption is larger — and which branding mark each slot shows at a
  given width. It drives Chrome over the DevTools protocol like the audit, or Safari over WebDriver,
  and exits non-zero when the line leaves `--tolerance` (1px) or a page overflows its viewport:

```
node bin/layout_probe.mjs --url http://127.0.0.1:4200/spr/session/2 \
  --mirror http://127.0.0.1:4200/spr/respondent/2 --viewports 1568x986,1280x800

# Safari: allow remote automation in the Develop menu, quit Safari first (the driver starts its
# own instance and an already running one never answers), then
/usr/bin/safaridriver -p 4459 &
node bin/layout_probe.mjs --browser safari --url http://127.0.0.1:4200/spr/session/2 \
  --mirror http://127.0.0.1:4200/spr/respondent/2
```

`--mirror` opens the recorder first, because the mirror renders only while a recorder publishes a
stage. Both tools read the same running dev server, so run one at a time.

The dark scheme is opt-in with `<html data-spr-scheme="dark">`; the demo application ships its
tokens, and the audio canvases repaint on the switch (`theme.ts` watches the attribute).

Deployment logos (VISP, SWE-CLARIN, BAS, CLARIN-D) are configured in `src/app/app.config.ts`
and served from `src/assets/img`; the library renders them into four slots without shipping
any asset — see
[Logos in the module README](projects/speechrecorderng/README.md#logos-branding). Those marks
belong to their owners and are **not** covered by this repository's MIT licence; keep them
unmodified and in proportion.

## Languages

The demo application ships English and Swedish: Transloco loads `src/assets/i18n/<lang>.json`,
the toolbar menu switches language, the choice is remembered in `localStorage` under `spr.lang`,
and `<html lang>` follows. Swedish is the default: a stored choice wins, then a browser that
prefers English or Swedish, then Swedish. The recorder's own strings come from the library's
catalogue through the `SPEECHRECORDER_STRINGS` token (see
[Translations in the module README](projects/speechrecorderng/README.md#translations)) — one
switch covers the whole application.

* `npm run build:i18n` — regenerate the catalogues from the library's `SPR_STRINGS` plus the
  shell's strings. It fails when a Swedish value is missing, rather than shipping English.
* `npm run validate:i18n` — fail on a locale that misses a key, an empty value, or a key used in
  the source that no catalogue defines.

Audit a locale with the existing harness:

```
node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr --prepare bin/audit/use-locale-sv.js \
  --viewports 1024x768,1568x1334
```

The font is Inter (loaded from Google Fonts in `src/index.html`) with a
`Helvetica Neue`/system fallback: an offline deployment keeps working, and
`--spr-font-family` switches the whole application to a local font stack.

### Respondent display

The prompt stage can be mirrored to a second window for a respondent reading on their own screen:
press `D` (configurable through `respondentDisplayKey` in the environment's
`SpeechRecorderConfig`) or use the button in the transport bar. The mirror shows the instruction
line, the prompt and the start/stop light — no progress rail, no audio view, no transport. The
deployment's prompt-stage mark sits at the bottom left of the prompt area in both windows, and the
respondent window carries none of the application chrome. It is the library route
`spr/respondent/:id`; see the
[module README](projects/speechrecorderng/README.md#respondent-display) for the transport, the
browser requirement and how a window opened by hand connects.

Popups must be allowed for the site: the key press opens a real window, and a blocked popup is
reported in the status line instead of failing silently.

### Recording device

The audio view (the one with the spectrogram) has a microphone picker in its top right corner: it
lists the input devices, remembers the choice in the browser and takes effect at the next
recording (or immediately, between takes). A project that names a required device in its
`audioDevices` list keeps precedence; see the
[module README](projects/speechrecorderng/README.md#recording-device).

### Deployment on the server
See [Angular Deployment/Server Configuration](https://angular.io/guide/deployment#server-configuration) for details.

To distinguish between the REST API base paths and the path for the web application the application should not be deployed to the top level directory of your Web-server.
Choose an arbitrary base path for the app e.g. `/wsr/ng/dist/` and build the app accordingly:
```
ng build --base-href=/wsr/ng/dist/
```
`ng build` is the production configuration: configure `src/environments/environment.prod.ts` before building (see [Configuration](#configuration)).

Copy the dist folder to ```/wsr/ng/``` on your Web-Server and setup the fallback configuration for this path in your Web-Server.


   
### Server REST API

SpeechRecorder requires a HTTP server providing a REST API. The server code is not part of this package.
The package only contains a minimal file structure for testing. The files reside in `src/test`.

Versions 2.x.x of WebSpeechRecorderNg use the REST API version v1, Versions 3.x.x may use API version v1 and  v2. Set environment property apiVersion accordingly (default: `apiVersion: 1`) 

#### Evaluation receiver

`server/` contains a receiver for evaluating the recorder without writing a backend first: it
serves the built application and implements the API described below (v1 and v2), writing every
upload into a data directory.

```
npm run build          # production build, configured by src/environments/environment.prod.ts
npm run serve:api      # http://127.0.0.1:8080, API base /api/v1
```

Then open `http://127.0.0.1:8080/spr/session/2` (the recordings of the seeded fixture session), or
any other session id, and `http://127.0.0.1:8080/recorder/session/2` for the UUID keyed recorder.
Sessions that do not exist yet are created on first load for the project and script of the seeded
fixtures (`--no-auto-create` turns that off). Recordings, their metadata, the chunk upload state and
the idempotency journal are written to `server/data` (`--data <dir>`), in the same layout as the
`src/test` fixtures the directory is seeded from. `node server/server.mjs --help` lists the options,
among them `--port`, `--api-base` (must equal the `apiEndPoint` of the environment file), `--seed`
and `--app none` when only the API is wanted. Every request is logged to stdout with status, size
and duration, uploads additionally with the recording file id and chunk count.

The receiver tolerates the upload order of the current client, which queues the
`concatChunksRequest` of a stopped recording *before* the chunk it encodes asynchronously: a concat
that is still missing chunks is answered with `{"stored":true,"pending":true}` (after
`--concat-wait-ms`, for chunks that are merely in flight) and the recording is concatenated and
published as soon as the remaining chunks have arrived. A chunk session that never completes stays
in the data directory and is reported in the log instead of being published truncated.

`ng serve` uses the receiver as well: `src/environments/environment.ts` (the tracked default of
`ng serve` and `ng build --configuration development`) sets `apiType: 'normal'` and
`apiEndPoint: '/api/v1'`, and `proxy.conf.json` forwards `/api/v1` to `http://127.0.0.1:8080`.
Start the receiver in one terminal and the development server in another:

```sh
npm run serve:api   # terminal 1: the API, storing uploads in server/data
npm start           # terminal 2: http://127.0.0.1:4200/spr/session/2
```

The endpoint stays relative and the browser only ever talks to the origin it loaded the
application from, so no cross origin configuration is needed. Without the receiver the proxy
answers 504 — sessions, scripts and uploads all come from the API.

## Configuration

By default the API Endpoint ({apiEndPoint}) is an empty string, the API is then expected to be relative to the base path of the application. 

The application takes its settings from the environment files in `src/environments`:

* `environment.ts` — tracked defaults, used by `ng serve` and `ng build --configuration development`. It records against the evaluation receiver (`apiEndPoint: '/api/v1'`, proxied by `proxy.conf.json`) and uploads every recording; `environment.demo.sample.ts` is the variant that only reads the `src/test` fixtures.
* `environment.prod.sample.ts` — the template for a deployment.
* `environment.prod.ts` — deployment specific and **not tracked by git**. Production builds (`npm run build`/`ng build`, the default configuration) replace `environment.ts` with it, see the `fileReplacements` entry of `WebSpeechRecorderNg:build:production` in `angular.json`.

`npm run build` creates `environment.prod.ts` from the sample when it is missing, so a fresh checkout builds with the sample's defaults. For a real deployment copy the sample and edit the endpoint and options — the copy stays out of the repository, so deployment settings are never committed:

```
cp src/environments/environment.prod.sample.ts src/environments/environment.prod.ts
```


## SpeechRecorder REST API description

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
 * text: string: Text to prompt

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

### Recording file

SpeechRecorder stores the recording in browser memory first. The recordings are then uploaded to the server as binary encoded WAVE files.

Path: POST {apiEndPoint}session/{sessionId}/recfile/{itemcode}

Content-Type: audio/wav

There might be multiple uploads for one recording item, when the subject repeats a recording. The server is responsible to handle this uploads.
The server should apply a unique identifier for each uploaded recording file. Subsequent recording uploads for the same itemcode should get different IDs and should be stored with a version number starting with zero.    
A GET request to the URL should return the latest upload.  

### Start a recording session

The default routing path to start a recording session is `/spr/session/{sessionId}`. If you call this router link from your Angular application
WebSpeechRecorderNg should start and will try to load the session data from the REST API first.
 
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

The development server takes its data from the evaluation receiver and stores what it records
there: start `npm run serve:api` (terminal 1) before `npm start` (terminal 2). `/api/v1` requests
are proxied to `http://127.0.0.1:8080` by `proxy.conf.json`, and the receiver writes every
recording to `server/data/recordingfile`. See
[Evaluation receiver](#evaluation-receiver). To run without a backend on the `src/test` fixtures,
copy `src/environments/environment.demo.sample.ts` over `src/environments/environment.ts`.

The app will automatically reload if you change any of the source files.

### Build

Run `npm run build` to build the application (production, the default configuration). The build artifacts will be stored in the `dist/WebSpeechRecorderNg` directory. Use `npm run watch` or `ng build --configuration development` for a development build.

The production build reads `src/environments/environment.prod.ts`, which is deployment specific and not tracked: `npm run build` creates it from `environment.prod.sample.ts` when it is missing, see [Configuration](#configuration).


### Build module

Run `npm run build_module` to build the module. The build artifacts will be stored in the `dist/speechrecorderng` directory.


### Clean dist

Remove folder `dist`.
