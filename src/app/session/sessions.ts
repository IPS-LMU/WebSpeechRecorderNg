import {AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {SessionService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";
import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";
import {ProjectService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {Script} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";
import * as JSZip from "jszip";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  styleUrls: ['../../speechrecorder_mat.scss']
})
export class SessionsComponent implements  OnInit {

  projectName:string;
  sessions:Array<Session>
    displayedColumns: string[] = ['sessionId','action'];
  constructor(private route: ActivatedRoute, private chDetRef:ChangeDetectorRef,private scriptService:ScriptService,private sessionService: SessionService) {
  }

  ngOnInit() {
    this.route.params.subscribe((params: Params) => {
      this.projectName = params['projectName'];
      this.fetchSessions()
    })

  }

  fetchSessions(){
    if (this.projectName) {
      this.sessionService.projectSessionsObserver(this.projectName).subscribe(sesss=>{
        console.info("List " + sesss.length + " sessions")
        this.sessions=sesss;
        console.log(this.sessions)
        //this.chDetRef.detectChanges()
      })
    }
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
                console.log("Scripts: NEXT (push) "+s.sessionId)
                //mat-table does not update here !!
                this.sessions.push(s);
              }, (err) => {
                // TODO err
                console.log("Scripts: ERROR")
              },
              () => {
                console.log("Scripts: COMPLETE")
                // refresh table
                this.fetchSessions()
              })
        }else{
          // TODO err
        }
      })

  }

  downloadSessionArchive(sessionId: string|number){
    console.log("Start download session: "+sessionId)
    let jsz=new JSZip();
    jsz.file('Testfile1','TestContent1!\n')
    jsz.generateAsync({type:"blob"})
        .then(function(content) {
          // see FileSaver.js

          let rfUrl = URL.createObjectURL(content);

          // TODO Angular compatible ??
          let dataDnlLnk = document.createElement("a");

          dataDnlLnk.name = 'session';
          dataDnlLnk.href = rfUrl;

          document.body.appendChild(dataDnlLnk);

            dataDnlLnk.setAttribute('download', 'test1_session.zip');
            dataDnlLnk.click();

          document.body.removeChild(dataDnlLnk);
        });
  }

}
