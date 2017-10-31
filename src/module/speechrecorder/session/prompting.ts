import {
    Component, ViewChild, Input, Output, EventEmitter, HostListener, ElementRef
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

    <app-sprprompter  [promptText]="mediaitem?.text"></app-sprprompter>

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
    position: relative;
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
  @Output() swipedLeft=new EventEmitter();
  @Output() swipedRight=new EventEmitter();
  private e:HTMLDivElement;
  private startX:number | null=null
    constructor(private ref: ElementRef) {

    }

    ngOnInit(){
        this.e = this.ref.nativeElement;
    }
    @HostListener('touchstart', ['$event'])
    onTouchstart(ev:TouchEvent){
        console.log("Touch start! ")
        let targetTouchesLen=ev.targetTouches.length;
        //for(let ti=0;ti<ev.targetTouches.length;ti++){
          //let t=ev.targetTouches.item(ti);
          // All x values are the same ??
          //console.log("Touch #"+ti+": pageX: "+t.pageX+" clientX: "+t.clientX+" screenX: "+t.screenX)
        //}
        if(targetTouchesLen==1){
          // single touch
            let t=ev.targetTouches.item(0);
            if(t) {
                this.startX =Math.round(t.screenX);
                this.e.style.transition='none';
                console.log("Touch start x: "+this.startX)
            }
        }

       ev.preventDefault();
        //ev.stopPropagation()
        //ev.stopImmediatePropagation()
    }
    @HostListener('touchend', ['$event'])
    onTouchEnd(ev:TouchEvent){
        console.log("Touch end!")
        // Reset offset shift

        let changedTouchesLen=ev.changedTouches.length;
        //console.log(changedTouchesLen+" "+this.startX)
        if(changedTouchesLen==1 && this.startX){
            // single touch
            let t=ev.changedTouches.item(0);
            if(t) {
                let deltaX = Math.round(t.clientX - this.startX);
                console.log("DeltaX: " + deltaX + "  width: " + this.e.offsetWidth)
                if (deltaX > this.e.offsetWidth / 3) {
                    //console.log("Swipe right detected!!")
                    this.swipedRight.emit()
                    this.e.style.left=-this.e.offsetLeft+"px";
                }
                if (-deltaX > this.e.offsetWidth / 3) {
                    //console.log("Swipe left detected!!")
                    this.e.style.left=-this.e.offsetLeft+"px";
                    this.swipedLeft.emit()
                } else {
                }
            }
        }
        this.e.style.transition="left 0.6s";

        this.e.style.left="0px";
        //ev.preventDefault();
    }
    @HostListener('touchmove', ['$event'])
    onTouchMove(ev:TouchEvent){
        console.log("Touch move!")
        let targetTouchesLen=ev.targetTouches.length;
        if(targetTouchesLen==1 && this.startX){
            // single touch
            let t=ev.targetTouches.item(0);
            if(t) {
                let deltaX = Math.round(t.screenX - this.startX);
                window.setTimeout(()=> {
                    this.e.style.left = deltaX + "px";
                });
                console.log("Touch move delta x: "+deltaX)
            }
        }
        ev.preventDefault();

    }
    @HostListener('touchcancel', ['$event'])
    onTouchCancel(ev:TouchEvent){
        console.log("Touch cancel!")
        this.e.style.left="0px";
        //ev.preventDefault();
    }

}


@Component({

  selector: 'app-sprprompting',

  template: `

    <app-simpletrafficlight [status]="startStopSignalState"></app-simpletrafficlight>
    <app-sprpromptingcontainer [promptItem]="promptItem" [showPrompt]="showPrompt" (swipedLeft)="nextItem()" (swipedRight)="prevItem()"></app-sprpromptingcontainer>
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
        z-index: 3;
    }
  `, `
      app-sprprogress {
          z-index: 3;
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
    @Output() onNextItem = new EventEmitter();
    @Output() onPrevItem = new EventEmitter();

  itemSelect(rowIdx: number) {
    this.onItemSelect.emit(rowIdx);
  }

  nextItem(){
    this.onNextItem.emit();
  }
    prevItem(){
       this.onPrevItem.emit();
    }
}

