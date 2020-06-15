import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit, Input, ElementRef, OnInit,
} from '@angular/core'


import {ActivatedRoute, Params, Route, Router} from "@angular/router";


import {RecordingFileService} from "./recordingfile-service";
import {MatDialog} from "@angular/material/dialog";
import {AudioDisplayPlayer} from "../../../audio/audio_player";

import {AudioDisplayScrollPane} from "../../../audio/ui/audio_display_scroll_pane";
import {AudioContextProvider} from "../../../audio/context";
import {AudioClip} from "../../../audio/persistor";
import {Selection} from "../../../audio/persistor";

import {Action, ActionEvent} from "../../../action/action";
import {SessionService} from "../session.service";
import {RecordingService} from "../../recordings/recordings.service";
import {RecordingFile} from "../../recording";


export class ItemcodeIndex{
  [itemcode: string]: Array<RecordingFile>;
}

@Component({

  selector: 'app-audiodisplayplayer',

  template: `
    
    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
    <div class="ctrlview">
      <app-recording-file-meta [sessionId]="sessionId" [recordingFile]="recordingFile"></app-recording-file-meta>
      
    <audio-display-control [audioClip]="audioClip"
                             [playStartAction]="playStartAction"
                             [playSelectionAction]="playSelectionAction"
                             [playStopAction]="playStopAction"
                             [autoPlayOnSelectToggleAction]="ap?.autoPlayOnSelectToggleAction"
                             [zoomInAction]="zoomInAction"
                             [zoomOutAction]="zoomOutAction"
                             [zoomSelectedAction]="zoomSelectedAction"
                           [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control>
      <app-recording-file-navi [version]="recordingFile?.version" [versions]="versions" [prevAction]="prevAction" [nextAction]="nextAction" [selectVersion]="toVersionAction" [naviInfoLoading]="naviInfoLoading"></app-recording-file-navi>
      </div>
  `,
  styles: [
    `:host {
          flex: 2;
          display: flex;
          flex-direction: column;
          min-height:0;
          overflow: hidden;
      padding: 20px;
      z-index: 5;
      box-sizing: border-box;
      background-color: white;
    }`,`        
        .ctrlview{
          display: flex;
          flex-direction: row;
          
        }
    `,`
      audio-display-control{
        
        flex: 3;
      }
    `]

})
export class RecordingFileViewComponent extends AudioDisplayPlayer implements OnInit,AfterViewInit {

  //protected _recordingFileId: string | number = null;

  sessionId: string | number = null;
  sessionIdFromRoute:string=null;

  availRecFiles: Array<Array<RecordingFile>>;
  versions: Array<number>=null;

  recordingFile: RecordingFile;
  private routedByQueryParam=false;
  posInList: number=null;


  @ViewChild(AudioDisplayScrollPane)
  private ac: AudioDisplayScrollPane;

  prevAction: Action<void>;
  nextAction: Action<void>;
  toVersionAction: Action<number>;

  naviInfoLoading=false;

  constructor(protected recordingFileService: RecordingFileService, protected recordingService: RecordingService, protected sessionService: SessionService, protected router:Router,protected route: ActivatedRoute, protected ref: ChangeDetectorRef, protected eRef: ElementRef, protected dialog: MatDialog) {
    super(route, ref, eRef)
    this.parentE = this.eRef.nativeElement;
    this.prevAction = new Action<void>('Previous');
    this.prevAction.onAction= ()=>this.prevFile();
    this.nextAction = new Action<void>('Next');
    this.nextAction.onAction= ()=>this.nextFile();
    this.toVersionAction=new Action<number>('To version');
    this.toVersionAction.onAction= (ae)=>this.toVersion(ae);
  }

  ngOnInit() {
    super.ngOnInit();

  }

