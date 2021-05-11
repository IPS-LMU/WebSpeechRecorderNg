# SpeechRecorderNg

A Speech Recording Tool implemented as an Angular 11 module.


This project was generated with [Angular CLI](https://github.com/angular/angular-cli).

## Integrate SpeechRecorder module to your web application

### Install NPM package
Speechrecorder module is available as NPM package.
Add `"speechrecorderng": "2.17.0"` to the `dependencies` array property in the `package.json` file of your application. Run `npm install` to install the package.
### Module integration
Add SpeechRecorderNg module to imports property of your `AppModule` annotation. The module main component `SpeechRecorder` should be activated by an Angular route.

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
   
### Deployment on the server
See [Angular Deployment/Server Configuration](https://angular.io/guide/deployment#server-configuration) for details.

To distinguish between the REST API base paths and the path for the web application the application should not be deployed to the top level directory of your Web-server.
Choose an arbitrary base path for the app e.g. `/wsr/ng/dist/` and build the app accordingly:
```
ng build --base-href=/wsr/ng/dist/ --prod
```
Copy the dist folder to ```/wsr/ng/``` on your Web-Server and setup the fallback configuration for this path in your Web-Server.


   
### Server REST API

SpeechRecorder requires a HTTP server providing a REST API. The server code is not part of this package.
The package only contains a minimal file structure for testing. The files reside in `src/test`.

## Configuration

By default the API Endpoint ({apiEndPoint}) is an empty string, the API is then expected to be relative to the base path of the application. 


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
                  "text": "Willkommen bei der IPS-Sprachaufnahme!"
                }
              ],
              
            },
            {
              "itemcode": "I1",
              "mediaitems": [
                {
                  "text": "Hier steht der Prompt; ein kurzer Text, den Sie lesen, eine Frage, die Sie beantworten oder ein Bild, das Sie beschreiben sollen."
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
The server should apply an unique identifier for each uploaded recording file. Subsequent recording uploads for the same itemcode should get different IDs and should be stored with a version number starting with zero.    
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
        "text" : "Heute ist schönes Frühlingswetter!"
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

5. Save edit selection:

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
