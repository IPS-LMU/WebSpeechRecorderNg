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
import {RecordingService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/recordings/recordings.service";
import {AudioContextProvider} from "../../../projects/speechrecorderng/src/lib/audio/context";
import {RecordingFile} from "../../../projects/speechrecorderng/src/lib/speechrecorder/recording";
import {WavWriter} from "../../../projects/speechrecorderng/src/lib/audio/impl/wavwriter";
import {forEach} from "@angular/router/src/utils/collection";



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
              private recService:RecordingService,
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


  generateZip(jsz:JSZip,name:string,zipFilename:string ){
      jsz.generateAsync({type: "blob"})
          .then((content) => {

              let rfUrl = URL.createObjectURL(content);

              let dataDnlLnk = this.renderer.createElement('a')

              this.renderer.setAttribute(dataDnlLnk, 'name', 'session')
              this.renderer.setAttribute(dataDnlLnk, 'href', rfUrl)
              this.renderer.setAttribute(dataDnlLnk, 'download', zipFilename)

              this.renderer.appendChild(this.d.body, dataDnlLnk)

              dataDnlLnk.click();

              this.renderer.removeChild(this.d.body, dataDnlLnk);
          });
  }

  downloadSessionArchive(sessionId: string){
    let jsz=new JSZip();
      let audioContext = AudioContextProvider.audioContextInstance()
      // TODO code works but is very ugly
      this.sessionService.sessionObserver(sessionId).subscribe((sess)=>{
          let name='session'
          let zipFilename='session_'+sessionId+'.zip'
          let sessJsonStr=JSON.stringify(sess)
          jsz.file('session.json',sessJsonStr)

          this.recService.recordingFileDescrList(this.projectName,sessionId).subscribe((rfsDescr)=> {
              let rfsSize=rfsDescr.length
              if(rfsSize>0) {
                  for (let rfi = 0; rfi < rfsSize; rfi++) {
                      let rfDescr = rfsDescr[rfi]
                      let ic = rfDescr.recording.itemcode
                      let ve = rfDescr.version
                      let rf = new RecordingFile(sessionId, ic, ve, null);
                      // TODO should be possible to do it more elegant
                      // e.g. Observable of recfile service which calls next for each rec file (making use of the Observable capabilities)
                      // generate the ZIP on complete()

                      // TODO ...and it does NOT work
                      // when the last file is prepared before others they will not make it in the ZIP archive !!

                      let last = (rfi == rfsDescr.length - 1);
                      this.recService.getCachedOrFetchAndApplyRecordingFile(audioContext, this.projectName, rf).subscribe((rfa) => {
                          // TODO duplicate code: sessionmanager.ts

                          let ab: AudioBuffer = rfa.audioBuffer;
                          let ww = new WavWriter();
                          let wavFile = ww.writeAsync(ab, (wavFile) => {
                              let blob = new Blob([wavFile], {type: 'audio/wav'});
                              //  TODO version should not appear in overwrite mode
                              let rfNm = sessionId + ic + '_' + ve + '.wav';
                              jsz.file(rfNm, blob)
                              if (last) {
                                  this.generateZip(jsz, name, zipFilename)
                              }
                          })
                      })
                  }
              }else{
                  // empty session will be packed as well
                  this.generateZip(jsz, name, zipFilename)
              }

          })





      })

  }

}
