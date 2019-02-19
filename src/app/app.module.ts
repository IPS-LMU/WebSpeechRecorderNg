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
  MatMenuModule,
  MatToolbarModule
} from "@angular/material";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";
import {AudioModule} from "../../projects/speechrecorderng/src/lib/audio/audio.module";
import {SPR_CFG} from "./app.config";
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
    AppComponent,StartComponent,SessionsComponent,ScriptsComponent, ProjectsComponent
  ],

  imports: [
      RouterModule.forRoot(appRoutes),FormsModule,ReactiveFormsModule,FlexLayoutModule,BrowserAnimationsModule,MatCardModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatInputModule,MatDialogModule,

    BrowserModule,SpeechrecorderngModule.forRoot(SPR_CFG),AudioModule, ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
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
    let apiTypeStr=environment.apiType;
    console.log("API Mode: "+apiTypeStr)
    if(apiTypeStr==='standalone'){
      SPR_CFG.apiType=ApiType.STANDALONE
    }else if(apiTypeStr==='files'){
      SPR_CFG.apiType=ApiType.FILES
    }else if(apiTypeStr==='normal'){
      SPR_CFG.apiType=ApiType.NORMAL
    }

  }
}

