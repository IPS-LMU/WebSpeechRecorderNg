import { NgModule } from '@angular/core';


import {AudioClipUIContainer} from "./ui/container";
import {AudioDisplay} from "./audio_display";
import {AudioSignal} from "./ui/audiosignal";
import {Sonagram} from "./ui/sonagram";
import {LevelBar} from "./ui/livelevel";
import {CommonModule} from "@angular/common";
import {MatButtonModule,MatDialogModule, MatIconModule} from "@angular/material";
import {AudioDisplayControl} from "./ui/audio_display_control";
import {ScrollPaneHorizontal} from "./ui/scroll_pane_horizontal";
import {AudioDisplayScrollPane} from "./ui/audio_display_scroll_pane";
import {AudioDisplayPlayer} from "./audio_player";
import {DeviceChooser} from "./ui/devices";
import {MatSelectModule} from "@angular/material/select";

@NgModule({
    declarations: [ScrollPaneHorizontal,AudioClipUIContainer,AudioSignal,Sonagram,AudioDisplayPlayer,AudioDisplay,AudioDisplayScrollPane,AudioDisplayControl,LevelBar,DeviceChooser],
    exports: [ScrollPaneHorizontal,AudioClipUIContainer,AudioDisplayScrollPane,AudioDisplay,AudioDisplayControl,LevelBar,DeviceChooser],
    imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule, MatSelectModule]
})
export class AudioModule{

}
