import {AfterViewInit, Component, Inject} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {SessionService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html'

})
export class SessionsComponent implements  AfterViewInit {

  sessions:Array<Session>
  constructor(private route: ActivatedRoute, private sessionService: SessionService) {
  }

  ngAfterViewInit() {
    this.route.params.subscribe((params: Params) => {
      let projectName = params['projectName'];
      if (projectName) {
        this.sessionService.projectSessionsObserver(projectName).subscribe(sesss=>{
          this.sessions=sesss;
        })
      }
    })
  }

}
