import {Component, ViewChild} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import {ResponsiveComponent} from "../../projects/speechrecorderng/src/lib/ui/responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";
import {MatSidenav} from "@angular/material/sidenav";
import {Router} from "@angular/router";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent extends ResponsiveComponent{

  sprVersion=VERSION;
  title='SpeechRecorder Angular Demo'
  shortTitle='SpeechRecorder'
  @ViewChild(MatSidenav) sideNav!:MatSidenav;
  constructor(protected bpo:BreakpointObserver,public router:Router) {
    super(bpo);
  }

  // onActivate(component){
  //   //console.debug("AppComp: onActivate ")
  //   if(component instanceof RecorderComponent){
  //     this.speechRecorderComp=component;
  //     this.updateUI();
  //   }
  //   let refreshAcc=(!(
  //       ('isPublic' in component && component.isPublic()))
  //   )
  //   //let redirect=(! ());
  //   //console.debug("AppComp: onActivate Refesh user state: "+refreshAcc+", "+redirect);
  //   //this.userStateService.userState(refreshAcc,redirect).subscribe();
  //   this.fitToPageMode=(component instanceof FitToPageComponent);
  // }
  // onDeactivate(component){
  //   if(component instanceof  RecorderComponent){
  //     this.speechRecorderComp=null;
  //     this.updateUI();
  //   }
  // }
  //
  // updateUI(){
  //   if(this.breakpointState) {
  //     if (this.breakpointState.matches) {
  //       this.sideNav.mode = 'over';
  //       if (this.sideNav.opened) {
  //         this.sideNav.close();
  //       }
  //     } else {
  //       this.sideNav.mode = 'side';
  //       if (this.speechRecorderComp) {
  //         if (this.sideNav.opened) {
  //           this.sideNav.close();
  //         }
  //       } else {
  //         if (!this.sideNav.opened) {
  //           this.sideNav.open();
  //         }
  //       }
  //     }
  //   }
  // }

}
