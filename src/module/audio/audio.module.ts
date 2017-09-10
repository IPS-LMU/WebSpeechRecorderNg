import { NgModule } from '@angular/core';

import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";
import {LiveLevelDisplay} from "./ui/livelevel";
import {CommonModule} from "@angular/common";

@NgModule({
    declarations: [AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplay,LiveLevelDisplay],
    exports: [AudioClipUIContainer,AudioDisplay,LiveLevelDisplay],
    imports: [CommonModule]
})
export class AudioModule{

}
