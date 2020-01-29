import {
  Component,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  OnInit,
  AfterViewChecked,
  Renderer2,
  ChangeDetectorRef, HostBinding, AfterContentChecked
} from "@angular/core";

import {SimpleTrafficLight} from "../startstopsignal/ui/simpletrafficlight";
import {State as StartStopSignalState} from "../startstopsignal/startstopsignal";
import {Item} from "./sessionmanager";
import {Mediaitem, PromptItem} from "../script/script";
import {AudioClipUIContainer} from "../../audio/ui/container";
import {TransportActions} from "./controlpanel";
import {Action} from "../../action/action";
import {AudioDisplay} from "../../audio/audio_display";
import {ProjectService} from "../project/project.service";


@Component({

  selector: 'spr-recinstructions',

  template: `

    {{selectedItemIdx}}/{{itemCount - 1}}: {{recinstructions}}
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

    <!--<ng-template [ngIf]="text">{{text}}</ng-template>-->
    <!-- <img *ngIf="src" #promptImage [src]="srcUrl()" [height]="prompterHeight-20" /> -->
  `,
  styles: [`:host {

    justify-content: center; /* align horizontal center */
    align-items: center; /* align vertical  center */
    background: white;
    text-align: center;
    /* font-size: 2em; */
    line-height: 1.2em;
    font-weight: bold;
    /* Use only natural size of the prompt */
    /* The prompter compnent then ets aligned vertically centered */
    flex: 0 1;

  }`, `:host(.fill) {
    /* Use all space to scale images */
    flex: 3;
    width: 100%;
    height: 100%;
    max-height: 100%;
    max-width: 100%;
    /* A separate flex container might be necessayr to alighn centered */
    vertical-align: middle; /* TODO does not work, image is not vertically centered */
  }`]
})
export class Prompter {
  @Input() projectName: string | null;
  private _promptMediaItems: Array<Mediaitem>

  @Input() prompterHeight: number
  private _text: string = null;
  private _src: string = null;
  mimetype: string;
  private currPromptChild: HTMLElement = null;

  @HostBinding('class.fill') public prompterStyleFill = false;

  //@ViewChild('promptImage') promptImage:HTMLImageElement;

  constructor(private elRef: ElementRef, private renderer: Renderer2, private projectService: ProjectService) {

  }

  get text() {

    return this._text;
  }

  get src() {

    return this._src;
  }

  srcUrl(): string {
    if (this._src) {
      return this.projectService.projectResourceUrl(this.projectName, this._src);
    }
    return null;
  }

    width():number{
      if(this.elRef){
        if(this.elRef.nativeElement){
            return this.elRef.nativeElement.clientWidth
        }
      }
      return null
    }
    height():number{
        if(this.elRef){
            if(this.elRef.nativeElement){
                return this.elRef.nativeElement.clientHeight
            }
        }
    }

  @Input() set promptMediaItems(pMis: Array<Mediaitem>) {
    this._promptMediaItems = pMis
    if (this.currPromptChild != null) {
      this.renderer.removeChild(this.elRef.nativeElement, this.currPromptChild)
    }
    if (this._promptMediaItems && this._promptMediaItems.length == 1) {
      let mi = this._promptMediaItems[0]
      this.mimetype = 'text/plain'
      if (mi.mimetype) {
        this.mimetype = mi.mimetype.trim();
      }
      if (this.mimetype === 'text/plain') {
        this._text = mi.text
        this._src = null;
        this.currPromptChild = this.renderer.createText(this._text)
        this.prompterStyleFill = false
        this.renderer.appendChild(this.elRef.nativeElement, this.currPromptChild)
      } else if (this.mimetype.startsWith('image')) {
        this._text = null;
        this._src = mi.src
        let promptImage = new Image()

        this.currPromptChild = promptImage
        this.renderer.appendChild(this.elRef.nativeElement, this.currPromptChild)
        this.renderer.setStyle(this.currPromptChild, "max-width", "100%")
        this.renderer.setStyle(this.currPromptChild, "max-height", "100%")
        this.prompterStyleFill = true
        // TODO vertical alignment
        // https://stackoverflow.com/questions/7273338/how-to-vertically-align-an-image-inside-a-div

        //console.log(promptImage.naturalWidth + "x"+promptImage.naturalHeight);
        promptImage.onload = (ev: ProgressEvent) => {

        }
        promptImage.src = this.srcUrl()
      }

    } else {
      this._text = null
      this._src = null
    }
  }
}

