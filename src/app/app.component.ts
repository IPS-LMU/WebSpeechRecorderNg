import {Component, Inject} from '@angular/core';
import { VERSION } from '../module/speechrecorder/spr.module'
import {APP_CONFIG, AppConfig} from "./app.config";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sprVersion=VERSION;
  title='bla'
  constructor(@Inject(APP_CONFIG) appCfg:AppConfig){
    this.title=appCfg.title
  }
}
