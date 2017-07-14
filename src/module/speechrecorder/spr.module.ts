import { NgModule } from '@angular/core';
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

export const VERSION='0.0.3';
@NgModule({
    declarations: [Progress,SimpleTrafficLight,AudioDisplayDialog,Prompter,PromptContainer,Prompting,StatusDisplay,ProgressDisplay,TransportPanel,ControlPanel,SessionManager,SpeechRecorder,ScrollIntoViewDirective],
    exports: [CommonModule],
  imports: [CommonModule,AudioModule,MdIconModule,MdButtonModule,MdDialogModule]
})
export class SpeechRecorderModule{

}
