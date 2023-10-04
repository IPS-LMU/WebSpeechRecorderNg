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
import {RecordingFile, SprRecordingFile} from "../../recording";
import {RecordingFileUtil} from "./recording-file";


export class ItemcodeIndex{
  [itemcode: string]: Array<SprRecordingFile>;
}

@Component({

  selector: 'app-audiodisplayplayer',

  template: `

    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
    <div class="ctrlview">
      <app-recording-file-meta [sessionId]="sessionId" [recordingFile]="recordingFile" [stateLoading]="audioFetching"></app-recording-file-meta>

    <audio-display-control [audioClip]="audioClip"
                             [playStartAction]="playStartAction"
                             [playSelectionAction]="playSelectionAction"
                             [playStopAction]="playStopAction"
                             [autoPlayOnSelectToggleAction]="ap?.autoPlayOnSelectToggleAction"
                             [zoomInAction]="zoomInAction"
                             [zoomOutAction]="zoomOutAction"
                             [zoomSelectedAction]="zoomSelectedAction"
                           [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control>
      <app-recording-file-navi [items]="availRecFiles?.length" [itemPos]="posInList" [version]="recordingFileVersion" [versions]="versions" [firstAction]="firstAction" [prevAction]="prevAction" [nextAction]="nextAction" [lastAction]="lastAction" [selectVersion]="toVersionAction" [naviInfoLoading]="naviInfoLoading"></app-recording-file-navi>
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

  sessionId: string | number | null= null;
  sessionIdFromRoute:string|null=null;

  availRecFiles: Array<Array<SprRecordingFile>>|null=null;
  versions: Array<number>|null=null;

  recordingFile: SprRecordingFile|null=null;
  recordingFileVersion:number|null=null;
  private routedByQueryParam=false;
  posInList: number|null=null;


  @ViewChild(AudioDisplayScrollPane)
  private ac!: AudioDisplayScrollPane;

  firstAction: Action<void>;
  prevAction: Action<void>;
  nextAction: Action<void>;
  lastAction: Action<void>;
  toVersionAction: Action<number>;
  audioFetching=false;

  naviInfoLoading=false;

  constructor(protected recordingFileService: RecordingFileService, protected recordingService: RecordingService, protected sessionService: SessionService, protected router:Router,protected route: ActivatedRoute, protected ref: ChangeDetectorRef, protected eRef: ElementRef, protected dialog: MatDialog) {
    super(route, ref, eRef)
    this.parentE = this.eRef.nativeElement;
    this.firstAction = new Action<void>('First');
    this.firstAction.onAction= ()=>{
      this.posInList=0;
      this.navigateToRecordingFile();
    }
    this.prevAction = new Action<void>('Previous');
    this.prevAction.onAction= ()=>this.prevFile();
    this.nextAction = new Action<void>('Next');
    this.nextAction.onAction= ()=>this.nextFile();
    this.lastAction = new Action<void>('Last');
    this.lastAction.onAction= ()=>{
      if(this.availRecFiles) {
        this.posInList = this.availRecFiles.length - 1;
        this.navigateToRecordingFile();
      }
    }

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
    if(this.posInList!=null && this.availRecFiles) {
      let latestNextRf = this.availRecFiles[this.posInList][0];
      let lnRfId = latestNextRf.recordingFileId;
      if(lnRfId) {
        this.navigateToId(lnRfId);
      }
    }
  }

  toVersion(ae: ActionEvent<number>) {
    let toRfId = null;
    let version = ae.value;
    if(this.posInList!=null && this.availRecFiles) {
      let cRfs = this.availRecFiles[this.posInList];
      let availVersionCnt = cRfs.length;
      for (let cRf of cRfs) {
        if(cRf.version !=null) {
          if (cRf.version === version) {
            toRfId = cRf.recordingFileId;
            break;
          }
        }
      }
    }
    if (toRfId != null) {
      this.navigateToId(toRfId);
    }
  }


  prevFile() {
    if(this.posInList!=null) {
      this.posInList--;
    }
    this.navigateToRecordingFile()
  }
  nextFile() {
    if(this.posInList!=null) {
      this.posInList++;
    }
    this.navigateToRecordingFile()
  }

  private positionInList():number | null{
    if (this.availRecFiles && this.recordingFile) {
      let cic=this.recordingFile.itemCode;
      if(!cic && this.recordingFile.recording && this.recordingFile.recording.itemcode){
        cic=this.recordingFile.recording.itemcode;
      }
      if (cic) {
        let itemCnt = this.availRecFiles.length
        for (let rfdi = 0; rfdi < itemCnt; rfdi++) {
          let arRf = this.availRecFiles[rfdi][0];
          if (arRf.recording) {
            let ar = arRf.recording;
            if (cic === ar.itemcode) {
              return rfdi;
            }
          }
        }
      }else{
        let itemCnt = this.availRecFiles.length
        for (let rfdi = 0; rfdi < itemCnt; rfdi++) {
          let arRf = this.availRecFiles[rfdi][0];
            if (this.recordingFile.uuid === arRf.uuid) {
              return rfdi;
            }
          }
      }
    }
    return null;
  }

  private updatePos(){
    this.posInList=this.positionInList();
    this.toVersionAction.disabled=true;
    if(this.availRecFiles){
      let avRfsLen=this.availRecFiles.length;
      if(this.posInList !=null && avRfsLen>this.posInList) {
        let arfs = this.availRecFiles[this.posInList];
        if (arfs) {
          this.versions = new Array<number>();
          for (let arf of arfs) {
            if(arf.recording?.itemcode) {
              this.versions.push(arf.version)
            }
          }

          this.toVersionAction.disabled=(this.versions.length<2);
        }
      }
    }

    if(this.recordingFile){
      if(this.recordingFile.version){
        this.recordingFileVersion=this.recordingFile.version;
      }else{
        this.recordingFileVersion=0;
      }
    }else{
      this.recordingFileVersion=null;
    }
    this.updateActions()
  }

  protected loadRecFile(rfId:number | string) {
    this.ap?.stop();
    this.audioClip =null;
    this.recordingFile=null;
    this.posInList=null;
    this.updateActions();
    let audioContext = AudioContextProvider.audioContextInstance();
    if(audioContext) {
      this.audioFetching=true;
      this.recordingFileService.fetchSprRecordingFile(audioContext, rfId).subscribe(value => {
        this.audioFetching=false;
        this.status = 'Audio file loaded.';
        let clip = null;
        this.recordingFile = value;
        if (this.recordingFile) {
          let ab = this.recordingFile.audioDataHolder;
          if (ab) {
            clip = new AudioClip(ab);

            let esffsr = null;
            let eeffsr = null;
            let esr = null;

            if (clip.audioDataHolder != null) {
              esr = ab.sampleRate;
              if (esr != null) {
                esffsr = RecordingFileUtil.editStartFrameForSampleRate(this.recordingFile, esr);
                eeffsr = RecordingFileUtil.editEndFrameForSampleRate(this.recordingFile, esr);
              }
              let sel: Selection | null = null;
              if (esffsr != null) {
                if (eeffsr != null) {
                  sel = new Selection(ab.sampleRate, esffsr, eeffsr);
                } else {
                  //let ch0 = ab.getChannelData(0);
                  let frameLength = ab.frameLen;
                  sel = new Selection(esr, esffsr, frameLength);
                }
              } else if (eeffsr != null) {
                sel = new Selection(esr, 0, eeffsr);
              }
              clip.selection = sel
            }
          }
        }
        this.audioClip = clip
        this.loadedRecfile();

      }, error1 => {
        this.audioFetching=false;
        this.status = 'Error loading audio file!';
      });
    }
  }

  protected loadedRecfile() {
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
    this.ref.detectChanges();
  }

  private updateActions(){
    let itemCnt:number|null=null;
    if(this.availRecFiles) {
      itemCnt = this.availRecFiles.length;
    }
    this.firstAction.disabled=(this.posInList==null || this.posInList == 0);
    this.prevAction.disabled=(this.posInList==null || this.posInList == 0);
    this.nextAction.disabled=(this.posInList==null || itemCnt==null || this.posInList >= itemCnt - 1);
    this.lastAction.disabled=(this.posInList==null || itemCnt==null || this.posInList >= itemCnt - 1);
  }

  private loadSession(sessionId: string| number) {
    // load session and recording file meta data only when on init and when session changes
    if (<string>sessionId != <string>this.sessionId) {
      // tell UI that we are working...
      this.naviInfoLoading=true;
      this.sessionService.sessionObserver(<string>sessionId).subscribe((s) => {
        // received session data
        this.sessionId = s.sessionId;
        // fetch recording file meta data list
        this.recordingService.sprRecordingFileList(s.project, s.sessionId).subscribe((rfds) => {
          this.availRecFiles = new Array<Array<SprRecordingFile>>();
          // build structure indexed by itemcode
          let icIdx = new ItemcodeIndex();
          for (let rfdi = 0; rfdi < rfds.length; rfdi++) {
            let rfd = rfds[rfdi];
            if (rfd.date) {
              // convert date string for faster sorting later
              let rfdd = new Date(rfd.date);
              rfd._dateAsDateObj = rfdd;
            }
            let ic = rfd.itemCode;

            if (!ic) {
              let r = rfd.recording;
              if (r && r.itemcode) {
                ic = r.itemcode;
              }
            }
            if (ic) {
              let exRfsForIc = icIdx[ic];
              if (exRfsForIc == null) {
                // itemcode not yet stored
                let arfd = new Array<SprRecordingFile>();
                arfd.push(rfd);
                icIdx[ic] = arfd;
                this.availRecFiles.push(arfd);
              } else {
                // rec file with itemcode already exists, add (push) this version ...
                exRfsForIc.push(rfd);
                // .. and sort latest version (highest version number) to lowest index
                exRfsForIc.sort((rfd1, rfd2) => {
                  return rfd2.version - rfd1.version;
                })
              }

            } else {
              let arfd = new Array<SprRecordingFile>();
              arfd.push(rfd);
              this.availRecFiles.push(arfd);
            }
          }
          // have unsorted itemcode indexed recording files here
          // sort them ordered by date of latest version ascending
          this.availRecFiles.sort((rfs1, rfs2) => {
            let d1 = rfs2[0]._dateAsDateObj;
            let d2 = rfs1[0]._dateAsDateObj;
            if (d1 == null) {
              if (d2 == null) {
                return 0;
              } else {
                // Sort entries whose dates are not set to the end
                return -1;
              }
            } else {
              if (d2 == null) {
                // Sort entries whose dates are not set to the end
                return 1;
              } else {
                // Compare date by time in milliseconds value
                return d2.getTime() - d1.getTime();
              }
            }
          });
          for(let avRf of this.availRecFiles){
              if(avRf[0] && avRf[0].recording) {
                let os = avRf[0].recording.itemcode + ': versions: ';
                for (let avRfV of avRf) {
                  os += avRfV.version + '/';
                }
                //console.debug(os);
              }
          }
          this.updatePos()
          this.naviInfoLoading=false;
          this.ref.detectChanges();
        });
      });
      }
  }
}

