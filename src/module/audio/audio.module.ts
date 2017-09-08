import { NgModule } from '@angular/core';

import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";

@NgModule({
    declarations: [AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplay],
    exports: [AudioClipUIContainer,AudioDisplay]
})
export class AudioModule{

}
