import {Injectable, inject, signal} from '@angular/core';
import {EDITOR_LOGIN_URL} from '../editor.config';

/**
 * The deployment's access state (ui-spec §1, rest-api.md's preamble). The editor ships no login UI —
 * authentication belongs to the deployment — so a `401` sends the browser to the deployment's login
 * and a `403` leaves the editor usable but read-only. Both arrive as answers to the editor's own
 * requests, so `access.interceptor.ts` feeds this service and the shell says the one line.
 */
@Injectable({providedIn: 'root'})
export class AccessService {
  /** True once the server has answered `403`: the operator may read this deployment, not change it. */
  readonly readOnly = signal(false);
  /** True when a `401` could not be answered by a redirect, because no login URL is configured. */
  readonly signInRequired = signal(false);

  /** The deployment's login, from the environment; empty means it has none the editor can name. */
  loginUrl = inject(EDITOR_LOGIN_URL);

  /** The one explanatory line ui-spec §1 asks for; nothing is hidden, every write control disables. */
  readonly readOnlyMessage = 'This deployment lets you read but not change scripts; every write control is disabled.';

  /** The sentence for a `401` the deployment gave no login URL for. */
  readonly signInMessage = 'The deployment asked for a sign-in and names no login page; sign in there and reload.';

  /**
   * `401`: go to the deployment's login and come back. Without a configured URL the honest answer is
   * the line above — redirecting to nowhere would loop.
   */
  noteUnauthorised(): void {
    const target = this.signInUrl(window.location.href);
    if (target === null) {
      this.signInRequired.set(true);
      return;
    }
    window.location.assign(target);
  }

  /**
   * Where a `401` sends the browser, or `null` when the deployment names no login. Split out so a
   * spec can assert the URL without navigating the test browser.
   */
  signInUrl(returnUrl: string): string | null {
    if (this.loginUrl === '') {
      return null;
    }
    const separator = this.loginUrl.includes('?') ? '&' : '?';
    return `${this.loginUrl}${separator}return=${encodeURIComponent(returnUrl)}`;
  }

  /** `403`: read-only from here on. */
  noteForbidden(): void {
    this.readOnly.set(true);
  }
}
