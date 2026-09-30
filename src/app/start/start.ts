import {Component, Inject} from '@angular/core';
import {environment} from '../../environments/environment';


@Component({
    selector: 'app-start',
    templateUrl: 'start.html',
    styleUrls: ['start.css'],
    standalone: false
})
export class StartComponent {

  /**
   * Where "Open the recorder" leads. A deployment that is served with a recording procedure
   * configures `defaultSessionId` and the action goes straight to that session; without one the
   * action opens the configuration picker so a stored configuration can be tried out.
   */
  get openRecorderLink(): string {
    return environment.defaultSessionId != null
      ? `/spr/session/${environment.defaultSessionId}`
      : '/session';
  }

  constructor(){}
}
