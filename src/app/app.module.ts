import { BrowserModule } from '@angular/platform-browser';
import { NgModule} from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { StartComponent} from "./start/start";
import {AudioDisplay} from '../../projects/speechrecorderng/src/lib/audio/audio_display';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MatButtonModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule, MatInputModule,
  MatMenuModule,
  MatToolbarModule
} from "@angular/material";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";
import {AudioModule} from "../../projects/speechrecorderng/src/lib/audio/audio.module";
import {SPR_CFG} from "./app.config";
import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionsComponent} from "./session/sessions";
import {AudioDisplayPlayer} from "../../projects/speechrecorderng/src/lib/audio/audio_player";
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { ProjectsComponent } from './project/projects/projects.component';
import {APP_BASE_HREF} from '@angular/common';
import {SprDb} from "./db/inddb";
import {SessionService} from "../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";


const appRoutes: Routes = [

  { path: 'wsp/project',
    component: ProjectsComponent
  },
  { path: 'wsp/project/:projectName/session',
    component: SessionsComponent
  },
    { path: 'test',
        redirectTo: 'session/',
        pathMatch: 'full'
    },
    { path: 'audio_display', component: AudioDisplayPlayer
    },

  { path: '**', component: StartComponent  }
];

@NgModule({
  declarations: [
    AppComponent,StartComponent,SessionsComponent, ProjectsComponent
  ],

  imports: [
      RouterModule.forRoot(appRoutes),FlexLayoutModule,BrowserAnimationsModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,

    BrowserModule,SpeechrecorderngModule.forRoot(SPR_CFG),AudioModule, ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
  ],
  providers: [
      {provide: APP_BASE_HREF, useValue: '/'},
      {provide: SprDb,
    useFactory: SprDb.sprDbFactory,
    deps: []}
      ],

  bootstrap: [AppComponent]
})
export class AppModule { }

