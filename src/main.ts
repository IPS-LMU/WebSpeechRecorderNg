import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import {bootstrapApplication} from "@angular/platform-browser";
import {AppComponent} from "./app/app.component";
import {appConfig} from "./app/app.config";

if (environment.production) {
  enableProdMode();
}
// Still bootstrap the NgModule not the AppComponent
// because the module includes the routes of the speechrecorderng module

platformBrowserDynamic().bootstrapModule(AppModule)
 .catch(err => console.error(err));


//bootstrapApplication(AppComponent,appConfig)
//  .catch((err) => console.error(err));
