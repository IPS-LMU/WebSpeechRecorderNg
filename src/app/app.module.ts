import {inject, NgModule} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { StartComponent} from "./start/start";
import {AudioDisplay} from '../../projects/speechrecorderng/src/lib/audio/audio_display';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatToolbarModule } from "@angular/material/toolbar";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";
import {SPR_CFG} from "./app.config";
//import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionsComponent} from "./session/sessions";
import {AudioDisplayPlayer} from "../../projects/speechrecorderng/src/lib/audio/audio_player";
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import {provideRouter, RouterModule, Routes, withRouterConfig} from "@angular/router";
import {BundleI18nService} from "../../projects/speechrecorderng/src/lib/i18n/bundle-i18n.service";

import commonBundle from "../../projects/speechrecorderng/src/lib/i18n/common.json";




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

function createBundleI18Service():BundleI18nService {
  // See https://stackoverflow.com/a/78570386
  // let bs = inject(BundleI18nService,{optional:true,self:true});
  // if (bs) {
  //   console.info("Bundle service already exists");
  // }else{
    console.info("Spr app: Initialize bundle service...");
    let bs = new BundleI18nService();
    bs.name='App-Module Bundle-service';
  //}
  bs.putMultiLangBundleData(commonBundle);
  bs.fallBackLanguage='en';
  return bs;
}

@NgModule({
  declarations: [
    AppComponent,SessionsComponent,StartComponent
  ],
  imports: [
    RouterModule.forRoot(appRoutes, {}),
    BrowserAnimationsModule,
    MatMenuModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,
    BrowserModule,
    SpeechrecorderngModule.forRoot(SPR_CFG)
  ],
  providers: [
    provideRouter(appRoutes, withRouterConfig({canceledNavigationResolution:'computed'})),
    {provide:BundleI18nService,useFactory:createBundleI18Service}
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
