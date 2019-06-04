import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AppComponent} from './app.component';
import {StartComponent} from "./start/start";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MatButtonModule, MatCardContent, MatCardModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule, MatProgressSpinnerModule, MatSortModule, MatTableModule,
  MatToolbarModule, MatTooltipModule
} from "@angular/material";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";
import {AudioModule} from "../../projects/speechrecorderng/src/lib/audio/audio.module";
import {SPR_CFG} from "../environments/environment";
import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionsComponent} from "./session/sessions";
import {AudioDisplayPlayer} from "../../projects/speechrecorderng/src/lib/audio/audio_player";
import {ServiceWorkerModule} from '@angular/service-worker';
import {environment} from '../environments/environment';
import {ProjectsComponent} from './project/projects/projects.component';
import {SprDb} from "../../projects/speechrecorderng/src/lib/db/inddb";
import {ApiType, SpeechrecorderngComponent} from "../../projects/speechrecorderng/src/public_api";
import {ScriptsComponent} from "./script/scripts";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {UniqueProjectNameValidator} from "./project/projects/project.name.validator";
import {CommonModule} from "@angular/common";
import { ProjectComponent } from './project/project/project.component';


const appRoutes: Routes = [

  { path: 'wsp/project',
    component: ProjectsComponent
  },
  { path: 'wsp/project/:projectName/session',
    component: SessionsComponent
  },
  { path: 'wsp/project/:projectName/session/:sessionId',
    component: SpeechrecorderngComponent
  },
  { path: 'wsp/project/:projectName/script',
    component: ScriptsComponent
  },
  { path: 'spr',
    component: SpeechrecorderngComponent
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
    AppComponent,StartComponent,SessionsComponent,ScriptsComponent, ProjectsComponent, ProjectComponent
  ],

  imports: [
      RouterModule.forRoot(appRoutes),FormsModule,ReactiveFormsModule,FlexLayoutModule,BrowserAnimationsModule,MatCardModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatInputModule,MatDialogModule,MatProgressSpinnerModule,MatTableModule,MatTooltipModule,MatSortModule,

    BrowserModule,SpeechrecorderngModule.forRoot(SPR_CFG),CommonModule,AudioModule, ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
  ],
  providers: [

      {provide: SprDb,
    useFactory: SprDb.sprDbFactory,
    deps: []}
      ],

  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(){

  }
}

