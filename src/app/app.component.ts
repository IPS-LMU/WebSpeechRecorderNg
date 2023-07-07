import {Component, ViewChild, ViewContainerRef} from '@angular/core';
import {BreakpointObserver} from "@angular/cdk/layout";
import {Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
import {VERSION,ResponsiveComponent,SettingsComponent,ProjectService} from "speechrecorderng";



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
