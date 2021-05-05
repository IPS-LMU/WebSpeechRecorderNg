import {Component, ViewChild} from "@angular/core";

@Component({

    selector: 'video-player',

    template: `
            <div></div>
            <video></video>
  `,
    styles: [`:host {
        margin: 0;
        padding: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        position: relative; /* TODO container div position must not be 'static' (default) to act as reference for the canvases */
        box-sizing: border-box;
        transform: none;
  }`, ` video {
        position: absolute;
        margin: 0;
        padding: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }`]
})
export class VideoPlayer {
    //@ViewChild(HTMLVideoElement) videoEl:HTMLVideoElement;
    // Ends up with compiler error!!!!: Error: Maximum call stack size exceeded

    // Not in use yet.

    // TODO Delegate native methods
}