export const VIRTUAL_HEIGHT = 600;
export const DEFAULT_PROMPT_FONTSIZE = 48;
export const MIN_FONT_SIZE=6;
export const FALLBACK_DEF_USER_AGENT_FONT_SIZE = 14;

@Component({

  selector: 'app-sprpromptcontainer',

  template: `
    <app-sprprompter #prompter [projectName]="projectName" [promptMediaItems]="mediaitems" [style.font-size]="fontSize+'px'" [style.visibility]="prDisplay" [prompterHeight]="prompterHeight"></app-sprprompter>
  `
  ,
  styles: [`:host {

    flex: 3; /* the container consumes all available space */
    padding: 10pt;
    height: 100%;
    max-height: 100%;

    justify-content: center; /* align horizontal center*/
    align-items: center; /* align vertical center */
    background: white;
    text-align: center;
    display: flex;
    flex-direction: column;
    min-height: 0px;
    /* width: 100%; */
  }
  `]
})
export class PromptContainer implements OnInit,AfterContentChecked {
  @Input() projectName: string | null;
  private _mediaitems: Array<Mediaitem>;

  prompterHeight: number = VIRTUAL_HEIGHT
  fontSize: number;
  fontSizeChange=false
  contentChecked=false;
  prDisplay='hidden';
  defaultStyle: CSSStyleDeclaration;
  defaultFontSizePx: number;

  autoFontSize=false;
  @ViewChild(Prompter, { static: true }) prompter: Prompter;

  constructor(private elRef:ElementRef){}

  ngOnInit() {

    // fallback
    this.defaultFontSizePx = FALLBACK_DEF_USER_AGENT_FONT_SIZE;
    // try to parse default user agent font size (no comment about DOM API design ;) )
    this.defaultStyle = window.getComputedStyle(this.elRef.nativeElement);
    let defFontSizeStr = this.defaultStyle.fontSize;
    if (defFontSizeStr) {
      defFontSizeStr = defFontSizeStr.trim();
      if (defFontSizeStr.endsWith('px')) {
        // parseFloat ignores non number characters at the end (again no comment ;) )
        this.defaultFontSizePx = parseFloat(defFontSizeStr);
          //console.info("Default font size: "+this.defaultFontSizePx)
        }
      }
      this.contentChecked = false;
  }

  ngAfterContentChecked(): void {
    if(this.autoFontSize) {
      if (this.fontSizeChange) {
        //console.log("ngaftercontentchecked, call fontSizeToFit ");
        // check prompter size again
        this.fontSizeToFit()
      } else {
        // font size was checked, but we need to check again after angular content check
        if (!this.contentChecked) {
          this.contentChecked = true;
          //console.log("ngaftercontentchecked, not font size changed, call ");
          this.fontSizeToFit()
        }
      }
    }
  }


  @Input() set mediaitems(mediaitems:Array<Mediaitem>){
      this._mediaitems=mediaitems
    let mimetype:string|null=null;
    if (this._mediaitems && this._mediaitems.length == 1) {
      let mi = this._mediaitems[0]
      mimetype = 'text/plain'
      if (mi.mimetype) {
        mimetype = mi.mimetype.trim();
      }
    }
    this.prompter.promptMediaItems=this._mediaitems
    this.autoFontSize=(mimetype === 'text/plain');
    if(this.autoFontSize){
        this.fontSizeChange = true;
        this.contentChecked = false
        this.prDisplay = 'hidden'
        this.layout()
      }
  }

