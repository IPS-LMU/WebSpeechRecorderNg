/**
 * The interceptor that turns the deployment's own answers into app-wide state (ui-spec §1): a `403`
 * keeps the editor read-only, a `401` sends the browser to the login. The screen that made the call
 * still sees its error — the interceptor adds state, it does not swallow anything.
 */
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AccessService} from './access.service';
import {accessInterceptor} from './access.interceptor';
import {EDITOR_LOGIN_URL} from '../editor.config';

function setup(loginUrl = '') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([accessInterceptor])),
      provideHttpClientTesting(),
      {provide: EDITOR_LOGIN_URL, useValue: loginUrl},
    ],
  });
  return {access: TestBed.inject(AccessService), client: TestBed.inject(HttpClient), http: TestBed.inject(HttpTestingController)};
}

describe('accessInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('turns a 403 into read-only and still reports the failure to the caller', () => {
    const {access, client, http} = setup();
    const seen: unknown[] = [];
    client.get('/api/v1/project/Demo1/script').subscribe({error: (error: unknown) => seen.push(error)});

    http.expectOne('/api/v1/project/Demo1/script')
      .flush({error: 'FORBIDDEN', message: 'read-only'}, {status: 403, statusText: 'Forbidden'});

    expect(access.readOnly()).toBe(true);
    expect(seen.length).withContext('the caller still sees its own error').toBe(1);
  });

  it('asks for a sign-in on a 401 the deployment gave no login for', () => {
    const {access, client, http} = setup('');
    client.get('/api/v1/project/Demo1/script').subscribe({error: () => undefined});

    http.expectOne('/api/v1/project/Demo1/script')
      .flush({error: 'UNAUTHORISED', message: 'sign in'}, {status: 401, statusText: 'Unauthorized'});

    expect(access.signInRequired()).toBe(true);
    expect(access.readOnly()).toBe(false);
  });

  it('leaves other failures alone', () => {
    const {access, client, http} = setup();
    client.get('/api/v1/project/Demo1/script').subscribe({error: () => undefined});

    http.expectOne('/api/v1/project/Demo1/script')
      .flush({error: 'BOOM'}, {status: 500, statusText: 'Server Error'});

    expect(access.readOnly()).toBe(false);
    expect(access.signInRequired()).toBe(false);
  });
});
