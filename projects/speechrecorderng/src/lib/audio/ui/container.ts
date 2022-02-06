import {
  ElementRef, AfterViewInit, HostListener, Input, OnInit, Output, EventEmitter
} from '@angular/core'
import {AudioSignal} from './audiosignal'
import {Sonagram} from './sonagram'
import {Marker, Point} from './common'

import {Component, ViewChild} from '@angular/core';
import {Position,Dimension, Rectangle} from "../../math/2d/geometry";
import {AudioClip,Selection} from "../persistor";
import {BasicAudioCanvasLayerComponent} from "./audio_canvas_layer_comp";
import {Element} from "@angular/compiler";

/*
  ResizeObserver not yet available in official Typescript declaration
  Crreated declaration from IDL until its available.
  See specs:
  https://www.w3.org/TR/resize-observer

 */

interface ResizeObserverSize {
  readonly inlineSize:number;
  readonly blockSize:number;
};

declare interface ResizeObserverEntry{
  readonly target: Element;
  readonly contentRect: DOMRectReadOnly ;
  readonly borderBoxSize: Array<ResizeObserverSize> ;
  readonly contentBoxSize: Array<ResizeObserverSize> ;
  readonly devicePixelContentBoxSize: Array<ResizeObserverSize> ;
}

declare interface ResizeObserverCallback {
  (entries: Array<ResizeObserverEntry>, observer: ResizeObserver):void;
}

declare enum ResizeObserverBoxOptions {
  "border-box", "content-box", "device-pixel-content-box"
};

// // Declare Resizeobserver
// declare class ResizeObserver{
//   constructor(callback: ResizeObserverCallback);
//   observe: (el:Element,opts: ResizeObserverBoxOptions | null)=>void;
//   unobserve: (el:Element)=>void;
//   disconnect: ()=>void;
// }

/*
 * Container component for audio display.
 * The display elements are children of a virtual canvas. The virtual canvas makes it possible to have high zoom factors with very wide virtual audio displays.
 * Only the visible part of the virtual canvas is implemented as a browser canvas and therefore consuming memory.
 * The visible part has the same width as the viewport of the scroll pane parent.
 * The virtual canvas itself is implemented as a HTML div element.
 * The layout of the component is updated on resize of the parent or changes of the zoom factor.
 */
@Component({

  selector: 'app-audio',
  template: `
    <div #virtualCanvas>
    <canvas #divider (mousedown)="mousedown($event)" (mouseover)="mouseover($event)"
            (mouseleave)="mouseleave($event)" height="10"></canvas>
    <audio-signal [pointerPosition]="pointer" [selecting]="selecting" [selection]="selection" (pointerPositionEventEmitter)="pointerPositionChanged($event)" (selectingEventEmitter)="selectingChanged($event)" (selectedEventEmitter)="selectionChanged($event)"></audio-signal>
    <audio-sonagram [pointerPosition]="pointer" [selecting]="selecting" [selection]="selection" (pointerPositionEventEmitter)="pointerPositionChanged($event)" (selectingEventEmitter)="selectingChanged($event)" (selectedEventEmitter)="selectionChanged($event)"></audio-sonagram>
    </div>
  `,
  styles: [`div {

    margin: 0;
    padding: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    position: relative; /* TODO container div position must not be 'static' (default) to act as reference for the canvases */
    box-sizing: border-box;
    transform: none;
    overflow: hidden; /* Prevents Error in WebKit: ResizeObserver loop completed with undelivered notifications. */
  }`, `canvas{
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    cursor: ns-resize;
    position: absolute;
    zIndex: 1;
    transform: none;
    /*overflow: hidden;*/
  }`, `audio-signal {
    top: 0;
    left: 0;
    position: absolute;
    zIndex: 1;
    transform: none;

  }`, `audio-sonagram {
    top: 0;
    left: 0;
    position: absolute;
    zIndex: 1;
    transform: none;
  }`]

})
export class AudioClipUIContainer extends BasicAudioCanvasLayerComponent implements OnInit,AfterViewInit{

  private static DIVIDER_PIXEL_SIZE = 10;

  parentE: HTMLElement;

  // Divider canvas
  @ViewChild('divider', { static: true }) canvasRef!: ElementRef;
  dc!: HTMLCanvasElement;

  // Virtual container
  @ViewChild('virtualCanvas', { static: true }) ceRef!: ElementRef;
  ce!: HTMLDivElement;

  @ViewChild(AudioSignal, { static: true }) as!: AudioSignal;
  @ViewChild(Sonagram, { static: true }) so!: Sonagram;

  private _audioClip:AudioClip | null=null;
  pointer: Marker|null=null;
  selecting: Selection|null=null;
  selection: Selection|null=null;
  @Output() selectionEventEmitter = new EventEmitter<Selection>();
  private _playFramePosition: number|null=null;
  private dragStartMouseY: number | null = null;
  private dragStartY: number | null = null;
  private dividerPosition = 0.5;

  userAction=false;

  private _xZoom: number | null = null; // pixels per second

  get xZoom(): number | null {
    return this._xZoom;
  }