  get mediaitems():Array<Mediaitem>{
      return this._mediaitems;
  }



  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    //console.debug("onresize, call fontSizeToFit hook ");
    this.layout();
  }

  private layout() {
    if(this.autoFontSize && this.elRef) {

      this.fontSizeChange=true;
      this.contentChecked = false
      this.prDisplay = 'hidden'
      let elH = this.elRef.nativeElement.offsetHeight;
      // prompt text font size should scale according to prompt container height
      let scaledSize = Math.round((elH / VIRTUAL_HEIGHT) * DEFAULT_PROMPT_FONTSIZE);

      // min prompt font size is default user agent size
      let newSize = Math.max(scaledSize, this.defaultFontSizePx);
      if (this.fontSize !== newSize) {
        this.fontSize = newSize;
      }

      //console.log("layout, call fontSizeToFit hook ");
      window.setTimeout(() => this.fontSizeToFit())

    }
  }


  private fontSizeToFit(){
      //this.fsmc++;
      //console.log("fontSizeToFit #"+this.fsmc);
      if(this._mediaitems && this.prompter && this.elRef) {
                let nEl = this.elRef.nativeElement
                //console.log("prompter: " + this.prompter.width() + "x" + this.prompter.height()+ " font size: "+this.fontSize)
                if(this.fontSize>=MIN_FONT_SIZE && (this.prompter.width()>nEl.offsetWidth || this.prompter.height()>nEl.offsetHeight)){
                    // prompter oversizes prompter container. Decrease font size.
                    // set invisible during font size checks
                    this.prDisplay='hidden'
                  // decrease font size
                    this.fontSize=this.fontSize-1
                   // console.log("Decreased font size: "+this.fontSize )
                  // Set flags
                    this.fontSizeChange=true
                    this.contentChecked=false
                  // hook the next check
                    window.setTimeout(()=>this.fontSizeToFit())
                }else {
                  // prompter fits in  prompter container, font size should be fine

                  //console.log("prDisplay: "+this.prDisplay)

                  //if(this.contentChecked && ! this.fontSizeChange) {
                    //console.log("Display!")
                    // set prompter visible now
                  this.prDisplay = 'visible'
                  //}
                  this.fontSizeChange = false
                }
          //console.log("Prompt text width: "+textSize.width+" "+this.elRef.nativeElement.offsetWidth+"x"+this.elRef.nativeElement.offsetHeight)
      }
  }

}



