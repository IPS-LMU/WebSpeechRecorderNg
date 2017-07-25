import {Injectable, InjectionToken, ModuleWithProviders, NgModule} from '@angular/core';
import {SpeechRecorder} from "./speechrecorder";
import {AudioModule} from "../audio/audio.module";
import {SimpleTrafficLight} from "./startstopsignal/ui/simpletrafficlight";
import {AudioClipUIContainer} from "../audio/ui/container";

import {CommonModule} from "@angular/common";
import {Progress} from "./session/progress";
import {AudioDisplayDialog} from "../audio/audio_display_dialog";
import {
  ControlPanel,
  ProgressDisplay, PromptContainer, Prompter, Prompting, SessionManager, StatusDisplay,
  TransportPanel
} from "./session/sessionmanager";
import {ScrollIntoViewDirective} from "../utils/scrollintoview";
import {MdButtonModule, MdDialogModule,MdIconModule} from "@angular/material";
import {HttpModule} from "@angular/http";
import {SessionService} from "./session/session.service";
import {ScriptService} from "./script/script.service";
import {RouterModule, Routes} from "@angular/router";
import {SpeechRecorderConfig, SPEECHRECORDER_CONFIG} from "./spr.config";

export const VERSION='0.0.6';

const SPR_ROUTES: Routes = [

  { path: 'spr/session/:id',      component: SpeechRecorder },
  { path: 'spr',      component: SpeechRecorder }
];

@NgModule({
    declarations: [Progress,SimpleTrafficLight,AudioDisplayDialog,Prompter,PromptContainer,Prompting,StatusDisplay,ProgressDisplay,TransportPanel,ControlPanel,SessionManager,SpeechRecorder,ScrollIntoViewDirective],
  entryComponents: [
    AudioDisplayDialog
  ],
    exports: [SpeechRecorder],
  imports: [RouterModule.forChild(SPR_ROUTES),HttpModule,CommonModule,
    AudioModule,MdIconModule,MdButtonModule,MdDialogModule],
  providers: [SessionService,ScriptService]

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
