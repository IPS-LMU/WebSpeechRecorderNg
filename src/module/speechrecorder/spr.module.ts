import {Injectable, InjectionToken, ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechRecorder} from "./speechrecorder";
import {AudioModule} from "../audio/audio.module";
import {SimpleTrafficLight} from "./startstopsignal/ui/simpletrafficlight";
import {AudioClipUIContainer} from "../audio/ui/container";

import {CommonModule} from "@angular/common";
import {Progress} from "./session/progress";
import {AudioDisplayDialog} from "../audio/audio_display_dialog";
import {
  PromptContainer, Prompter, Prompting,
} from "./session/prompting";
import {
  ControlPanel,
  ProgressDisplay, SessionManager, StatusDisplay,
  TransportPanel, UploadStatus
} from "./session/sessionmanager";
import {ScrollIntoViewDirective} from "../utils/scrollintoview";
import {MdButtonModule, MdDialogModule, MdIconModule, MdProgressSpinnerModule} from "@angular/material";
import {HttpClientModule} from "@angular/common/http";
import {SessionService} from "./session/session.service";
import {ScriptService} from "./script/script.service";
import {RouterModule, Routes} from "@angular/router";
import {SpeechRecorderConfig, SPEECHRECORDER_CONFIG} from "./spr.config";
import {SpeechRecorderUploader} from "./spruploader";
import {Mediaitem, PromptUnit, Script} from "./script/script";
import {Session} from "./session/session";
import {ProjectService} from "./project/project.service";
import {LiveLevelDisplay} from "../audio/ui/livelevel";


export const VERSION='0.0.17';

const SPR_ROUTES: Routes = [

  { path: 'spr/session/:id',      component: SpeechRecorder },
  { path: 'spr',      component: SpeechRecorder }
];

@NgModule({
    declarations: [Progress,SimpleTrafficLight,AudioDisplayDialog,Prompter,PromptContainer,Prompting,StatusDisplay,ProgressDisplay,UploadStatus,TransportPanel,ControlPanel,SessionManager,SpeechRecorder,ScrollIntoViewDirective],
  entryComponents: [
    AudioDisplayDialog
  ],
    exports: [SpeechRecorder],
  imports: [RouterModule.forChild(SPR_ROUTES),CommonModule,
    AudioModule,MdIconModule,MdButtonModule,MdDialogModule,MdProgressSpinnerModule,HttpClientModule],
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
