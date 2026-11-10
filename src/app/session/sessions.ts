import {Component, Inject, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'app-sessions',
    templateUrl: 'sessions.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SessionsComponent {

  constructor(){
  }
}
