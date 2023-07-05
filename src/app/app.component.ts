import {Component, ViewChild} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import {ResponsiveComponent} from "../../projects/speechrecorderng/src/lib/ui/responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";
import {MatSidenav} from "@angular/material/sidenav";
import {Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
//import {SettingsComponent} from "../../projects/speechrecorderng/src/lib/audio/ui/settings/settings.component";
import {SettingsComponent} from "speechrecorderng";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent extends ResponsiveComponent{

  sprVersion=VERSION;
  title='SpeechRecorder Angular Demo'
  shortTitle='SpeechRecorder'

  constructor(protected bpo:BreakpointObserver,public router:Router,public dialog: MatDialog) {
    super(bpo);
  }

  openSettingsDialog(){
    this.dialog.open(SettingsComponent);
  }
}
