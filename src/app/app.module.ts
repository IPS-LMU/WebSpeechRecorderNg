import {inject, NgModule, provideAppInitializer} from '@angular/core';
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
import {provideTransloco, TranslocoModule, TranslocoService} from "@jsverse/transloco";
import {SprTranslocoLoader} from "../../projects/speechrecorderng/src/lib/i18n/sprTranslocoLoader";
import {HttpClient} from "@angular/common/http";
import {SPEECHRECORDER_CONFIG} from "../../projects/speechrecorderng/src/lib/spr.config";

import { getBrowserLang } from '@jsverse/transloco';


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
    // TranslocoModule.forRoot({
    //   loader: {
    //     provide: TranslateLoader,
    //     useClass: SprTranslateLoader,
    //     deps: [HttpClient,SPEECHRECORDER_CONFIG]
    //   },
    //   //missingTranslationHandler: {provide: MissingTranslationHandler, useClass: SprMissingTranslationHandler},
    //   useDefaultLang: true,
    //   defaultLanguage: 'en'
    // }),
    TranslocoModule,
    BrowserAnimationsModule,
    MatMenuModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,
    BrowserModule,
    SpeechrecorderngModule.forRoot(SPR_CFG)
  ],
  providers: [
    provideRouter(appRoutes, withRouterConfig({canceledNavigationResolution:'computed'})),
    provideTransloco({
      config: {
        availableLangs: ['en', 'de'],
        // Remove this option if your application doesn't support changing language in runtime.
        reRenderOnLangChange: false
        //prodMode: !isDevMode(),
      },
      loader: SprTranslocoLoader
    }),
    provideAppInitializer(()=>{
      const translate=inject(TranslocoService);
      if(translate) {
        const browserLang = getBrowserLang();
        if (browserLang) {
          translate.setActiveLang(browserLang);
          console.info("Transloco service language to use set to: "+browserLang);
        }else{
          console.error("Could not initialize transloco service language to use: Browser language not set.");
        }
      }else{
        console.error("Could not initialize transloco service: Service not injected.");
      }
    }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
