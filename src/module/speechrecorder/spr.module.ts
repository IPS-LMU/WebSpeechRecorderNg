import {Injectable, InjectionToken, ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechRecorder} from "./speechrecorder";
import {AudioModule} from "../audio/audio.module";
import {SimpleTrafficLight} from "./startstopsignal/ui/simpletrafficlight";
import {AudioClipUIContainer} from "../audio/ui/container";

import {CommonModule} from "@angular/common";
import {Progress} from "./session/progress";
import {AudioDisplayDialog} from "../audio/audio_display_dialog";
import {
  PromptContainer, Prompter, Prompting, PromptingContainer, Recinstructions,
} from "./session/prompting";
import {SessionManager} from "./session/sessionmanager";
import {ScrollIntoViewDirective} from "../utils/scrollintoview";
import {MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule} from "@angular/material";
import {HttpClientModule} from "@angular/common/http";
import {SessionService} from "./session/session.service";
import {ScriptService} from "./script/script.service";
import {RouterModule, Routes} from "@angular/router";
import {SpeechRecorderConfig, SPEECHRECORDER_CONFIG} from "./spr.config";
import {SpeechRecorderUploader} from "./spruploader";
import {ProjectService} from "./project/project.service";
import {ControlPanel, ProgressDisplay, StatusDisplay, TransportPanel, UploadStatus} from "./session/controlpanel";
import {FlexLayoutModule} from "@angular/flex-layout";


const SPR_ROUTES: Routes = [

  { path: 'spr/session/:id',      component: SpeechRecorder },
  { path: 'spr',      component: SpeechRecorder }
];

@NgModule({
    declarations: [ControlPanel,Progress,SimpleTrafficLight,AudioDisplayDialog,Recinstructions,Prompter,PromptContainer,PromptingContainer,Prompting,StatusDisplay,
      ProgressDisplay,UploadStatus,TransportPanel,ControlPanel,SessionManager,SpeechRecorder,ScrollIntoViewDirective],
  entryComponents: [
    AudioDisplayDialog
  ],
    exports: [SpeechRecorder],
  imports: [RouterModule.forChild(SPR_ROUTES),FlexLayoutModule,CommonModule,
    AudioModule,MatIconModule,MatButtonModule,MatDialogModule,MatProgressSpinnerModule,HttpClientModule],
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
