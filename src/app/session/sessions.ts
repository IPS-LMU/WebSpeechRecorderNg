import {AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, Renderer2} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {SessionService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";
import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";
import {ProjectService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {Script} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";
import * as JSZip from "jszip";
import {Renderer3} from "@angular/core/src/render3/interfaces/renderer";
import {DOCUMENT} from "@angular/common";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  styleUrls: ['../../speechrecorder_mat.scss']
})
export class SessionsComponent implements  OnInit {

  projectName:string;
  sessions:Array<Session>
    displayedColumns: string[] = ['sessionId','action'];
  //zip.workerScriptsPath

    private d:Document;
  constructor(private route: ActivatedRoute,
              private chDetRef:ChangeDetectorRef,
              private renderer:Renderer2,
              @Inject(DOCUMENT) private dAsAny: any,
              private scriptService:ScriptService,
              private sessionService: SessionService) {
      this.d=dAsAny as Document;
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
    let jsz=new JSZip();
      jsz.file('Testfile1', 'TestContent1!\n')
      jsz.generateAsync({type: "blob"})
          .then((content) => {

              let rfUrl = URL.createObjectURL(content);

              let dataDnlLnk = this.renderer.createElement('a')

              this.renderer.setAttribute(dataDnlLnk, 'name', 'session')
              this.renderer.setAttribute(dataDnlLnk, 'href', rfUrl)
              this.renderer.setAttribute(dataDnlLnk, 'download', 'session_'+sessionId+'.zip')

              this.renderer.appendChild(this.d.body, dataDnlLnk)

              dataDnlLnk.click();

              this.renderer.removeChild(this.d.body, dataDnlLnk);
          });
  }

}