  set xZoom(value: number | null) {
    this.userAction=true;
    this._xZoom = value;
    this.layout()
    this.userAction=false;
  }

  // if true the complete audio file is shown, the display fits to the visible panel, the x-zoom factor is variable, this is the default
  private _fixFitToPanel = true;

  set fixFitToPanel(value: boolean) {
    this._fixFitToPanel = value;
    if (value) {
      // we don't need  clip bounds
      this.bounds=null;
      this._xZoom = null;
    } else {
      // hold current zoom value
      //this._xZoom=this.ce.offsetWidth/this._audioData.duration;
    }
    this.layout()
  }

  constructor(private ref: ElementRef) {
    super()
    this.parentE = this.ref.nativeElement;
  }

  ngOnInit() {
    this.ce = this.ceRef.nativeElement;
    this.dc = this.canvasRef.nativeElement;
  }

  ngAfterViewInit() {
    this.layout();
    let heightListener = new MutationObserver((mrs: Array<MutationRecord>, mo: MutationObserver) => {

      let layout=false;
      mrs.forEach((mr: MutationRecord) => {
        if (!this.userAction && 'attributes' === mr.type && ('class' === mr.attributeName || 'style' === mr.attributeName)) {
          layout=true;
        }
      });
      if(layout){
        // re-layout required
        this.layout(false);
      }
    });

    heightListener.observe(this.ce, {attributes: true, childList: true, characterData: true});
    heightListener.observe(this.dc, {attributes: true, childList: true, characterData: true});

    let resizeObserver = new ResizeObserver((entries,obs) => {
      //console.log("Resize observed:");
      entries.forEach((e)=>{
        //console.log(e.contentRect.width+"x"+e.contentRect.height);
        this.layout();
      })
    });

    resizeObserver.observe(this.ce);

  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.layout();
  }

  mouseover(me: MouseEvent) {
    this.dividerCursorPosition(me, true);
  }

  mouseleave(me: MouseEvent) {
    this.dividerCursorPosition(me, false);
  }

