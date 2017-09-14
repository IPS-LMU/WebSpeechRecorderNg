import { NgModule } from '@angular/core';


import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";
import {LevelBar} from "./ui/livelevel";
import {LevelBarDisplay} from "./ui/livelevel_display";
import {CommonModule} from "@angular/common";
import {MdButtonModule, MdDialogModule, MdIconModule} from "@angular/material";
import {SequenceAudioFloat32ChunkerOutStream} from "./io/stream";

@NgModule({
    declarations: [AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplay,LevelBar,LevelBarDisplay],
    exports: [AudioClipUIContainer,AudioDisplay,LevelBarDisplay],
    imports: [CommonModule,MdIconModule,MdButtonModule,MdDialogModule]
})
export class AudioModule{

}
