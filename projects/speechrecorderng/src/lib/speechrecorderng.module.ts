import {ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechrecorderngComponent} from "./speechrecorderng.component";
import {SimpleTrafficLight} from "./speechrecorder/startstopsignal/ui/simpletrafficlight";

import {CommonModule} from "@angular/common";
import {Progress} from "./speechrecorder/session/progress";
import {
  ProgressAndSpeakerContainer,
  PromptContainer, Prompter, Prompting, PromptingContainer, Recinstructions,
} from "./speechrecorder/session/prompting";
import {SessionManager} from "./speechrecorder/session/sessionmanager";
import {WarningBar} from "./speechrecorder/session/warning_bar";
import {ScrollIntoViewDirective} from "./utils/scrollIntoViewToBottom";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import {HttpClientModule} from "@angular/common/http";
import {SessionService} from "./speechrecorder/session/session.service";
import {ScriptService} from "./speechrecorder/script/script.service";
import {RouterModule, Routes} from "@angular/router";
import {SpeechRecorderConfig, SPEECHRECORDER_CONFIG} from "./spr.config";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {ProjectService} from "./speechrecorder/project/project.service";
import {
  ControlPanel,
  ProgressDisplay,
  ReadyStateIndicator,
  StatusDisplay,
  TransportPanel,
  UploadStatus, WakeLockIndicator
} from "./speechrecorder/session/controlpanel";
//import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionFinishedDialog} from "./speechrecorder/session/session_finished_dialog";
import {MessageDialog} from "./ui/message_dialog";
import {RecordingItemControls, RecordingItemDisplay} from "./ui/recordingitem_display";
import {RecordingService} from "./speechrecorder/recordings/recordings.service";
import {ScrollPaneHorizontal} from "./audio/ui/scroll_pane_horizontal";
import {AudioClipUIContainer} from "./audio/ui/container";
import {AudioSignal} from "./audio/ui/audiosignal";
import {Sonagram} from "./audio/ui/sonagram";
import {AudioDisplayPlayer} from "./audio/audio_player";
import {AudioDisplay} from "./audio/audio_display";
import {AudioDisplayControl} from "./audio/ui/audio_display_control";
import {LevelBar} from "./audio/ui/livelevel";
import {AudioDisplayScrollPane} from "./audio/ui/audio_display_scroll_pane";
import {UUID} from "./utils/utils";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatCard, MatCardModule} from "@angular/material/card";
import {MatDividerModule} from "@angular/material/divider";
import {MatGridListModule} from "@angular/material/grid-list";
import {RecordingFileUI} from "./speechrecorder/session/recordingfile/recording-file-u-i.component";
import {RecordingFileService} from "./speechrecorder/session/recordingfile/recordingfile-service";
import {RecordingFileViewComponent} from "./speechrecorder/session/recordingfile/recording-file-view.component";
import {MatTableModule} from "@angular/material/table";
import {RecordingFileNaviComponent } from './speechrecorder/session/recordingfile/recording-file-navi.component';
import {RecordingFileMetaComponent} from "./speechrecorder/session/recordingfile/recording-file-meta.component";
import {MatSelectModule} from "@angular/material/select";
import {MatInputModule} from "@angular/material/input";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {AudioRecorder, AudioRecorderComponent} from "./speechrecorder/session/audiorecorder";
import {RecordingList} from "./speechrecorder/session/recording_list";
import {RecorderCombiPane} from "./speechrecorder/session/recorder_combi_pane";
import {RecordingFilesComponent} from "./speechrecorder/session/recordingfile/recording-files.component";
import {SpeakerInfo} from "./speechrecorder/speaker/speaker_info";
import {ProjectInfo} from "./speechrecorder/project/project_info";
import {SpeakerService} from "./speechrecorder/speaker/speaker.service";
import {
  RecordingFileDeleteConfirmDialog
} from "./speechrecorder/session/recordingfile/recording-file_delete_confirm_dialog";
import {MatMenuModule} from "@angular/material/menu";
import {CanvasLayerComponent} from "./ui/canvas_layer_comp";
import {ResponsiveComponent} from "./ui/responsive_component";



