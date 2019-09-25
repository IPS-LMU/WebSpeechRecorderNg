import {ModuleWithProviders, NgModule} from '@angular/core';
import 'hammerjs';
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
import {
    MatButtonModule, MatDialogModule, MatIconModule, MatProgressBar, MatProgressBarModule, MatProgressSpinnerModule,
    MatTooltipModule
} from "@angular/material";
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




export const SPR_ROUTES: Routes = [
  { path: 'spr/session/:id',      component: SpeechrecorderngComponent },
  { path: 'spr',      component: SpeechrecorderngComponent }
];

@NgModule({
    declarations: [AudioSignal,Sonagram,ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayPlayer,AudioDisplayControl,LevelBar,Progress,SimpleTrafficLight,Recinstructions,Prompter,PromptContainer,PromptingContainer,Prompting,StatusDisplay,
      ProgressDisplay,LevelBarDisplay,UploadStatus,TransportPanel,ControlPanel,WarningBar,SessionManager,MessageDialog,SessionFinishedDialog,SpeechrecorderngComponent,ScrollIntoViewDirective],
  entryComponents: [
    MessageDialog,SessionFinishedDialog
  ],
    exports: [SpeechrecorderngComponent,ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayPlayer,AudioDisplayControl,LevelBar],
  imports: [RouterModule.forChild(SPR_ROUTES),FlexLayoutModule,CommonModule,MatIconModule,MatButtonModule,MatDialogModule,MatProgressBarModule,MatProgressSpinnerModule,MatTooltipModule,HttpClientModule],
  providers: [SessionService,ProjectService,ScriptService,RecordingService,SpeechRecorderUploader]

})
export class SpeechrecorderngModule{

  static forRoot(config: SpeechRecorderConfig): ModuleWithProviders {
    return {
      ngModule: SpeechrecorderngModule,
      providers: [
        {provide: SPEECHRECORDER_CONFIG, useValue: config }
      ]
    };
  }
}
