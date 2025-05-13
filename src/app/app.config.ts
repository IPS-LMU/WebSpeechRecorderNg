import {ApiType, SpeechRecorderConfig} from "../../projects/speechrecorderng/src/lib/spr.config";
import {environment} from "../environments/environment";
import {PreloadAllModules, provideRouter, withPreloading} from '@angular/router';
import { appRoutes } from './app.routes';
import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from "@angular/core";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";

export const SPR_CFG: SpeechRecorderConfig = {
  apiEndPoint: environment.apiEndPoint,
  apiType: (environment.apiType==='files')?ApiType.FILES:ApiType.NORMAL,
  apiVersion:environment.apiVersion,
  withCredentials:true,
  enableDownloadRecordings: environment.enableDownloadRecordings,
  enableUploadRecordings: environment.enableUploadRecordings
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(appRoutes),
    importProvidersFrom(
      SpeechrecorderngModule.forRoot(SPR_CFG)
    ),
  ],

};

