import {Action} from "../action/action";

export interface MediaPlaybackControls{
    readonly startAction:Action<void>;
    readonly startSelectionAction:Action<void>;
    readonly stopAction:Action<void>;
    autoPlayOnSelectToggleAction: Action<boolean>;
    //isPlaying():boolean;
    readonly currentTime:number;
}