@Component({

  selector: 'app-sprpromptingcontainer',

  template: `
    <spr-recinstructions [selectedItemIdx]="selectedItemIdx" [itemCount]="itemCount"
                         [recinstructions]="showPrompt?promptItem?.recinstructions?.recinstructions:null"></spr-recinstructions>
    <app-sprpromptcontainer [projectName]="projectName"
                            [mediaitems]="showPrompt?promptItem?.mediaitems:null"></app-sprpromptcontainer>

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
  @Input() projectName: string | null;
  @Input() promptItem: PromptItem;
  @Input() showPrompt: boolean;
  @Input() selectedItemIdx: number;
  @Input() itemCount: number;

  @Input() transportActions: TransportActions;

  private e: HTMLDivElement;
  private startX: number | null = null
  private touchStartTimeStamp: number | null;

  constructor(private ref: ElementRef) {
    type TouchStart = {}
  }

  ngOnInit() {
    this.e = this.ref.nativeElement;
  }

  @HostListener('touchstart', ['$event'])
  onTouchstart(ev: TouchEvent | any) {
    //console.log("Touch start! ")
    if (!(this.transportActions.fwdAction.disabled &&
      this.transportActions.bwdAction.disabled &&
      this.transportActions.nextAction.disabled)) {
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
  onTouchEnd(ev: TouchEvent | any) {
    //console.log("Touch end!")
    // Reset offset shift
    if (!(this.transportActions.fwdAction.disabled && this.transportActions.bwdAction.disabled &&
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
            touchMoveSpeed = deltaX / (ev.timeStamp - this.touchStartTimeStamp);
          }
          let futureDeltaX = deltaX + (800 * touchMoveSpeed);
          //console.log("DeltaX: " + deltaX + " Future deltaX: " + futureDeltaX + "  width: " + this.e.offsetWidth)
          if (futureDeltaX > this.e.offsetWidth / 2) {
            //console.log("Swipe right detected!!")
            //this.swipedRight.emit()
            if (!this.transportActions.bwdAction.disabled) {
              this.transportActions.bwdAction.perform();
            }
            this.e.style.left = -this.e.offsetLeft + "px";
          }
          if (-futureDeltaX > this.e.offsetWidth / 2) {
            //console.log("Swipe left detected!!")
            this.e.style.left = -this.e.offsetLeft + "px";
            //this.swipedLeft.emit()
            if (!this.transportActions.nextAction.disabled) {
              this.transportActions.nextAction.perform();
            } else if (!this.transportActions.fwdAction.disabled) {
              this.transportActions.fwdAction.perform();
            }
          } else {
          }
        }
      }

      // reset animated
      this.e.style.transition = "left 0.8s";
    }
    this.startX = null;
    this.touchStartTimeStamp = null;
    this.e.style.left = "0px";
    ev.preventDefault();

  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(ev: TouchEvent | any) {
    //console.log("Touch move!")
    if (!(this.transportActions.fwdAction.disabled && this.transportActions.bwdAction.disabled &&
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
  onTouchCancel(ev: TouchEvent | any) {
    //console.log("Touch cancel!")
    this.e.style.left = "0px";
    ev.preventDefault();
  }

}


@Component({

  selector: 'app-sprprompting',

  template: `

    <app-simpletrafficlight [status]="startStopSignalState"></app-simpletrafficlight>
    <app-sprpromptingcontainer [projectName]="projectName" [promptItem]="promptItem" [showPrompt]="showPrompt"
                               [itemCount]="items?.length" [selectedItemIdx]="selectedItemIdx"
                               [transportActions]="transportActions"></app-sprpromptingcontainer>
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
    position: relative;
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
      position: absolute;


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
      position: absolute;
      bottom: 0px;
      /*left: 0px; */

      height: 90%;
      width: 100%;

      overflow: hidden;

      padding: 0px;
      /* margin: 20px; */
      /* border: 20px; */
      z-index: 5;
      box-sizing: border-box;
      background-color: rgba(0, 0, 0, 0)

    }`
  ]

})

export class Prompting {
  @ViewChild(SimpleTrafficLight, { static: true }) simpleTrafficLight: SimpleTrafficLight;
  @ViewChild(AudioDisplay, { static: true }) audioDisplay: AudioDisplay;
  @Input() projectName: string | null;
  @Input() startStopSignalState: StartStopSignalState;
  @Input() promptItem: PromptItem | null;
  @Input() showPrompt: boolean;
  @Input() items: Array<Item>;
  @Input() selectedItemIdx: number;
  @Input() transportActions: TransportActions;
  @Input() enableDownload: boolean;

  @Input() audioSignalCollapsed: boolean;
  @Input() displayAudioBuffer: AudioBuffer | null;
  @Input() playStartAction: Action;
  @Input() playStopAction: Action;
  @Output() onItemSelect = new EventEmitter<number>();
  @Output() onNextItem = new EventEmitter();
  @Output() onPrevItem = new EventEmitter();

  itemSelect(rowIdx: number) {
    this.onItemSelect.emit(rowIdx);
  }

  nextItem() {
    this.onNextItem.emit();
  }

  prevItem() {
    this.onPrevItem.emit();
  }
}

