import { NgModule } from '@angular/core';

import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";

@NgModule({
    declarations: [AudioClipUIContainer,AudioSignal,AudioDisplay],
    exports: [AudioClipUIContainer,AudioDisplay]
})
export class AudioModule{

}
