import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

import {AudioClipUIContainer} from './audio/ui/container';
import {AudioDisplay} from './apps/audio/audio_display';

import { Progress } from './apps/speechrecorder/session/progress'
import {
  SpeechRecorder, Prompting, PromptContainer, Prompter,
  TransportPanel, StatusDisplay, ControlPanel, ProgressDisplay
} from './apps/speechrecorder/speechrecorder'
import { SimpleTrafficLight} from './apps/speechrecorder/startstopsignal/ui/simpletrafficlight'
import {SessionService} from "./apps/speechrecorder/session/session.service";
import {HttpModule} from "@angular/http";
import {ScriptService} from "./apps/speechrecorder/script/script.service";

const appRoutes: Routes = [

    { path: 'session/:id',      component: SpeechRecorder },

    { path: 'test',
        redirectTo: 'session/',
        pathMatch: 'full'
    },
    { path: 'audio_display', component: AudioDisplay
    }
];

@NgModule({
  declarations: [
    AppComponent,SpeechRecorder,Prompting,PromptContainer,Prompter,Progress,ControlPanel,StatusDisplay,TransportPanel,ProgressDisplay,AudioDisplay,AudioClipUIContainer,SimpleTrafficLight
  ],
  imports: [
      RouterModule.forRoot(appRoutes),
      HttpModule,
    BrowserModule
  ],
  providers: [SessionService,ScriptService],

  bootstrap: [AppComponent]
})
export class AppModule { }
