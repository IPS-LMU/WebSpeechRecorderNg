import {ModuleWithProviders, NgModule} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { StartComponent} from "./start/start";

import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatToolbarModule } from "@angular/material/toolbar";
import {SPR_CFG} from "./app.config";

import {SessionsComponent} from "./session/sessions";

import {RouterModule, Routes} from "@angular/router";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSidenavModule} from "@angular/material/sidenav";
import {SPEECHRECORDER_CONFIG,
  SpeechrecorderngModule,AudioDisplayPlayer,ProjectService
} from 'speechrecorderng'




const appRoutes: Routes = [

  { path: 'session',
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
    AppComponent,SessionsComponent,StartComponent
  ],
  imports: [
    RouterModule.forRoot(appRoutes, {}),
    BrowserAnimationsModule,
    MatMenuModule, MatFormFieldModule, MatInputModule, MatToolbarModule, MatMenuModule, MatIconModule, MatButtonModule, MatDialogModule,
    BrowserModule,
    SpeechrecorderngModule.forRoot(SPR_CFG), MatCardModule, MatCheckboxModule, MatSidenavModule
  ],
  providers: [ProjectService],
  bootstrap: [AppComponent]
})
export class AppModule {
  static forRoot(): ModuleWithProviders<AppModule> {
    return {
      ngModule: AppModule,
      providers: [
        {provide:  SPEECHRECORDER_CONFIG, useValue: SPR_CFG}
      ]
    };
  }
}
