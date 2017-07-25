import { BrowserModule } from '@angular/platform-browser';
import { NgModule} from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import {AudioDisplay} from '../module/audio/audio_display';
import {HttpModule} from "@angular/http";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MdButtonModule, MdDialogModule, MdIconModule, MdMenu, MdMenuItem, MdMenuModule,
  MdToolbarModule
} from "@angular/material";
import {AudioDisplayDialog} from "../module/audio/audio_display_dialog";
import {SpeechRecorderModule} from "../module/speechrecorder/spr.module";
import {AudioModule} from "../module/audio/audio.module";
import {SPR_CFG} from "./app.config";


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
    BrowserModule,SpeechRecorderModule.forRoot(SPR_CFG),AudioModule
  ],
  providers: [],

  bootstrap: [AppComponent]
})
export class AppModule { }

