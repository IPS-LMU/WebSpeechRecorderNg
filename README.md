# SpeechRecorderNg

A Speech Recording Tool implemented as an Angular 14 module.


This project was generated with [Angular CLI](https://github.com/angular/angular-cli).

## Integrate SpeechRecorder module to your web application

### Install NPM package
Speechrecorder module is available as NPM package.
Add `"speechrecorderng": "3.8.0"` to the `dependencies` array property in the `package.json` file of your application. Run `npm install` to install the package.
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

The REST API for version 3.x.x requires an extended version of the API for the 2.x.x versions. The extension are not yet documented. Please use the 2.x.x versions only. 

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
