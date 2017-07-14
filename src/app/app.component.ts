import {Component, Inject} from '@angular/core';
import { VERSION } from '../module/speechrecorder/spr.module'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sprVersion=VERSION;
  title = 'app';
}
