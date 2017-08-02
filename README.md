# SpeechRecorderNg

A Speech Recording Tool implemented as an Angular module.


This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 1.1.0.

## Integrate SpeechRecorder module to your web application

### Install NPM package
Speechrecorder module is provided as NPM package.
Add `"speechrecorderng": "^0.0.11"` to the `dependencies` property in the `package.json` file of your application. Run `npm install` to install the package.
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
  apiEndPoint: '/myapppath/api/v1',
  apiType: null
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
 Speechrecorder is intended to run in a fit-to-page layout without scrollbars. The subject should not be distracted from performing the recording session.
 Therefore the module should be embedded in HTML page with 100% height and without padding or margin.
#### Example `index.html`
 ```
   <!doctype html>
   <html lang="en" style="height:100%;margin:0;padding:0">
   <head>
     <meta charset="utf-8">
     <title>WikiSpeechNg</title>
     <base href="/">
   
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <link rel="icon" type="image/x-icon" href="favicon.ico">
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
