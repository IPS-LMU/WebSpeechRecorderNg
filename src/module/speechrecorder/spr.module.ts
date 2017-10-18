import {ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechRecorder} from "./speechrecorder";
import {AudioModule} from "../audio/audio.module";
import {SimpleTrafficLight} from "./startstopsignal/ui/simpletrafficlight";

import {CommonModule} from "@angular/common";
import {Progress} from "./session/progress";
import {
  PromptContainer, Prompter, Prompting, PromptingContainer, Recinstructions,
} from "./session/prompting";
import {SessionManager} from "./session/sessionmanager";
import {ScrollIntoViewDirective} from "../utils/scrollintoview";
import {
    MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule
} from "@angular/material";
import {HttpClientModule} from "@angular/common/http";
import {SessionService} from "./session/session.service";
import {ScriptService} from "./script/script.service";
import {RouterModule, Routes} from "@angular/router";
import {SpeechRecorderConfig, SPEECHRECORDER_CONFIG} from "./spr.config";
import {SpeechRecorderUploader} from "./spruploader";
import {ProjectService} from "./project/project.service";
import {ControlPanel, ProgressDisplay, StatusDisplay, TransportPanel, UploadStatus} from "./session/controlpanel";
import {FlexLayoutModule} from "@angular/flex-layout";
import {SessionFinishedDialog} from "./session/session_finished_dialog";
import {MessageDialog} from "../ui/message_dialog";



const SPR_ROUTES: Routes = [

  { path: 'spr/session/:id',      component: SpeechRecorder },
  { path: 'spr',      component: SpeechRecorder }
];

@NgModule({
    declarations: [ControlPanel,Progress,SimpleTrafficLight,Recinstructions,Prompter,PromptContainer,PromptingContainer,Prompting,StatusDisplay,
      ProgressDisplay,UploadStatus,TransportPanel,ControlPanel,SessionManager,MessageDialog,SessionFinishedDialog,SpeechRecorder,ScrollIntoViewDirective],
  entryComponents: [
    MessageDialog,SessionFinishedDialog
  ],
    exports: [SpeechRecorder],
  imports: [RouterModule.forChild(SPR_ROUTES),FlexLayoutModule,CommonModule,
    AudioModule,MatIconModule,MatButtonModule,MatDialogModule,MatProgressSpinnerModule,MatTooltipModule,HttpClientModule],
  providers: [SessionService,ProjectService,ScriptService,SpeechRecorderUploader]

})
export class SpeechRecorderModule{

  static forRoot(config: SpeechRecorderConfig): ModuleWithProviders {
    return {
      ngModule: SpeechRecorderModule,
      providers: [
        {provide: SPEECHRECORDER_CONFIG, useValue: config }
      ]
    };
  }
}
