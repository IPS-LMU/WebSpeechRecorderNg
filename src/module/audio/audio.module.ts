import { NgModule } from '@angular/core';


import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";
import {LevelBar} from "./ui/livelevel";
import {CommonModule} from "@angular/common";
import {MatButtonModule,MatDialogModule, MatIconModule} from "@angular/material";
import {AudioDisplayControl} from "./ui/audio_display_control";
import {BaseCanvas, VirtualCanvas} from "./ui/virtual_canvas";

@NgModule({
    declarations: [AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplay,AudioDisplayControl,LevelBar,VirtualCanvas,BaseCanvas],
    exports: [AudioClipUIContainer,AudioDisplay,AudioDisplayControl,LevelBar,VirtualCanvas,BaseCanvas],
    imports: [CommonModule,MatIconModule,MatButtonModule,MatDialogModule]
})
export class AudioModule{

}
