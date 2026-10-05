import {provideHttpClient, withInterceptors, withInterceptorsFromDi} from '@angular/common/http';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {accessInterceptor} from './app/core/access.interceptor';
import {EDITOR_PROVIDERS} from './app/app.providers';
import {APP_ROUTES} from './app/app.routes';
import {AppShell} from './app/shell/app-shell';

/**
 * The editor bootstraps without the library's NgModule: importing it would register the recorder's
 * routes and pull in every recorder component (README §4.3, A2). Only the library's injectables
 * and model types are used.
 *
 * The app-scoped provider list lives in `app/app.providers.ts` so route-level specs mount the real
 * `APP_ROUTES` over the real providers.
 */
bootstrapApplication(AppShell, {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([accessInterceptor])),
    ...EDITOR_PROVIDERS,
  ],
});
