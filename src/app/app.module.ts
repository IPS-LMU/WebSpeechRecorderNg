import { NgModule } from '@angular/core';
import {bootstrapApplication, BrowserModule} from '@angular/platform-browser';

import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatToolbarModule } from "@angular/material/toolbar";
import {SpeechrecorderngModule} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";
import {appConfig, SPR_CFG} from "./app.config";
import {RouterModule} from "@angular/router";
import {appRoutes} from "./app.routes";
import {AppComponent} from "./app.component";





@NgModule({
  declarations: [AppComponent],
  imports: [
    RouterModule.forRoot(appRoutes, {}),
    BrowserAnimationsModule,
    MatMenuModule,MatFormFieldModule,MatInputModule, MatToolbarModule,MatMenuModule,MatIconModule,MatButtonModule,MatDialogModule,
    BrowserModule,
    SpeechrecorderngModule.forRoot(SPR_CFG),

  ],
  providers: [],
  bootstrap: [AppComponent]

})
export class AppModule { }


