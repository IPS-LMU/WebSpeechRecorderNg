import {ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechrecorderngComponent} from "./speechrecorderng.component";
import {SimpleTrafficLight} from "./speechrecorder/startstopsignal/ui/simpletrafficlight";

import {CommonModule} from "@angular/common";
import {Progress} from "./speechrecorder/session/progress";
import {
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
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
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

import {RecordingService} from "./speechrecorder/recordings/recordings.service";
import {AudioClipUIContainer} from "./audio/ui/container";
import {AudioDisplay} from "./audio/audio_display";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatCardModule} from "@angular/material/card";
import {MatDividerModule} from "@angular/material/divider";
import {MatGridListModule} from "@angular/material/grid-list";
import {RecordingFileUI} from "./speechrecorder/session/recordingfile/recording-file-u-i.component";
import {RecordingFileService} from "./speechrecorder/session/recordingfile/recordingfile-service";
import {RecordingFileViewComponent} from "./speechrecorder/session/recordingfile/recording-file-view.component";
import {MatTableModule} from "@angular/material/table";
import {MatSelectModule} from "@angular/material/select";
import {MatInputModule} from "@angular/material/input";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {AudioRecorderComponent} from "./speechrecorder/session/audiorecorder";
import {MatMenuModule} from "@angular/material/menu";
import {IntersectionObserverDirective} from "./ui/intersection-observer.directive";
import {MatFormFieldModule} from "@angular/material/form-field";


export const SPR_ROUTES: Routes = [
  { path: 'spr/session/:id',      component: SpeechrecorderngComponent },
  { path: 'recorder/session/:id',      component: AudioRecorderComponent},
  { path: 'recorder',      component: AudioRecorderComponent},
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

@NgModule({ declarations: [],
    exports: [ ],
  imports: [RouterModule.forChild(SPR_ROUTES),MatFormFieldModule,MatInputModule],
  providers: [SessionService, ProjectService, ScriptService, RecordingService, RecordingFileService, SpeechRecorderUploader, provideHttpClient(withInterceptorsFromDi())] })
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
