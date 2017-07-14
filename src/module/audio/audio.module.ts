import { NgModule } from '@angular/core';

import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";

@NgModule({
    declarations: [AudioClipUIContainer,AudioDisplay],
    exports: [AudioClipUIContainer,AudioDisplay]
})
export class AudioModule{

}
