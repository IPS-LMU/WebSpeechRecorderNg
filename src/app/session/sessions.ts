import {AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, Renderer2, ViewChild} from '@angular/core';
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
import {Observable} from "rxjs";
import { zip as ObsZip,of } from 'rxjs';
import { map } from 'rxjs/operators';

import {last} from "rxjs/operators";
import {MatSort, MatTableDataSource} from "@angular/material";



@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  styleUrls: ['../../speechrecorder_mat.scss']
})
export class SessionsComponent implements  OnInit {

  projectName:string;
  sessions:Array<Session>
    displayedColumns: string[] = ['date','sessionId','action'];
    dataSource:MatTableDataSource<Session>;
    @ViewChild(MatSort, { static: true }) sort: MatSort;
    private d:Document;
    private newSessionDisabled=true;
  constructor(private route: ActivatedRoute,
              private chDetRef:ChangeDetectorRef,
              private renderer:Renderer2,
              @Inject(DOCUMENT) private dAsAny: any,
              private scriptService:ScriptService,
              private recService:RecordingService,
              private sessionService: SessionService) {
      this.d=dAsAny as Document;
      this.sessions=new Array<Session>()
      this.dataSource=new MatTableDataSource(this.sessions)
  }


  ngOnInit() {
      this.dataSource.sort=this.sort

    this.route.params.subscribe((params: Params) => {
      this.projectName = params['projectName'];
      this.fetchSessions()
        this.updateNewSessionDisabled()
    })
  }

  updateNewSessionDisabled(){
      let sessionScript:Script=null;
      this.scriptService.randomProjectScriptObserver(this.projectName).subscribe((script)=> {
          sessionScript=script;
      },(err)=> {
          this.newSessionDisabled=true
          console.error("Scripts: ERROR")
      },()=>{
          if(sessionScript) {
              this.newSessionDisabled=false
          }else{
              this.newSessionDisabled=true
          }
      })

  }

  fetchSessions(){
    if (this.projectName) {
      this.sessionService.projectSessionsObserver(this.projectName).subscribe(sesss=>{
        console.info("List " + sesss.length + " sessions")
        this.sessions=sesss;
        this.dataSource.data=this.sessions
        //console.log(this.sessions)
        //this.chDetRef.detectChanges()
      })
    }
  }

  addNewSession(){
    let sessionScript:Script=null;
    this.scriptService.randomProjectScriptObserver(this.projectName).subscribe((script)=> {
      sessionScript=script;
    },(err)=> {
      // TODO err
      console.error("Scripts: ERROR")
    },()=>{
        if(sessionScript) {
          let ns: Session = {sessionId: UUID.generate(), status: "CREATED", type: 'NORM', project: this.projectName, script: sessionScript.scriptId,date:new Date()}
          this.sessionService.projectAddSessionObserver(ns.project, ns).subscribe((s) => {
                //console.log("Scripts: NEXT (push) "+s.sessionId)
                //mat-table does not update here !!
                this.sessions.push(s);
              }, (err) => {
                // TODO err
                console.error("Scripts: ERROR")
              },
              () => {
                //console.debug("Scripts: COMPLETE")
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



  addAudioFileToZipObservable(audioContext:AudioContext,rf:RecordingFile,rfNm:string,jsz:JSZip):Observable<RecordingFile>{

    return new Observable<RecordingFile>(subscriber => {

        this.recService.getCachedOrFetchAndApplyRecordingFile(audioContext, this.projectName, rf).subscribe((rfa) => {
          // TODO duplicate code: sessionmanager.ts

          let ab: AudioBuffer = rfa.audioBuffer;
          let ww = new WavWriter();
          let wavFile = ww.writeAsync(ab, (wavFile) => {
            let blob = new Blob([wavFile], {type: 'audio/wav'});
            //  TODO version should not appear in overwrite mode

            jsz.file(rfNm, blob)
            subscriber.next(rfa)
            subscriber.complete()
          })

        })
      }
    );
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
                  let rfObss=new Array<Observable<RecordingFile>>();
                  for (let rfi = 0; rfi < rfsSize; rfi++) {
                      let rfDescr = rfsDescr[rfi]
                      let ic = rfDescr.recording.itemcode
                      let ve = rfDescr.version
                      let rf = new RecordingFile(sessionId, ic, ve, null);

                     let rfNm = sessionId + ic + '_' + ve + '.wav';
                     // Add an observable for each audio file

                     rfObss.push(this.addAudioFileToZipObservable(audioContext,rf,rfNm,jsz));
                  }

                  // Confusing here: zip function has nothing to do with zip archive
                // This rxjs function goes subsequently through each observable and waits for it to complete

                  ObsZip(...rfObss).subscribe((n)=>{
                    //console.log("Built all zip audio entries")
                  },(err)=>{
                    console.error("error waiting for audiofiles "+err)
                  },()=>{
                    this.generateZip(jsz, name, zipFilename)
                  })



              }else{
                  // empty session will be packed as well
                  this.generateZip(jsz, name, zipFilename)
              }

          })





      })

  }

}
