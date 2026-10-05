/**
 * The deployment's access answers (ui-spec §1): a `401` sends the browser to the deployment's login
 * with a return URL, a `403` leaves the editor read-only. The URL building is split out of the
 * navigation so these specs can assert it without moving the test browser.
 */
import {TestBed} from '@angular/core/testing';
import {AccessService} from './access.service';
import {EDITOR_LOGIN_URL} from '../editor.config';

function setup(loginUrl = '') {
  TestBed.configureTestingModule({providers: [{provide: EDITOR_LOGIN_URL, useValue: loginUrl}]});
  return TestBed.inject(AccessService);
}

describe('AccessService', () => {
  it('builds the login URL with the editor as its return target', () => {
    const access = setup('/deploy/login');
    expect(access.signInUrl('http://host/wsr/edit/project/Demo1/script'))
      .toBe('/deploy/login?return=http%3A%2F%2Fhost%2Fwsr%2Fedit%2Fproject%2FDemo1%2Fscript');
  });

  it('appends the return parameter to a login URL that already carries a query', () => {
    const access = setup('/login?app=wsr');
    expect(access.signInUrl('/here')).toBe('/login?app=wsr&return=%2Fhere');
  });

  it('names no URL when the deployment has no login the editor can point at', () => {
    const access = setup('');
    expect(access.signInUrl('/here')).toBeNull();

    access.noteUnauthorised();
    expect(access.signInRequired()).withContext('the operator is told instead of redirected').toBe(true);
    expect(access.readOnly()).toBe(false);
  });

  it('does not silently restore write access after a sign-in', () => {
    const access = setup('/login');
    access.noteForbidden();
    expect(access.readOnly()).toBe(true);

    // With a login URL a 401 navigates (asserted through `signInUrl` above, since a spec must not
    // move the test browser); nothing but a successful write lifts the read-only state.
    expect(access.signInUrl('/here')).not.toBeNull();
    expect(access.readOnly()).toBe(true);
  });
});
