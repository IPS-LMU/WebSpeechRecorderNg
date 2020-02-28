import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AppComponent} from './app.component';
import {StartComponent} from "./start/start";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSortModule } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatTooltipModule } from "@angular/material/tooltip";
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
import {SpeechrecorderngComponent} from "../../projects/speechrecorderng/src/public_api";
import {ScriptsComponent} from "./script/scripts";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import { ProjectComponent } from './project/project/project.component';
import { ScriptComponent } from './script/script.component';
import {MatTreeModule} from "@angular/material/tree";
import {MatNativeDateModule} from "@angular/material/core";


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
  { path: 'wsp/project/:projectName/script/:scriptId',
    component: ScriptComponent
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
    AppComponent,StartComponent,SessionsComponent,ScriptsComponent, ProjectsComponent, ProjectComponent, ScriptComponent
  ],

  imports: [
      RouterModule.forRoot(appRoutes),FormsModule,ReactiveFormsModule,FlexLayoutModule,BrowserAnimationsModule,MatCardModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatInputModule,MatDialogModule,MatProgressSpinnerModule,MatTableModule,MatTooltipModule,MatSortModule,MatTreeModule, MatNativeDateModule,

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

