import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit, Input, ElementRef,
} from '@angular/core'


import {ActivatedRoute, Params} from "@angular/router";


import {RecordingFileService} from "./recordingfile-service";
import {MatDialog} from "@angular/material/dialog";
import {AudioDisplayPlayer} from "../../../audio/audio_player";
import {AudioPlayer} from "../../../audio/playback/player";
import {AudioDisplayScrollPane} from "../../../audio/ui/audio_display_scroll_pane";
import {AudioContextProvider} from "../../../audio/context";
import {AudioClip} from "../../../audio/persistor";
import {Selection} from "../../../audio/persistor";
import {MessageDialog} from "../../../ui/message_dialog";
import {RecordingFile} from "./recording-file";
import {PromptItem, PromptitemUtil} from "../../script/script";
import {Action} from "../../../action/action";
import {SessionService} from "../session.service";
import {RecordingService} from "../../recordings/recordings.service";
import {RecordingFileDescriptor} from "../../recording";

@Component({

  selector: 'app-audiodisplayplayer',

  template: `
    
    <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
    <div class="ctrlview">
      <app-recording-file-meta [recordingFile]="recordingFile"></app-recording-file-meta>
      <app-recording-file-navi [prevAction]="prevAction" [nextAction]="nextAction"></app-recording-file-navi>
    <audio-display-control [audioClip]="audioClip"
                             [playStartAction]="playStartAction"
                             [playSelectionAction]="playSelectionAction"
                             [playStopAction]="playStopAction"
                             [autoPlayOnSelectToggleAction]="ap?.autoPlayOnSelectToggleAction"
                             [zoomInAction]="zoomInAction"
                             [zoomOutAction]="zoomOutAction"
                             [zoomSelectedAction]="zoomSelectedAction"
                           [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control>
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
export class RecordingFileViewComponent extends AudioDisplayPlayer implements AfterViewInit {

  protected _recordingFileId: string | number=null;
  sessionId: string | number=null;
  availRecFileDescrs:Array<RecordingFileDescriptor>;
  recordingFile: RecordingFile;

  @ViewChild(AudioDisplayScrollPane)
  private ac: AudioDisplayScrollPane;

  prevAction: Action<void>;
  nextAction: Action<void>;

  constructor(protected recordingFileService:RecordingFileService,protected recordingService:RecordingService,protected sessionService:SessionService,protected route: ActivatedRoute, protected ref: ChangeDetectorRef,protected eRef:ElementRef, protected dialog:MatDialog) {
    super(route,ref,eRef)
    this.parentE=this.eRef.nativeElement;
    this.prevAction=new Action<void>('Previous');
    this.nextAction=new Action<void>('Next');
  }


  ngAfterViewInit() {
    super.ngAfterViewInit()

    this.route.queryParams.subscribe((params: Params) => {

      let rfIdP=params['recordingFileId'];
      let sIdP=params['sessionId'];
      if(sIdP){
        this.sessionId=sIdP;
        this.loadSession();
      }
      if(rfIdP) {
        this._recordingFileId=rfIdP
        console.log("Loading recording file ID (by query param): "+this._recordingFileId+ " referrer: "+document.referrer)
        this.ap.stop();
        this.loadRecFile()
      }
    });
    this.route.params.subscribe((params: Params) => {

      let rfIdP=params['recordingFileId'];
      let sIdP=params['sessionId'];
      if(sIdP){
        this.sessionId=sIdP;
        this.loadSession();
      }
      if(rfIdP) {
        this._recordingFileId=rfIdP
        console.log("Loading recording file ID (by route param): "+this._recordingFileId)
        this.ap.stop();
        this.loadRecFile()
      }
    });
  }

  nextFile(){

  }

  nextFileAvail(){
    if(this.availRecFileDescrs && this.recordingFile){
      let cic=this.recordingFile.recording.itemcode;
      //let ich=
      for(let rfdi=0;rfdi<this.availRecFileDescrs.length;rfdi++){
          let ar=this.availRecFileDescrs[rfdi].recording;
          //ar.itemcode
      }
    }
  }

  protected loadRecFile() {
    let audioContext = AudioContextProvider.audioContextInstance()
    this.recordingFileService.fetchRecordingFile(audioContext,this._recordingFileId).subscribe(value => {

      this.status = 'Audio file loaded.';

      this.recordingFile=value;

      let clip=new AudioClip(value.audioBuffer)
      let sel:Selection=null;
      if(value.editStartFrame!=null){
          if(value.editEndFrame!=null){
            sel=new Selection(value.editStartFrame,value.editEndFrame)
          }else{
            let ch0 = value.audioBuffer.getChannelData(0)
            let frameLength = ch0.length;
            sel=new Selection(value.editStartFrame,frameLength)
          }
      }else if(value.editEndFrame!=null){
        sel=new Selection(0,value.editEndFrame)
      }

      clip.selection=sel
      this.audioClip=clip
      this.loadedRecfile();

    },error1 => {
      this.status = 'Error loading audio file!';
    });

  }

  protected loadedRecfile(){

  }


  private loadSession() {
    this.sessionService.sessionObserver(<string>this.sessionId).subscribe((s)=>{
        this.recordingService.recordingFileDescrList(s.project,s.sessionId).subscribe((rfds)=>{
            this.availRecFileDescrs=rfds;
        });
    })
  }
}