  ngAfterViewInit() {
    super.ngAfterViewInit()
    this.route.queryParams.subscribe((params: Params) => {
      let rfIdP = params['recordingFileId'];
      let sIdP = params['sessionId'];
      if (sIdP) {
       this.sessionIdFromRoute=sIdP;
      }
      if (rfIdP) {
        this.routedByQueryParam=true;
        this.loadRecFile(rfIdP);
      }
    });
    this.route.params.subscribe((params: Params) => {
      let rfIdP = params['recordingFileId'];
      let sIdP = params['sessionId'];
      if (sIdP) {
        this.sessionIdFromRoute=sIdP;
      }
      if (rfIdP) {
        this.routedByQueryParam=false;
        this.loadRecFile(rfIdP);
      }
    });
    // if(this.sessionId){
    //     this.loadSession(this.sessionId);
    // }
  }


  private navigateToId(rfId:number| string){

    if(this.routedByQueryParam){
      this.router.navigate([], {relativeTo: this.route, queryParams:{'recordingFileId':rfId}})
    }else {
      this.router.navigate(['../' + rfId], {relativeTo: this.route});
    }
  }

  private navigateToRecordingFile(){
    let latestNextRf = this.availRecFiles[this.posInList][0];
    let lnRfId=latestNextRf.recordingFileId;
    this.navigateToId(lnRfId);
  }

  toVersion(ae:ActionEvent<number>){
    console.debug("Change event: "+ae);
    let toRfId=null;

      let version=ae.value;
      console.debug("Action event: version: "+version);
      let cRfs=this.availRecFiles[this.posInList];
      let availVersionCnt=cRfs.length;
      for(let cRf of cRfs){
        console.debug("Match?: "+cRf.version+ " "+version);
          if(cRf.version===version){
              toRfId=cRf.recordingFileId;
              break;
          }
      }

    if(toRfId!=null){
      console.debug("Version change navi to RF ID: "+toRfId);
      this.navigateToId(toRfId);
    }
  }

  prevFile() {
    this.posInList--;
    this.navigateToRecordingFile()
  }
  nextFile() {
    this.posInList++;
    this.navigateToRecordingFile()
  }

  private positionInList():number | null{
    if (this.availRecFiles && this.recordingFile) {
      let cic = this.recordingFile.recording.itemcode;
      let itemCnt = this.availRecFiles.length
      for (let rfdi = 0; rfdi < itemCnt; rfdi++) {
        let ar = this.availRecFiles[rfdi][0].recording;
        if (cic === ar.itemcode) {
          return rfdi;
        }
      }
    }
    return null;
  }

  private updatePos(){
    this.posInList=this.positionInList();
    console.debug("updatePos: posInList: "+this.posInList+" availRecs: "+this.availRecFiles)
    this.toVersionAction.disabled=true;
    if(this.availRecFiles){
      let avRfsLen=this.availRecFiles.length;
      console.debug("updatePos: availRecs len: "+avRfsLen)
      if(this.posInList !=null && avRfsLen>this.posInList) {
        let arfs = this.availRecFiles[this.posInList];
        console.debug("updatePos: arfs: " + arfs);
        if (arfs) {
          // this.versions = arfs.map<number>((rf) => {
          //   return rf.version ? rf.version : 0;
          // })
          this.versions = new Array<number>();
          for (let arf of arfs) {

            this.versions.push(arf.version)
          }
          this.toVersionAction.disabled=(this.versions.length<2);
          console.debug("Versions set: " + this.versions.length)
        }
      }
    }
  }

  prevFileAvail():boolean {
   this.updatePos();
    if(this.posInList!=null) {
      if (this.posInList > 0) {
        return true;
      }
    }
    return false;
  }

  nextFileAvail():boolean {
     this.updatePos();
      if(this.posInList!=null) {
        let itemCnt = this.availRecFiles.length;
        if (this.posInList < itemCnt - 1) {
          return true;
        }
      }
    return false;
  }

