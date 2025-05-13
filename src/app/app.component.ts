import {Component} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import {ResponsiveComponent} from "../../projects/speechrecorderng/src/lib/ui/responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";
import {MatToolbar} from "@angular/material/toolbar";
import {MatMenu, MatMenuTrigger} from "@angular/material/menu";
import {MatIcon} from "@angular/material/icon";
import {RouterOutlet} from "@angular/router";
import {NgIf} from "@angular/common";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false
})
export class AppComponent extends ResponsiveComponent{

  sprVersion=VERSION;
  title='SpeechRecorder Angular Demo'
  shortTitle='SpeechRecorder'

  constructor(protected bpo:BreakpointObserver) {
    super(bpo);
  }
}
