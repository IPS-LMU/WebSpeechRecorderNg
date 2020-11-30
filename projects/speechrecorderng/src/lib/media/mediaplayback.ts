import {Action} from "../action/action";

export interface MediaPlaybackControls{
    readonly startAction:Action<void>;
    readonly stopAction:Action<void>;
    //isPlaying():boolean;
    readonly currentTime:number;
}
