import {Component, Inject, ChangeDetectionStrategy} from '@angular/core';


@Component({
    selector: 'app-start',
    templateUrl: 'start.html',
    styleUrls: ['start.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StartComponent {

  constructor(){
  }
}
