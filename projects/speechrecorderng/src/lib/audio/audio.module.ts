import { NgModule } from '@angular/core';


import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";
import {LevelBar} from "./ui/livelevel";
import {CommonModule} from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import {AudioDisplayControl} from "./ui/audio_display_control";
import {ScrollPaneHorizontal} from "./ui/scroll_pane_horizontal";
import {AudioDisplayScrollPane} from "./ui/audio_display_scroll_pane";
import {AudioDisplayPlayer} from "./audio_player";

@NgModule({
    declarations: [ScrollPaneHorizontal,AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplayPlayer,AudioDisplay,AudioDisplayScrollPane,AudioDisplayControl,LevelBar],
    exports: [ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayControl,LevelBar],
    imports: [CommonModule,MatIconModule,MatButtonModule,MatDialogModule]
})
export class AudioModule{

}
