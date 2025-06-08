import {inject, LOCALE_ID, NgModule} from '@angular/core';
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
import {BundleI18nServiceImpl} from "../../projects/speechrecorderng/src/lib/i18n/bundle-i18n-service.service";

import commonBundle from "../../projects/speechrecorderng/src/lib/i18n/common.json";
import {Locale} from "../../projects/speechrecorderng/src/lib/i18n/locale.utils";




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

function createBundleI18Service():BundleI18nServiceImpl {
  // See https://stackoverflow.com/a/78570386
  // let bs = inject(BundleI18nService,{optional:true,self:true});
  // if (bs) {
  //   console.info("Bundle service already exists");
  // }else{
    console.info("Spr app: Initialize bundle service...");
    let bs = new BundleI18nServiceImpl();
    bs.name='App-Module Bundle-service';
  //}
  bs.putMultiLangBundleData(commonBundle);
  bs.fallBackLanguage='en';
  return bs;
}
const SUPPORTED_LANGUAGES=['en','de'];

function localeProvider():string{
  const nlStr=navigator.language;
  const nl=Locale.parseLocaleStr(nlStr);
  const nlLang=nl.lang;
  if(SUPPORTED_LANGUAGES.includes(nlLang)){
    console.info("Language \'"+nlLang+"’\' supported. Providing locale: "+nlStr);
    return nlStr;
  }else{
    // Fallback to en-US to keep Angular pipes working
    console.info("Language \'"+nlLang+"’\' not supported. Falling back to 'en-US'");
    return 'en-US';
  }
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
    {provide: LOCALE_ID, useFactory:localeProvider},
    {provide:BundleI18nServiceImpl,useFactory:createBundleI18Service}
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
