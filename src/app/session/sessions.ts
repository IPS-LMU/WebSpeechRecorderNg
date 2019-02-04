import {AfterViewInit, ChangeDetectorRef, Component, Inject} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {SessionService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";
import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";
import {ProjectService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {Script} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  styles:[]
})
export class SessionsComponent implements  AfterViewInit {

  projectName:string;
  sessions:Array<Session>
  constructor(private route: ActivatedRoute, private chDetRef:ChangeDetectorRef,private scriptService:ScriptService,private sessionService: SessionService) {
  }



  ngAfterViewInit() {
    this.route.params.subscribe((params: Params) => {
      this.projectName = params['projectName'];
      if (this.projectName) {
        this.sessionService.projectSessionsObserver(this.projectName).subscribe(sesss=>{
          console.info("List " + sesss.length + " sessions")
          this.sessions=sesss;
          console.log(this.sessions)
          this.chDetRef.detectChanges()
        })
      }
    })
  }

  addNewSession(){
    let sessionScript:Script=null;
    this.scriptService.rnadomProjectScriptObserver(this.projectName).subscribe((script)=> {
      sessionScript=script;
    },(err)=> {
      // TODO err
      console.log("Scripts: ERROR")
    },()=>{
        if(sessionScript) {
          let ns: Session = {sessionId: UUID.generate(), project: this.projectName, script: sessionScript.scriptId}
          this.sessionService.projectAddSessionObserver(ns.project, ns).subscribe((s) => {
                this.sessions.push(s);
              }, (err) => {
                // TODO err
                console.log("Scripts: ERROR")
              },
              () => {
                console.log("Scripts: COMPLETE")
              })
        }else{
          // TODO err
        }
      })

  }

}
