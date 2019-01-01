import {AfterViewInit, ChangeDetectorRef, Component, Inject} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {SessionService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";
import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html'

})
export class SessionsComponent implements  AfterViewInit {

  sessions:Array<Session>
  constructor(private route: ActivatedRoute, private chDetRef:ChangeDetectorRef,private sessionService: SessionService) {
  }



  ngAfterViewInit() {
    this.route.params.subscribe((params: Params) => {
      let projectName = params['projectName'];
      if (projectName) {
        this.sessionService.projectSessionsObserver(projectName).subscribe(sesss=>{
          console.info("List " + sesss.length + " sessions")
          this.sessions=sesss;
          console.log(this.sessions)
          this.chDetRef.detectChanges()
        })
      }
    })
  }

  addNewSession(){
    // TODO test only
    let ns:Session={sessionId: UUID.generate(), project: 'Demo1', script: '1245'}
    this.sessionService.projectAddSessionObserver(ns.project,ns).subscribe((s)=>{
      this.sessions.push(s);
    },(err)=>{
      // TODO !!
    })
  }

}
