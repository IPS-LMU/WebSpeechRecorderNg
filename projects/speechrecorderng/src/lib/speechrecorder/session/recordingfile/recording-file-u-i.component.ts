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
import {PromptitemUtil} from "../../script/script";
import {Action} from "../../../action/action";
import {RecordingFileViewComponent} from "./recording-file-view.component";

@Component({

  selector: 'app-audiodisplayplayer',

  template: `      
      <h1>Recording file editing</h1>
      <p>On export or delivery the editing selection of the recording file is cut out. If no editing selection is applied the original file is exported.</p>
      
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
      <button mat-raised-button color="accent" (click)="applySelection()" [disabled]="editSaved">{{this.applyButtonText()}}</button>
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
export class RecordingFileUI extends RecordingFileViewComponent implements AfterViewInit {

  savedEditSelection:Selection;
  editSaved:boolean=true

  constructor(protected recordingFileService:RecordingFileService,protected route: ActivatedRoute, protected ref: ChangeDetectorRef,protected eRef:ElementRef, protected dialog:MatDialog) {
    super(recordingFileService,route,ref,eRef,dialog)
    this.parentE=this.eRef.nativeElement;
    this.prevAction=new Action<void>('Previous');
    this.nextAction=new Action<void>('Next');
  }

  ngAfterViewInit() {
    super.ngAfterViewInit()
  }

  applyButtonText():string {
    if(this.audioClip) {
      let s = this.audioClip.selection
      if (s) {
        return "Apply current selection as editing selection";
      }else{
        return "Cancel out editing selection";
      }
    }
    // just as fallback
    return "Apply selection";
  }

protected loadedRecfile() {
  super.loadedRecfile();

  this.audioClip.addSelectionObserver((clip) => {
    let s = clip.selection
    this.editSaved = ((this.savedEditSelection == null && s == null) || this.savedEditSelection != null && this.savedEditSelection.equals(s))
  })
  this.savedEditSelection = this.audioClip.selection;
  this.editSaved = true
}

  applySelection(){

    console.log("apply selection to "+this._recordingFileId)

    let sf:number=null;
    let ef:number=null;
    if(this.audioClip) {
      let s = this.audioClip.selection
      if (s) {
        sf = s.startFrame
        ef = s.endFrame
      }

      this.recordingFileService.saveEditSelection(this._recordingFileId, sf, ef).subscribe((value) => {

        },
        () => {
          this.dialog.open(MessageDialog, {

            data: {
              type: 'error',
              title: 'Save selection edit error',
              msg: "Could not save edit selection to WikiSpeech server!",
              advice: "Please check network connection and server state."
            }
          })
        },
        () => {
        // Or use returned selection value from server?
          this.savedEditSelection = s
          this.editSaved = true
        })
    }
  }

}

