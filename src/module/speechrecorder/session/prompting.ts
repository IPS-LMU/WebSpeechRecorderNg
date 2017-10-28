import {
  Component, ViewChild, Input, Output, EventEmitter
} from "@angular/core";

import {SimpleTrafficLight} from "../startstopsignal/ui/simpletrafficlight";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {Item} from "./sessionmanager";
import {Mediaitem, PromptItem} from "../script/script";
import {AudioClipUIContainer} from "../../audio/ui/container";

@Component({

  selector: 'spr-recinstructions',

  template: `

    {{recinstructions}}
  `,
  styles: [`:host {

    justify-content: left; /* align horizontal center */
    align-items: left; /* align vertical  center */
    background: white;
    text-align: left;
    font-size: 1em;
    flex: 0;
    width: 100%;
  }
  `]
})
export class Recinstructions {
  @Input() recinstructions: string
}

@Component({

  selector: 'app-sprprompter',

  template: `

    {{promptText}}
  `,
  styles: [`:host {

    justify-content: center; /* align horizontal center */
    align-items: center; /* align vertical  center */
    background: white;
    text-align: center;
    font-size: 2em;
    line-height: 1.2em;
    flex: 0 1;
  }
  `]
})
export class Prompter {
  @Input() promptText: string
}

@Component({

  selector: 'app-sprpromptcontainer',

  template: `

    <app-sprprompter [promptText]="mediaitem?.text"></app-sprprompter>

  `
  ,
  styles: [`:host {

    flex: 3; /* the container consumes all available space */
    padding: 10pt;
    /* height: 100%; */
    justify-content: center; /* align horizontal center*/
    align-items: center; /* align vertical center */
    background: white;
    text-align: center;
    display: flex;
    flex-direction: column;
    min-height: 0px;
  }
  `]
})
export class PromptContainer {
  @Input() mediaitem: Mediaitem;
}


@Component({

  selector: 'app-sprpromptingcontainer',

  template: `
    <spr-recinstructions [recinstructions]="showPrompt?promptItem?.recinstructions?.recinstructions:null"></spr-recinstructions>
    <app-sprpromptcontainer [mediaitem]="showPrompt?promptItem?.mediaitems[0]:null"></app-sprpromptcontainer>

  `
  ,
  styles: [`:host {

    flex: 3; /* the container consumes all available space */
    padding: 10pt;
    justify-content: center; /* align horizontal center*/
    align-items: center; /* align vertical center */
    background: white;
    text-align: center;
    display: flex;
    flex-direction: column;
    min-height: 0px;
  }
  `]
})
export class PromptingContainer {
  @Input() promptItem: PromptItem;
  @Input() showPrompt: boolean;
}


@Component({

  selector: 'app-sprprompting',

  template: `

    <app-simpletrafficlight [status]="startStopSignalState"></app-simpletrafficlight>
    <app-sprpromptingcontainer [promptItem]="promptItem" [showPrompt]="showPrompt"></app-sprpromptingcontainer>
    <app-sprprogress fxHide.xs [items]="items" [selectedItemIdx]="selectedItemIdx"
                     (onRowSelect)="itemSelect($event)"></app-sprprogress>
    <div #asCt [class.active]="!audioSignalCollapsed">
       
            <app-audio #audioSignalContainer [class.active]="!audioSignalCollapsed"
                       [audioData]="displayAudioBuffer"></app-audio>
        
    </div>



  `,
  styles: [`:host {
    position:relative;
    margin: 0;
    padding: 0;
    background: lightgrey;
    width: 100%; /* use all horizontal available space */
    flex: 1; /* ... and fill rest of vertical available space (other components have flex 0) */

    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    min-height: 0px;

    display: flex; /* flex container: left traffic light, right prompter (container) */
    flex-direction: row;
    flex-wrap: nowrap; /* wrap could completely destroy the layout */
  }`, `
    app-simpletrafficlight {
      margin: 10px;
      min-height: 0px;
    }
  `, `
    div {
        display: none;
        position:absolute;
      

       /* height: 50%; */
        /* width: 100%; */

        /* overflow: hidden; */

       /* margin: 20px; */
        /* border: 20px; */
        z-index: 5;
        /*background-color: red; */
    }`, `
    div.active {
        display: flex;
        position:absolute;
        bottom: 0px;
        /*left: 0px; */

        height: 80%;
        width: 100%;

        overflow: hidden;
        
        padding: 20px; 
        /* margin: 20px; */
        /* border: 20px; */
        z-index: 5;
        box-sizing: border-box;
       background-color: rgba(0,0,0,0.75)
        
    }`
  ]

})

export class Prompting {
  @ViewChild(SimpleTrafficLight) simpleTrafficLight: SimpleTrafficLight;
  @ViewChild(AudioClipUIContainer) audioClipUIContainer: AudioClipUIContainer;
  @Input() startStopSignalState: StartStopSignalState;
  @Input() promptItem: PromptItem | null;
  @Input() showPrompt: boolean;
  @Input() items: Array<Item>;
  @Input() selectedItemIdx: number;
  @Input() enableDownload: boolean;

  @Input() audioSignalCollapsed:boolean;
  @Input() displayAudioBuffer:AudioBuffer | null;
  @Output() onItemSelect = new EventEmitter<number>();


  itemSelect(rowIdx: number) {
    this.onItemSelect.emit(rowIdx);
  }
}

