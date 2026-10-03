import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {ProjectService, SPEECHRECORDER_CONFIG, ScriptService} from 'speechrecorderng';
import {APP_ROUTES} from './app/app.routes';
import {BankApiService} from './app/core/bank-api.service';
import {DrawApiService} from './app/core/draw-api.service';
import {MediaService} from './app/core/media.service';
import {ScriptApiService} from './app/core/script-api.service';
import {EDITOR_CFG} from './app/editor.config';
import {AppShell} from './app/shell/app-shell';

/**
 * The editor bootstraps without the library's NgModule: importing it would register the recorder's
 * routes and pull in every recorder component (README §4.3, A2). Only the library's injectables
 * and model types are used.
 */
bootstrapApplication(AppShell, {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    {provide: SPEECHRECORDER_CONFIG, useValue: EDITOR_CFG},
    ProjectService,
    ScriptService,
    ScriptApiService,
    BankApiService,
    DrawApiService,
    MediaService,
  ],
});
