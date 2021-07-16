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
import {ControlPanel, ProgressDisplay, StatusDisplay, TransportPanel, UploadStatus} from "./speechrecorder/session/controlpanel";
import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionFinishedDialog} from "./speechrecorder/session/session_finished_dialog";
import {MessageDialog} from "./ui/message_dialog";
import {LevelBarDisplay} from "./ui/livelevel_display";
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
import { RecordingFileNaviComponent } from './speechrecorder/session/recordingfile/recording-file-navi.component';
import {RecordingFileMetaComponent} from "./speechrecorder/session/recordingfile/recording-file-meta.component";
import {MatSelectModule} from "@angular/material/select";
import {MatInputModule} from "@angular/material/input";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {SpeakerInfo} from "./speechrecorder/speaker/speaker_info";
import {ProjectInfo} from "./speechrecorder/project/project_info";



export const SPR_ROUTES: Routes = [
  { path: 'spr/session/:id',      component: SpeechrecorderngComponent },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile/_view/:recordingFileId',      component: RecordingFileViewComponent },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile/_edit/:recordingFileId',      component: RecordingFileUI },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile/_view',      component: RecordingFileViewComponent },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile/_edit',      component: RecordingFileUI },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile/:recordingFileId',      component: RecordingFileUI },
  { path: 'spr/db/project/:project/session/:sessionId/recordingfile',      component: RecordingFileUI },
  { path: 'spr/db/recordingfile/_view/:recordingFileId',      component: RecordingFileViewComponent },
  { path: 'spr/db/recordingfile/_edit/:recordingFileId',      component: RecordingFileUI },
  { path: 'spr/db/recordingfile/_view/',      component: RecordingFileViewComponent },
  { path: 'spr/db/recordingfile/_view',      component: RecordingFileViewComponent },
  { path: 'spr/db/recordingfile/_edit',      component: RecordingFileUI },
  { path: 'spr/db/recordingfile/:recordingFileId',      component: RecordingFileUI },
  { path: 'spr/db/recordingfile',      component: RecordingFileUI },
  { path: 'spr',      component: SpeechrecorderngComponent }
];

@NgModule({
    declarations: [ProjectInfo,SpeakerInfo,AudioSignal,Sonagram,ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayPlayer,AudioDisplayControl,LevelBar,Progress,ProgressAndSpeakerContainer,SimpleTrafficLight,Recinstructions,Prompter,PromptContainer,PromptingContainer,Prompting,StatusDisplay,
      ProgressDisplay,LevelBarDisplay,UploadStatus,TransportPanel,ControlPanel,WarningBar,SessionManager,MessageDialog,SessionFinishedDialog,SpeechrecorderngComponent,RecordingFileViewComponent,RecordingFileUI,ScrollIntoViewDirective, RecordingFileNaviComponent,RecordingFileMetaComponent],
  entryComponents: [
    MessageDialog,SessionFinishedDialog
  ],
    exports: [MessageDialog,SpeechrecorderngComponent,ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayPlayer,AudioDisplayControl,LevelBar],
    imports: [RouterModule.forChild(SPR_ROUTES), FlexLayoutModule, CommonModule, MatIconModule, MatButtonModule, MatDialogModule, MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, HttpClientModule, MatCheckboxModule, MatCardModule, MatDividerModule, MatGridListModule, MatTableModule,MatInputModule, MatSelectModule,MatSnackBarModule],
  providers: [SessionService,ProjectService,ScriptService,RecordingService,RecordingFileService,SpeechRecorderUploader]

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
