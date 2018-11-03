import {
    Component, ViewChild, Input, Output, EventEmitter, HostListener, ElementRef, OnInit
} from "@angular/core";

import {SimpleTrafficLight} from "../startstopsignal/ui/simpletrafficlight";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {Item} from "./sessionmanager";
import {Mediaitem, PromptItem} from "../script/script";
import {AudioClipUIContainer} from "../../audio/ui/container";
import {TransportActions} from "./controlpanel";
import {Action} from "../../action/action";


@Component({

  selector: 'spr-recinstructions',

  template: `

    {{selectedItemIdx}}/{{itemCount-1}}: {{recinstructions}}
  `,
  styles: [`:host {

    justify-content: left; /* align horizontal center */
    align-items: flex-start; /* align vertical  center */
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
    @Input() selectedItemIdx: number;
    @Input() itemCount: number;
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
   /* font-size: 2em; */
    line-height: 1.2em;
      font-weight: bold;
     
    flex: 0 1;
  }
  `]
})
export class Prompter {
  @Input() promptText: string
}

export const VIRTUAL_HEIGHT=600;
export const DEFAULT_PROMPT_FONTSIZE=48;
export const FALLBACK_DEF_USER_AGENT_FONT_SIZE=14;

@Component({

  selector: 'app-sprpromptcontainer',

  template: `

    <app-sprprompter [style.font-size]="fontSize+'px'" [promptText]="mediaitem?.text"></app-sprprompter>

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
export class PromptContainer implements  OnInit{
  @Input() mediaitem: Mediaitem;

  fontSize:number;
  defaultStyle: CSSStyleDeclaration;
  defaultFontSizePx: number;
  constructor(private elRef:ElementRef){}

  ngOnInit(){

    // fallback
    this.defaultFontSizePx = FALLBACK_DEF_USER_AGENT_FONT_SIZE;
      // try to parse default user agent font size (no comment about DOM API design ;) )
      this.defaultStyle=window.getComputedStyle(this.elRef.nativeElement);
      let defFontSizeStr=this.defaultStyle.fontSize;
      if(defFontSizeStr) {
        defFontSizeStr = defFontSizeStr.trim();
        if (defFontSizeStr.endsWith('px')) {
          // parseFloat ignores non number characters at the end (again no comment ;) )
          this.defaultFontSizePx = parseFloat(defFontSizeStr);
        }
      }
      this.resized();
  }

  @HostListener('window:resize', ['$event'])
    onResize(event:Event):void {
        this.resized();
  }

  private resized(){
      let elH=this.elRef.nativeElement.offsetHeight;

      // prompt text font size should scale according to prompt conatiner height
      let scaledSize=Math.round((elH/VIRTUAL_HEIGHT)*DEFAULT_PROMPT_FONTSIZE);

      // min prompt font size is default user agent size
      this.fontSize=Math.max(scaledSize,this.defaultFontSizePx);

     //console.log("Def font size: "+this.defaultFontSizePx+"px, prompt font size: "+this.fontSize+"px")
  }

}



@Component({

  selector: 'app-sprpromptingcontainer',

  template: `
    <spr-recinstructions [selectedItemIdx]="selectedItemIdx" [itemCount]="itemCount" [recinstructions]="showPrompt?promptItem?.recinstructions?.recinstructions:null"></spr-recinstructions>
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
    @Input() selectedItemIdx: number;
    @Input() itemCount: number;

    @Input() transportActions: TransportActions;

  private e:HTMLDivElement;
  private startX:number | null=null
    private  touchStartTimeStamp:number |null;

    constructor(private ref: ElementRef) {
        type TouchStart ={

        }
    }
    ngOnInit(){
        this.e = this.ref.nativeElement;
    }
    @HostListener('touchstart', ['$event'])
    onTouchstart(ev:TouchEvent){
        //console.log("Touch start! ")
        if(!(this.transportActions.fwdAction.disabled &&
                this.transportActions.bwdAction.disabled &&
                this.transportActions.nextAction.disabled)){
            let targetTouchesLen = ev.targetTouches.length;
            //for(let ti=0;ti<ev.targetTouches.length;ti++){
            //let t=ev.targetTouches.item(ti);
            // All x values are the same ??
            //console.log("Touch #"+ti+": pageX: "+t.pageX+" clientX: "+t.clientX+" screenX: "+t.screenX)
            //}
            if (targetTouchesLen == 1) {
                // single touch
                let t = ev.targetTouches.item(0);
                if (t) {
                    this.startX = Math.round(t.screenX);
                    this.touchStartTimeStamp = ev.timeStamp;
                    this.e.style.transition = 'none';
                    //console.log("Touch start x: "+this.startX)
                }
            }

            ev.preventDefault();
        }
    }
    @HostListener('touchend', ['$event'])
    onTouchEnd(ev:TouchEvent){
        //console.log("Touch end!")
        // Reset offset shift
        if(!(this.transportActions.fwdAction.disabled && this.transportActions.bwdAction.disabled &&
                this.transportActions.nextAction.disabled)) {

            let changedTouchesLen = ev.changedTouches.length;
            //console.log(changedTouchesLen+" "+this.startX)
            if (changedTouchesLen == 1 && this.startX) {
                // single touch
                let t = ev.changedTouches.item(0);
                if (t) {
                    let deltaX = Math.round(t.clientX - this.startX);
                    let touchMoveSpeed = 0;
                    if (this.touchStartTimeStamp) {
                        deltaX / (ev.timeStamp - this.touchStartTimeStamp);
                    }
                    let futureDeltaX = deltaX + (800 * touchMoveSpeed);
                    //console.log("DeltaX: " + deltaX + " Future deltaX: " + futureDeltaX + "  width: " + this.e.offsetWidth)
                    if (futureDeltaX > this.e.offsetWidth / 2) {
                        //console.log("Swipe right detected!!")
                        //this.swipedRight.emit()
                        if(!this.transportActions.bwdAction.disabled){
                            this.transportActions.bwdAction.perform();
                        }
                        this.e.style.left = -this.e.offsetLeft + "px";
                    }
                    if (-futureDeltaX > this.e.offsetWidth / 2) {
                        //console.log("Swipe left detected!!")
                        this.e.style.left = -this.e.offsetLeft + "px";
                        //this.swipedLeft.emit()
                        if(!this.transportActions.nextAction.disabled){
                            this.transportActions.nextAction.perform();
                        }else if(!this.transportActions.fwdAction.disabled) {
                            this.transportActions.fwdAction.perform();
                        }
                    } else {
                    }
                }
            }

            // reset animated
            this.e.style.transition = "left 0.8s";
        }
        this.startX=null;
        this.touchStartTimeStamp=null;
            this.e.style.left = "0px";
            ev.preventDefault();

    }
    @HostListener('touchmove', ['$event'])
    onTouchMove(ev:TouchEvent){
        //console.log("Touch move!")
        if(!(this.transportActions.fwdAction.disabled && this.transportActions.bwdAction.disabled &&
                this.transportActions.nextAction.disabled)) {
            let targetTouchesLen = ev.targetTouches.length;
            if (targetTouchesLen == 1 && this.startX) {
                // single touch
                let t = ev.targetTouches.item(0);
                if (t) {
                    let deltaX = Math.round(t.screenX - this.startX);
                    this.e.style.left = deltaX + "px";
                    // console.log("Touch move delta x: "+deltaX)
                }
            }
            ev.preventDefault();
        }
    }
    @HostListener('touchcancel', ['$event'])
    onTouchCancel(ev:TouchEvent){
        //console.log("Touch cancel!")
        this.e.style.left="0px";
        ev.preventDefault();
    }

}


@Component({

  selector: 'app-sprprompting',

  template: `

    <app-simpletrafficlight [status]="startStopSignalState"></app-simpletrafficlight>
    <app-sprpromptingcontainer [promptItem]="promptItem" [showPrompt]="showPrompt" [itemCount]="items?.length" [selectedItemIdx]="selectedItemIdx" [transportActions]="transportActions"></app-sprpromptingcontainer>
    <app-sprprogress fxHide.xs [items]="items" [selectedItemIdx]="selectedItemIdx"
                     (onRowSelect)="itemSelect($event)"></app-sprprogress>
    <div #asCt [class.active]="!audioSignalCollapsed">
       
            <app-audiodisplay #audioSignalContainer [class.active]="!audioSignalCollapsed"
                       [audioData]="displayAudioBuffer"
                              [playStartAction]="playStartAction"
                              [playStopAction]="playStopAction"></app-audiodisplay>
      
        
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
        
        padding: 0px; 
        /* margin: 20px; */
        /* border: 20px; */
        z-index: 5;
        box-sizing: border-box;
       background-color: rgba(0,0,0,0)
        
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
    @Input() transportActions: TransportActions;
  @Input() enableDownload: boolean;

  @Input() audioSignalCollapsed:boolean;
  @Input() displayAudioBuffer:AudioBuffer | null;
    @Input() playStartAction: Action;
    @Input() playStopAction: Action;
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