  mousedown(me: MouseEvent) {
    this.dragStartMouseY = me.clientY;
    this.dragStartY = this.dc.offsetTop;
    this.dragStartMouseY = me.clientY;
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseup(me: MouseEvent) {
    if (this.dragStartY != null) {
      this.userAction=true;
      this.dividerDrag(me);
      this.layout(false);
      this.dragStartY = null;
      this.userAction=false;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMousemove(me: MouseEvent) {
    if (this.dragStartY != null) {
      this.userAction=true;
      this.dividerDrag(me);
      this.layoutScaled();
      this.userAction=true;
    }
  }

  pointerPositionChanged(pp:Marker){
    this.pointer=pp
  }

  selectingChanged(s:Selection| null){
    this.selecting=s
  }

  selectionChanged(s:Selection){
    this.selection=s
    if(this._audioClip){
      this._audioClip.selection=s
    }
    this.selectionEventEmitter.emit(this.selection)
  }

  private canvasMousePos(c: HTMLCanvasElement, e: MouseEvent): Point {
    const cr = c.getBoundingClientRect();
    const x = e.x - cr.left;
    const y = e.y - cr.top;
    return new Point(x,y);
  }

  dividerCursorPosition(e: MouseEvent, show: boolean) {
    if (this.dc) {

      const w = this.dc.width;
      const h = this.dc.height;
      const g = this.dc.getContext('2d');

      const pp = this.canvasMousePos(this.dc, e);
      const offX = e.offsetX - this.dc.offsetLeft;
      const offY = e.offsetY - this.dc.offsetTop;

    }
  }

  dividerDrag(e: MouseEvent) {
    if (this.dc && this.dragStartMouseY && this.dragStartY) {

      const dragOffset = e.clientY - this.dragStartMouseY;
      const ceHeight = this.ce.offsetHeight;

      let newTop = (this.dragStartY + dragOffset);
      if (newTop < 0) {
        newTop = 0;
      }
      if (newTop > ceHeight - AudioClipUIContainer.DIVIDER_PIXEL_SIZE) {
        newTop = ceHeight - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
      }
      this.dc.style.top = newTop.toString() + 'px';
      this.dividerPosition = (this.dc.offsetTop + AudioClipUIContainer.DIVIDER_PIXEL_SIZE / 2) / ceHeight;
      if (this.dividerPosition > 1.0) {
        this.dividerPosition = 1.0;
      }
      if (this.dividerPosition < 0.0) {
        this.dividerPosition = 0.0;
      }
      this.drawDivider();
    }
  }


  drawDivider() {
    const w = this.dc.width;
    const h = this.dc.height;
    const g = this.dc.getContext('2d');
    if (g && w>10 && h>=1) {
      g.fillStyle = 'white';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'black';
      g.fillRect(5, 5, w - 10, 1);
    }
  }

  clipBounds(clipBounds: Rectangle) {
    this.bounds = clipBounds;
    this.layout();
  }

  currentXZoom(): number | null {
    let xz = this._xZoom;
    if (xz==null && this._audioData) {
      let ow = this.ce.offsetWidth;
      if (ow < 1) {
        // at least one pixel width to avoid x-zoom zero values
        ow = 1;
      }
      xz = ow / this._audioData.duration;
    }
    return xz;
  }

  private _layout(clear: boolean, redraw: boolean) {
    let ceBcr = this.ce.getBoundingClientRect();

    const ceBcrIntW = Math.floor(ceBcr.width);
    const ceBcrIntH = Math.floor(ceBcr.height);

    // height available for plugins (audiosignal and sonagram)
    let psH = ceBcrIntH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    if (psH < 0) {
      psH = 0;
    }
    // audio signal height
    const asH = Math.round(psH * this.dividerPosition);

    // sonagram height (rest: available height minus divider height minus audiosignal height)
    let soH = ceBcrIntH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE - asH;
    if (soH < 0) {
      soH = 0;
    }

    // sonagram top position
    const soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

    // Visible bounds
    // left position
    let vbLeft = 0;
    // width
    let vbWidth = ceBcrIntW;
    if (!this._fixFitToPanel && this.bounds) {
      vbLeft = Math.round(this.bounds.position.left);
      vbWidth = Math.round(this.bounds.dimension.width);
    }

    // Divider
    // left position
    let vbLeftStyl = vbLeft + 'px';
    if (this.dc.style.left != vbLeftStyl) {
      this.dc.style.left = vbLeftStyl;
      console.log("set style left: " + vbLeft);
    }
    // top position
    const dTop = asH;
    const dTopStr = dTop + 'px';
    if (this.dc.style.top != dTopStr) {
      this.dc.style.top = dTopStr;
      console.log("set style top: " + dTopStr);
    }
    // width
    let vbWidthStyle = vbWidth + 'px';
    if (this.dc.style.width != vbWidthStyle) {
      this.dc.style.width = vbWidthStyle;
    }
    if (this.dc.width != vbWidth) {
      this.dc.width = vbWidth;
      console.log("set width: " + vbWidth);
    }
    // height
    if(this.dc.height!=AudioClipUIContainer.DIVIDER_PIXEL_SIZE) {
      this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

    }
    let divPixelSizeStyle=AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
    if(this.dc.style.height!=divPixelSizeStyle) {
      this.dc.style.height = divPixelSizeStyle;
      console.log("set div style height: " + divPixelSizeStyle);
    }

    this.drawDivider();


    // Virtual dimension, only width is used
    let virtualDim = new Dimension(ceBcrIntW, 0)

    // Visible bounds of container
    let br = new Rectangle(new Position(vbLeft, 0), new Dimension(vbWidth, ceBcrIntH));

    // Set container bounds
    this.layoutBounds(br, virtualDim, false);

    // Visible bounds of audiosignal
    let asR = new Rectangle(new Position(vbLeft, 0), new Dimension(vbWidth, asH));

    // Set audiosignal bounds
    this.as.layoutBounds(asR, virtualDim, redraw, clear);

    // Visible bounds of sonagram
    let soR = new Rectangle(new Position(vbLeft, soTop), new Dimension(vbWidth, soH));

    // Set sonagram bounds
    this.so.layoutBounds(soR, virtualDim, redraw, clear);
  }

  layoutScaled() {
    this._layout(false, false);
  }

  layout(clear=true) {

    if(this.ce && this.dc) {
      const clientW=this.ce.clientWidth;
      if(this._audioData){
        if(this._fixFitToPanel) {
          // Set the virtual canvas width to the visible width
          if(this.ce.style.width!='100%') {
            console.log("set width to 100%");
            this.ce.style.width = '100%';
          }
        }else{
          if (this._xZoom) {
            // Set the virtual canvas width according to the value of the user selected xZoom value
            const newClW = Math.round( this._xZoom*this._audioData.duration );
            this.ce.style.width = newClW + 'px';
          } else {
            // Set the virtual canvas width to the visible width only
            this.ce.style.width = clientW + 'px';
          }
        }
      }
      this._layout(clear,true);
    }
  }

  @Input()
  set audioData(audioData: AudioBuffer | null) {
    this._audioClip=null
    this._audioData=audioData;
    this.as.setData(audioData);
    this.so.setData(audioData);
    this.layout();
  }

  get audioData():AudioBuffer|null{
    return this._audioData
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {
    this._audioClip=audioClip
      let audioData:AudioBuffer|null=null;
    let sel:Selection|null=null;
      if(audioClip) {
        audioData = audioClip.buffer;
        if (this._audioClip) {
          this._audioClip.addSelectionObserver((clip) => {
            this.selection = clip.selection
          });
        }
        sel=audioClip.selection;
      }
      this._audioData = audioData;
      this.as.setData(this._audioData);
      this.so.setData(this._audioData);
      this.selecting=null
      this.selection=sel
    this.layout();
  }

  get playFramePosition(): number |null {
    return this._playFramePosition;
  }

  set playFramePosition(playFramePosition: number|null) {
    this._playFramePosition = playFramePosition;
    this.as.playFramePosition = playFramePosition;
    this.so.playFramePosition = playFramePosition;
  }
}

