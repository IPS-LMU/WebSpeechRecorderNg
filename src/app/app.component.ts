import {Component} from '@angular/core';
import {BreakpointObserver} from "@angular/cdk/layout";
import {Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
import {VERSION,ResponsiveComponent,SettingsComponent,ProjectService} from "speechrecorderng";
import {InfoComponent} from "../../projects/speechrecorderng/src/lib/ui/info/info.component";



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

  openInfoDialog(){
    this.dialog.open(InfoComponent,{width:'80%',height:'80%'});
  }

  openSettingsDialog(){
    this.dialog.open(SettingsComponent,{width:'80%',height:'80%'});
  }
}
