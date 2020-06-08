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

import {Action} from "../../../action/action";
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
      <app-recording-file-navi [versions]="versions" [prevAction]="prevAction" [nextAction]="nextAction"></app-recording-file-navi>
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
  availRecFiles: Array<Array<RecordingFile>>;
  versions: Array<number>=null;

  recordingFile: RecordingFile;
  posInList: number=null;

  @ViewChild(AudioDisplayScrollPane)
  private ac: AudioDisplayScrollPane;

  prevAction: Action<void>;
  nextAction: Action<void>;

  constructor(protected recordingFileService: RecordingFileService, protected recordingService: RecordingService, protected sessionService: SessionService, protected router:Router,protected route: ActivatedRoute, protected ref: ChangeDetectorRef, protected eRef: ElementRef, protected dialog: MatDialog) {
    super(route, ref, eRef)
    this.parentE = this.eRef.nativeElement;
    this.prevAction = new Action<void>('Previous');
    this.prevAction.onAction= ()=>this.prevFile();
    this.nextAction = new Action<void>('Next');
    this.nextAction.onAction= ()=>this.nextFile();
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
        this.loadSession(sIdP);
      }
      if (rfIdP) {
        this.loadRecFile(rfIdP);
      }
    });
    this.route.params.subscribe((params: Params) => {
      let rfIdP = params['recordingFileId'];
      let sIdP = params['sessionId'];
      if (sIdP) {
        this.loadSession(sIdP);
      }
      if (rfIdP) {
        this.loadRecFile(rfIdP);
      }
    });
    if(this.sessionId){
        this.loadSession(this.sessionId);
    }
  }

  private navigateToRecordingFile(){
    let latestNextRf = this.availRecFiles[this.posInList][0];
    let lnRfId=latestNextRf.recordingFileId;
    this.router.navigate(['../'+lnRfId], {relativeTo:this.route});
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
    if(this.availRecFiles && this.posInList) {
      let arfs = this.availRecFiles[this.posInList];
      if (arfs) {
        this.versions = arfs.map<number>((rf) => {
          return rf.version ? rf.version : 0;
        })
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
    if(this.recordingFile && !this.sessionId) {
      if (this.recordingFile.session) {
        this.loadSession(this.recordingFile.session);
      }
    }
    this.updateActions();
  }

  private updateActions(){
    this.prevAction.disabled=!this.prevFileAvail();
    this.nextAction.disabled=!this.nextFileAvail();
  }

  private loadSession(sessionId: string| number) {

    this.sessionService.sessionObserver(<string>sessionId).subscribe((s) => {
      this.sessionId=s.sessionId;
      this.recordingService.recordingFileList(s.project, s.sessionId).subscribe((rfds) => {
        this.availRecFiles=new Array<Array<RecordingFile>>();
        let icIdx=new ItemcodeIndex();
        for(let rfdi=0;rfdi<rfds.length;rfdi++){
          let rfd=rfds[rfdi];

          let r=rfd.recording;
          let ic=r.itemcode;
          let exRfsForIc=icIdx[ic];
          if(exRfsForIc==null){
            // itemcode not yet stored
            let arfd=new Array<RecordingFile>();
            arfd.push(rfd);
            icIdx[ic]=arfd;
            this.availRecFiles.push(arfd);
          }else {
              exRfsForIc.push(rfd);
              // sort latest version (highest version number) to lowest index
              exRfsForIc.sort((rfd1,rfd2)=>{
                return rfd2.version-rfd1.version;
              })
          }
        }
       this.updateActions();
      });
    });
  }

}

