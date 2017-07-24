import { BrowserModule } from '@angular/platform-browser';
import {Injectable, InjectionToken, NgModule} from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

import {AudioClipUIContainer} from '../module/audio/ui/container';
import {AudioDisplay} from '../module/audio/audio_display';

import { Progress } from '../module/speechrecorder/session/progress'
import {SpeechRecorder} from '../module/speechrecorder/speechrecorder'
import {
  Prompting, PromptContainer, Prompter,
  TransportPanel, StatusDisplay, ControlPanel, ProgressDisplay, SessionManager
} from '../module/speechrecorder/session/sessionmanager';

import { SimpleTrafficLight} from '../module/speechrecorder/startstopsignal/ui/simpletrafficlight'
import {SessionService} from "../module/speechrecorder/session/session.service";
import {HttpModule} from "@angular/http";
import {ScriptService} from "../module/speechrecorder/script/script.service";

import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MdButtonModule, MdDialogModule, MdIconModule, MdMenu, MdMenuItem, MdMenuModule,
  MdToolbarModule
} from "@angular/material";
import {AudioDisplayDialog} from "../module/audio/audio_display_dialog";
import {ScrollIntoViewDirective} from "../module/utils/scrollintoview";
import {SpeechRecorderModule} from "../module/speechrecorder/spr.module";
import {AudioModule} from "../module/audio/audio.module";
import {APP_CONFIG, HERO_DI_CONFIG} from "./app.config";


const appRoutes: Routes = [

    { path: 'test',
        redirectTo: 'session/',
        pathMatch: 'full'
    },
    { path: 'audio_display', component: AudioDisplay
    }
];

@NgModule({
  declarations: [
    AppComponent
  ],
  entryComponents: [
    AudioDisplayDialog
  ],
  imports: [
      RouterModule.forRoot(appRoutes),BrowserAnimationsModule,MdToolbarModule,MdMenuModule,MdIconModule,MdButtonModule,MdDialogModule,
      HttpModule,
    BrowserModule,SpeechRecorderModule,AudioModule
  ],
  providers: [{provide:APP_CONFIG,useValue:HERO_DI_CONFIG}],

  bootstrap: [AppComponent]
})
export class AppModule { }

