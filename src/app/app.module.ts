import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

import {AudioClipUIContainer} from "./audio/ui/container";

@NgModule({
  declarations: [
    AppComponent,AudioClipUIContainer
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
