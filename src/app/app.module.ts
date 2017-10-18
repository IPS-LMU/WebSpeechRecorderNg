import { BrowserModule } from '@angular/platform-browser';
import { NgModule} from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import {AudioDisplay} from '../module/audio/audio_display';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MatButtonModule, MatDialogModule, MatIconModule, MatMenu, MatMenuItem, MatMenuModule,
  MatToolbarModule
} from "@angular/material";
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

  imports: [
      RouterModule.forRoot(appRoutes),BrowserAnimationsModule,MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,

    BrowserModule,SpeechRecorderModule.forRoot(SPR_CFG),AudioModule
  ],
  providers: [],

  bootstrap: [AppComponent]
})
export class AppModule { }

