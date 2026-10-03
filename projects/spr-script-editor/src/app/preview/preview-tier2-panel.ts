import {HttpErrorResponse} from '@angular/common/http';
import {Component, computed, inject, input, signal} from '@angular/core';
import {SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {EDITOR_RECORDER_BASE_URL} from '../editor.config';
import {describePreviewFailure, recorderSessionUrl, tier2Availability} from './preview-tier2';
import {PreviewTier2Service, type PreviewSession} from './preview-tier2.service';
import {PREVIEW_TIER2_STRINGS} from './preview-tier2-strings';

/**
 * The tier-2 dry run, as one slot in the preview header (ui-spec §4, rest-api §6).
 *
 * It creates a `type: "TEST"` session over this script's draft and shows the session id, when it
 * expires and the link into the real recorder. The guarantee the screen has to state — nothing is
 * uploaded — is the point of the whole feature (plan D-P): a preview session cannot store a
 * recording, and the session is excluded from reports and the draw record.
 *
 * The button stays disabled with a reason when the deployment cannot reach the receiver (fixture
 * mode, or no recorder base URL); the failure mapping covers the receiver's 4xx cases.
 */
@Component({
  selector: 'spre-preview-tier2-panel',
  standalone: true,
  imports: [],
  template: `
    <div class="tier2">
      <button type="button" class="tier2-start" (click)="start()"
              [disabled]="!availability().enabled || busy()" [title]="title()">
        {{ busy() ? strings.buttonBusy : strings.button }}
      </button>

      @if (!availability().enabled) {
        <p class="tier2-reason" role="note">{{ disabledReason() }}</p>
      }

      @if (error() !== null) {
        <p class="tier2-error" role="alert">{{ error() }}</p>
      }

      @if (session(); as created) {
        <div class="tier2-result" role="status" aria-live="polite">
          <p class="tier2-guarantee" role="note">
            <strong>{{ strings.guaranteeTitle }}.</strong> {{ strings.guarantee }}
          </p>
          <dl class="tier2-facts">
            <dt>{{ strings.sessionLabel }}</dt>
            <dd><code>{{ created.sessionId }}</code></dd>
            <dt>{{ strings.expiresLabel }}</dt>
            <dd>{{ created.expires }}</dd>
          </dl>
          <p class="tier2-actions">
            <a class="tier2-open" [href]="url(created.sessionId)" target="_blank" rel="noopener"
               [title]="strings.openLinkTitle"
               [attr.aria-label]="strings.openLink + ' (opens in a new tab)'">{{ strings.openLink }}</a>
            <button type="button" class="tier2-again" (click)="reset()">{{ strings.startAnother }}</button>
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    .tier2 {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--spr-r-sm, 6px);
      max-width: 380px;
    }

    .tier2-start,
    .tier2-again {
      min-height: 44px;
      padding: 0 var(--spr-r-md, 12px);
      border: 1px solid var(--spr-primary, #3B5BDB);
      border-radius: var(--spr-r-md, 12px);
      background: var(--spr-primary, #3B5BDB);
      color: var(--spr-primary-ink, #FFFFFF);
      font: inherit;
      font-size: var(--spr-type-label, 14.4px);
      cursor: pointer;
    }

    .tier2-again {
      background: var(--spr-surface, #FFFFFF);
      color: var(--spr-ink, #1B1B1F);
      border-color: var(--spr-border, #D6D3CC);
    }

    .tier2-start:disabled {
      cursor: not-allowed;
      background: var(--spr-chrome, #E7E4DE);
      border-color: var(--spr-border, #D6D3CC);
      color: var(--spr-ink-muted, #5C5C66);
    }

    .tier2-reason,
    .tier2-guarantee,
    .tier2-error {
      margin: 0;
      font-size: var(--spr-type-caption, 13.6px);
    }

    .tier2-reason {
      color: var(--spr-ink-muted, #5C5C66);
    }

    .tier2-error {
      color: var(--spr-alert-ink, #8A1C1C);
    }

    .tier2-result {
      display: flex;
      flex-direction: column;
      gap: var(--spr-r-sm, 6px);
      padding: var(--spr-r-md, 12px);
      border: 1px solid var(--spr-border, #D6D3CC);
      border-radius: var(--spr-r-md, 12px);
      background: var(--spr-surface-3, #F0EEE9);
    }

    .tier2-facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px var(--spr-r-sm, 6px);
      margin: 0;
      font-size: var(--spr-type-caption, 13.6px);
    }

    .tier2-facts dt {
      color: var(--spr-ink-muted, #5C5C66);
    }

    .tier2-facts dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .tier2-actions {
      display: flex;
      align-items: center;
      gap: var(--spr-r-sm, 6px);
      margin: 0;
    }

    .tier2-open {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 var(--spr-r-md, 12px);
      border-radius: var(--spr-r-md, 12px);
      background: var(--spr-primary, #3B5BDB);
      color: var(--spr-primary-ink, #FFFFFF);
      font-size: var(--spr-type-label, 14.4px);
      text-decoration: none;
    }
  `],
})
export class PreviewTier2Panel {
  private readonly service = inject(PreviewTier2Service);
  private readonly config = inject(SPEECHRECORDER_CONFIG, {optional: true});

  readonly strings = PREVIEW_TIER2_STRINGS;

  readonly projectId = input.required<string>();
  readonly scriptId = input.required<string>();
  /** Where the recorder is served; `''` means the editor's own origin. */
  readonly recorderBaseUrl = input<string | undefined>(EDITOR_RECORDER_BASE_URL);

  readonly availability = computed(() => tier2Availability(this.config?.apiType, this.recorderBaseUrl()));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly session = signal<PreviewSession | null>(null);

  readonly disabledReason = computed(() =>
    this.availability().reason === 'noRecorder' ? this.strings.disabledNoRecorder : this.strings.disabledFixtures,
  );
  readonly title = computed(() =>
    this.availability().enabled ? this.strings.buttonTitle : this.disabledReason(),
  );

  url(sessionId: string): string {
    return recorderSessionUrl(this.recorderBaseUrl() ?? '', sessionId);
  }

  start(): void {
    if (!this.availability().enabled || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.session.set(null);
    this.service.start(this.projectId(), this.scriptId()).subscribe({
      next: (created) => {
        this.busy.set(false);
        this.session.set(created);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        const status = failure instanceof HttpErrorResponse ? failure.status : 0;
        const body = failure instanceof HttpErrorResponse ? failure.error : null;
        this.error.set(describePreviewFailure(status, body));
      },
    });
  }

  reset(): void {
    this.session.set(null);
    this.error.set(null);
  }
}
