import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * One placeholder for every screen the later slices own (plan M2 rows E1/editor, E4, draws,
 * preview). The routes point at it through `loadComponent` so those screens load lazily; the
 * slices replace each route's target with the real component under `app/editor/`, `app/source/`,
 * `app/bank/`, `app/draws/` or `app/preview/`.
 */
@Component({
  selector: 'spre-not-yet-built',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-built" aria-labelledby="not-built-title">
      <h1 id="not-built-title">This screen is not built yet</h1>
      <p>The read-only foundation (M2) ships the shell, the routes and the library list. This
        screen arrives with a later milestone.</p>
      <a class="back" routerLink="/">Back to the script library</a>
    </section>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      padding: var(--spr-r-xl, 22px);
    }

    .not-built {
      max-width: 40rem;
      padding: var(--spr-r-lg, 14px);
      background: var(--spr-surface, #FFFFFF);
      border: 1px solid var(--spr-border, #D8DFE8);
      border-radius: var(--spr-r-md, 12px);
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: var(--spr-type-title, 20px);
      color: var(--spr-ink-strong, #1C3660);
    }

    p {
      margin: 0 0 1rem;
      font-size: var(--spr-type-body, 16px);
      color: var(--spr-ink, #1F3044);
    }

    .back {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: var(--spr-type-body, 16px);
      color: var(--spr-primary, #2A4765);
    }
  `],
})
export class NotYetBuilt {}
