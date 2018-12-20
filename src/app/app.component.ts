import {Component, Inject} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sprVersion=VERSION;
  title='SpeechRecorder Angular PWA Demo'
  shortTitle='SpeechRecorder'
  constructor(){
  }
}
