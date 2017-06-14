import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

import {AudioClipUIContainer} from './audio/ui/container';
import {AudioDisplay} from './apps/audio/audio_display';

import {
  SpeechRecorder, Prompting, PromptContainer, Prompter,
  TransportPanel, StatusDisplay, ControlPanel
} from './apps/speechrecorder/speechrecorder'
import { SimpleTrafficLight} from './apps/speechrecorder/startstopsignal/ui/simpletrafficlight'

@NgModule({
  declarations: [
    AppComponent,SpeechRecorder,Prompting,PromptContainer,Prompter,ControlPanel,StatusDisplay,TransportPanel,AudioDisplay,AudioClipUIContainer,SimpleTrafficLight
  ],
  imports: [
    BrowserModule
  ],
  providers: [],

  bootstrap: [AppComponent]
})
export class AppModule { }
