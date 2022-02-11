import {AfterViewInit, Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {RecordingFile, SprRecordingFile} from "../recording";
import {MediaUtils} from "../../media/utils";
import {MatTable, MatTableDataSource} from "@angular/material/table";
import {Observable, Subject} from "rxjs";
import {RecordingList} from "./recording_list";
import {AudioClip} from "../../audio/persistor";
import {Action} from "../../action/action";
import {AudioDisplay} from "../../audio/audio_display";

@Component({

  selector: 'app-recordercombipane',

  template: `
    <app-recordinglist [selectedRecordingFile]="selectedRecordingFile" [selectDisabled]="selectDisabled" (selectedRecordingFileChanged)="selectRecordingFile($event)"></app-recordinglist>
    <div fxHide.xs #asCt [class.active]="!audioSignalCollapsed">
      <app-audiodisplay #audioSignalContainer [class.active]="!audioSignalCollapsed"
                        [audioClip]="displayAudioClip"
                        [playStartAction]="playStartAction"
                        [playSelectionAction]="playSelectionAction"
                        [autoPlayOnSelectToggleAction]="autoPlayOnSelectToggleAction"
                        [playStopAction]="playStopAction"></app-audiodisplay>
    </div>
  `,
  styles: [`:host {
    position: relative;
    margin: 0;
    padding: 0;
    background: lightgrey;
    width: 100%; /* use all horizontal available space */
    flex: 1; /* ... and fill rest of vertical available space (other components have flex 0) */
    overflow-y: auto;

    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    min-height: 0px;

  }`,`
    .selected{
      font-weight: bold;
    }
  `, `
    div {
      display: none;
      position: absolute;
      z-index: 5;
    }`, `
    div.active {
      display: flex;
      position: absolute;
      bottom: 0px;
      height: 90%;
      width: 100%;

      overflow: hidden;

      padding: 0px;

      z-index: 200;  /* Needs a higher value then the sticky Material table header (which is z-index: 100) */
      box-sizing: border-box;
      background-color: rgba(0, 0, 0, 0)

    }`],
  styleUrls: ['../../speechrecorder_mat.scss']

})
export class RecorderCombiPane implements AfterViewInit{

  @ViewChild(RecordingList) recordingListComp!:RecordingList;
  @Input() selectDisabled:boolean=false;
  @Output() selectedRecordingFileChanged = new EventEmitter<RecordingFile>();
  @Input() selectedRecordingFile:RecordingFile|null=null;

  @ViewChild(AudioDisplay, { static: true }) audioDisplay!: AudioDisplay;
  @Input() audioSignalCollapsed: boolean=true;
  @Input() displayAudioClip: AudioClip | null=null;
  @Input() playStartAction: Action<void>|undefined;
  @Input() playSelectionAction: Action<void>|undefined;
  @Input() autoPlayOnSelectToggleAction:Action<boolean>|undefined;
  @Input() playStopAction: Action<void>|undefined;

  constructor() {

  }

  ngAfterViewInit() {

  }

  push(rf:RecordingFile){
    this.recordingListComp.push(rf);

  }

  selectRecordingFile(rf:RecordingFile){
    this.selectedRecordingFileChanged.emit(rf);
  }

  selectTop() {
    this.recordingListComp.selectTop();
  }

}