export const SPR_ROUTES: Routes = [
  {
    path: 'recorder',
    children: [
      {path: 'session/:id', component: AudioRecorderComponent},
      {path: '', component: AudioRecorderComponent}
    ]
  },
  {
    path: 'spr',
    children: [
      {path: 'session/:id', component: SpeechrecorderngComponent},
      {path: 'db',
        children:[
          {path: 'project/:project',
            children: [
              {
                path: 'session/:sessionId',
                children: [
                  {path: 'recordingfile/_view/:recordingFileId', component: RecordingFileViewComponent},
                  {path: 'recordingfile/_edit/:recordingFileId', component: RecordingFileUI},
                  {path: 'recordingfile/_view', component: RecordingFileViewComponent},
                  {path: 'recordingfile/_edit', component: RecordingFileUI},
                  {path: 'recordingfile/:recordingFileId', component: RecordingFileUI},
                  {path: 'recordingfile', component: RecordingFileUI}
                ]
              }

            ]
          }
          ,
          {path: 'recordingfile/_view/:recordingFileId', component: RecordingFileViewComponent},
          {path: 'recordingfile/_edit/:recordingFileId', component: RecordingFileUI},
          {path: 'recordingfile/_view/', component: RecordingFileViewComponent},
          {path: 'recordingfile/_view', component: RecordingFileViewComponent},
          {path: 'recordingfile/_edit', component: RecordingFileUI},
          {path: 'recordingfile/:recordingFileId', component: RecordingFileUI},
          {path: 'recordingfile', component: RecordingFileUI}
        ]
      }
      ,
      {path: '', component: SpeechrecorderngComponent}
    ]
  }
];

@NgModule({
    declarations: [ProjectInfo,SpeakerInfo,ControlPanel,ProgressAndSpeakerContainer,AudioSignal, Sonagram, ScrollPaneHorizontal, AudioClipUIContainer, AudioDisplayScrollPane, AudioDisplay, AudioDisplayPlayer, AudioDisplayControl, LevelBar, Progress, SimpleTrafficLight, Recinstructions, Prompter, PromptContainer, PromptingContainer, Prompting, StatusDisplay,
        ProgressDisplay, RecordingItemDisplay, RecordingItemControls, UploadStatus, TransportPanel, WakeLockIndicator,ReadyStateIndicator, ControlPanel, WarningBar, AudioRecorder,SessionManager, MessageDialog, SessionFinishedDialog, SpeechrecorderngComponent, AudioRecorderComponent,RecordingFilesComponent,RecordingFileViewComponent, RecordingFileUI,
      RecordingFileDeleteConfirmDialog, ScrollIntoViewDirective, RecordingFileNaviComponent, RecordingFileMetaComponent,RecordingList,RecorderCombiPane,AudioRecorder
    ],
    exports: [MessageDialog, SpeechrecorderngComponent, ScrollPaneHorizontal, AudioClipUIContainer, AudioDisplayScrollPane, AudioDisplay, AudioDisplayPlayer, AudioDisplayControl, LevelBar,AudioRecorder],
    imports: [RouterModule.forChild(SPR_ROUTES), CommonModule, MatIconModule, MatButtonModule, MatDialogModule, MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, HttpClientModule, MatCheckboxModule, MatCardModule, MatDividerModule, MatGridListModule, MatTableModule, MatInputModule, MatSelectModule, MatSnackBarModule,MatMenuModule],
    providers: [ ProjectService, SessionService,SpeakerService,ScriptService, RecordingService, RecordingFileService, SpeechRecorderUploader]
})
export class SpeechrecorderngModule{

  static forRoot(config: SpeechRecorderConfig): ModuleWithProviders<SpeechrecorderngModule> {
    return {
      ngModule: SpeechrecorderngModule,
      providers: [
        {provide: SPEECHRECORDER_CONFIG, useValue: config }
      ]
    };
  }
}
