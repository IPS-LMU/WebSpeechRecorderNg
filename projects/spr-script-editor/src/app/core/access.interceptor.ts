import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, throwError} from 'rxjs';
import {AccessService} from './access.service';

/**
 * Feeds the deployment's access answers into `AccessService` (ui-spec §1): a `401` means "sign in
 * there", a `403` means "read-only from here on". The error is rethrown unchanged, so the screen that
 * made the call still reports it in its own words; this only adds the app-wide state.
 */
export const accessInterceptor: HttpInterceptorFn = (request, next) => {
  const access = inject(AccessService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          access.noteUnauthorised();
        } else if (error.status === 403) {
          access.noteForbidden();
        }
      }
      return throwError(() => error);
    }),
  );
};
