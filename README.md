# SpeechRecorderNg

A Speech Recording Tool implemented as an Angular module.


This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 1.1.0.

## Integrate SpeechRecorder module to your web application

### Install NPM package
Speechrecorder module is available as NPM package.
Add `"speechrecorderng": "^0.0.16"` to the `dependencies` array property in the `package.json` file of your application. Run `npm install` to install the package.
### Module integration
Add SpeechRecorderNg module to imports property of your `AppModule` annotation. The module main component `SpeechRecorder` should be activated by an Angular route.


#### Example `app.module.ts`
```
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import {SpeechRecorder, SpeechRecorderConfig, SpeechRecorderModule} from 'speechrecorderng'
import {RouterModule, Routes} from '@angular/router';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MdButtonModule, MdDialogModule, MdIconModule, MdMenuModule, MdToolbarModule} from "@angular/material";

const MY_APP_ROUTES: Routes = [
  { path: 'spr', component: SpeechRecorder}
];

const SPR_CFG:SpeechRecorderConfig={
  apiEndPoint: '/myapppath/api/v1'
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    RouterModule.forRoot(MY_APP_ROUTES),BrowserModule,BrowserAnimationsModule,SpeechRecorderModule.forRoot(SPR_CFG)
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
  "project": {
    "name": "My project",
    "audioFormat" : {
      "channels": 1
    },
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
        "promptUnits": [
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
        ],
        "training": false
      },{
         "mode": "AUTOPROGRESS",
         "name": "Recording Session",
         "promptUnits": [
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
           
```  

### Recording file

SpeechRecorder stores the recording in browser memory first. The recordings are then uploaded to the server as binary encoded WAVE files.

Path: POST {apiEndPoint}session/{sessionId}/recfile/{itemcode}

Content-Type: audio/wave

There might be multiple uploads for one recording item, when the subject repeats a recording. The server is responsible to handle this uploads.
A GET request to the URL should return the latest upload.  


   
## Development

The Git package contains a main application to test the module.
The code for the module is in `src/module`, the application code in `src/app`.

### Development server

Run `npm run start` or `ng serve` for a development server. Navigate to `http://localhost:4200/spr/session/2`. The app will automatically reload if you change any of the source files.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.


### Build module

Run `npm run module_transpile` and `npm run rollup_module` to build the module. The build artifacts will be stored in the `dist/module` directory.
Copy `module_package.json` to `dist/module/package.json` and change to directory `dist/module`.
Run `npm pack` to pack the NPM package.  