  protected loadRecFile(rfId:number | string) {
    this.ap.stop();
    let audioContext = AudioContextProvider.audioContextInstance()
    this.recordingFileService.fetchRecordingFile(audioContext, rfId).subscribe(value => {

      this.status = 'Audio file loaded.';

      this.recordingFile = value;

      let clip = new AudioClip(value.audioBuffer)
      let sel: Selection = null;
      if (value.editStartFrame != null) {
        if (value.editEndFrame != null) {
          sel = new Selection(value.editStartFrame, value.editEndFrame)
        } else {
          let ch0 = value.audioBuffer.getChannelData(0)
          let frameLength = ch0.length;
          sel = new Selection(value.editStartFrame, frameLength)
        }
      } else if (value.editEndFrame != null) {
        sel = new Selection(0, value.editEndFrame)
      }

      clip.selection = sel
      this.audioClip = clip

      this.loadedRecfile();

    }, error1 => {
      this.status = 'Error loading audio file!';
    });
  }

  protected loadedRecfile() {
    console.debug("LoadedRecFile")
    if(this.recordingFile && !this.sessionId) {
      let sId=this.recordingFile.session
      if(!sId){
        sId=this.sessionIdFromRoute;
      }
      if (sId) {
        this.loadSession(sId);
      }
    }
    this.updatePos();
    this.updateActions();
    console.debug("Detect changes")
    this.ref.detectChanges();
  }

  private updateActions(){
    this.prevAction.disabled=!this.prevFileAvail();
    this.nextAction.disabled=!this.nextFileAvail();
  }

  private loadSession(sessionId: string| number) {
    if (<string>sessionId != <string>this.sessionId) {
      console.debug("Loading session ID: "+<string>sessionId +"!="+ <string>this.sessionId)
      this.naviInfoLoading=true;
      this.sessionService.sessionObserver(<string>sessionId).subscribe((s) => {
        //window.setTimeout(()=>{
        this.sessionId = s.sessionId;
        console.debug("Got session, load rec files list...")
        this.recordingService.recordingFileList(s.project, s.sessionId).subscribe((rfds) => {
          this.availRecFiles = new Array<Array<RecordingFile>>();
          let icIdx = new ItemcodeIndex();
          for (let rfdi = 0; rfdi < rfds.length; rfdi++) {
            let rfd = rfds[rfdi];
            if (rfd.date) {
              let rfdd = new Date(rfd.date);
              rfd._dateAsDateObj = rfdd;
            }
            let r = rfd.recording;
            let ic = r.itemcode;
            let exRfsForIc = icIdx[ic];
            if (exRfsForIc == null) {
              // itemcode not yet stored
              let arfd = new Array<RecordingFile>();
              arfd.push(rfd);
              icIdx[ic] = arfd;
              this.availRecFiles.push(arfd);
            } else {
              exRfsForIc.push(rfd);
              // sort latest version (highest version number) to lowest index
              exRfsForIc.sort((rfd1, rfd2) => {
                return rfd2.version - rfd1.version;
              })
            }
          }
          this.availRecFiles.sort((rfs1, rfs2) => {
            let d1 = rfs2[0]._dateAsDateObj;
            let d2 = rfs1[0]._dateAsDateObj;
            if (d1 == null) {
              if (d2 == null) {
                return 0;
              } else {
                // Sort entries whose dates are bot set to the end
                return -1;
              }
            } else {
              if (d2 == null) {
                // Sort entries whose dates are bot set to the end
                return 1;
              } else {
                // Compare date by time in milliseconds value
                return d2.getTime() - d1.getTime();
              }
            }
          });
          console.debug("Loaded rec files list: "+this.availRecFiles.length)
          this.updateActions();
          console.debug("Updated actions.")
          this.updatePos()
          console.debug("Updated pos")
          this.naviInfoLoading=false;
          console.debug("Detect changes")
          this.ref.detectChanges();
          // setting of session ID changes layout, which cannot be detected by audio display, trigger re-layout manually
          //window.setTimeout(()=>{this.layout();});
        });
        // },2000);
      });
    }
  }
}

