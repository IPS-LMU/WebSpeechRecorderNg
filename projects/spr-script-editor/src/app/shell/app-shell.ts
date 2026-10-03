import {Component, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';

const PROJECT_IN_URL = /\/project\/([^/]+)/;
const SCRIPT_IN_URL = /\/project\/[^/]+\/script\/([^/]+)/;

/**
 * Shell around every editor screen (ui-spec §1): project breadcrumb, the save state, the warning
 * count, Preview, Publish and undo/redo.
 *
 * M2 is read-only: the write controls exist so the surface is complete, but they are `disabled`
 * with an explanation (ui-spec §1 — never a silent failure). Nothing here saves, and the save
 * state is the fixed "all changes saved" form.
 */
@Component({
  selector: 'spre-app-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);

  readonly url = signal(this.router.url);
  readonly project = computed(() => PROJECT_IN_URL.exec(this.url())?.[1] ?? null);
  readonly scriptId = computed(() => SCRIPT_IN_URL.exec(this.url())?.[1] ?? null);
  readonly readOnlyReason = 'This milestone is read-only: saving, publishing and editing are disabled.';

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }
}
