import { BrowserModule } from '@angular/platform-browser';
import { NgModule} from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { StartComponent} from "./start/start";
import {AudioDisplay} from '../module/audio/audio_display';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MatButtonModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule, MatInputModule,
  MatMenuModule,
  MatToolbarModule
} from "@angular/material";
import {SpeechRecorderModule} from "../module/speechrecorder/spr.module";
import {AudioModule} from "../module/audio/audio.module";
import {SPR_CFG} from "./app.config";
import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionsComponent} from "./session/sessions";



const appRoutes: Routes = [

  { path: 'session',
    component: SessionsComponent
  },
    { path: 'test',
        redirectTo: 'session/',
        pathMatch: 'full'
    },
    { path: 'audio_display', component: AudioDisplay
    },
  { path: '**', component: StartComponent  }
];

@NgModule({
  declarations: [
    AppComponent,StartComponent,SessionsComponent
  ],

  imports: [
      RouterModule.forRoot(appRoutes),FlexLayoutModule,BrowserAnimationsModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,

    BrowserModule,SpeechRecorderModule.forRoot(SPR_CFG),AudioModule
  ],
  providers: [],

  bootstrap: [AppComponent]
})
export class AppModule { }

