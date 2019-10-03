import {
    ElementRef, AfterViewInit, HostListener, Input, OnInit
} from '@angular/core'
import {AudioSignal} from './audiosignal'
import {Sonagram} from './sonagram'
import {Marker, Point} from './common'

import {Component, ViewChild} from '@angular/core';
import {Position,Dimension, Rectangle} from "../../math/2d/geometry";
import {AudioClip,Selection} from "../persistor";

@Component({

  selector: 'app-audio',
  template: `
    <div #virtualCanvas>
    <canvas #container (mousedown)="mousedown($event)" (mouseover)="mouseover($event)"
            (mouseleave)="mouseleave($event)"></canvas>
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
  }`, `canvas{
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    cursor: ns-resize;
    position: absolute;
    zIndex: 1;
  }`, `audio-signal {
    top: 0;
    left: 0;
    position: absolute;
    zIndex: 1;
  }`, `audio-sonagram {
    top: 0;
    left: 0;
    position: absolute;
    zIndex: 1;
  }`]

})
export class AudioClipUIContainer implements OnInit,AfterViewInit {

  private static DIVIDER_PIXEL_SIZE = 10;

  parentE: HTMLElement;

  @ViewChild('container') canvasRef: ElementRef;
  dc: HTMLCanvasElement;

  @ViewChild('virtualCanvas') ceRef: ElementRef;
  ce: HTMLDivElement;

  @ViewChild(AudioSignal) as: AudioSignal;
  @ViewChild(Sonagram) so: Sonagram;


  private _clipBounds: Rectangle | null = null;


  private _audioData: AudioBuffer | null;
  pointer: Marker=null;
  selecting: Selection=null;
  selection: Selection=null;
  private _playFramePosition: number;
  private dragStartMouseY: number | null = null;
  private dragStartY: number | null = null;
  private dividerPosition = 0.5;

  private _xZoom: number | null = null; // pixels per second
  get xZoom(): number | null {
    return this._xZoom;
  }

  set xZoom(value: number | null) {
    this._xZoom = value;
    this.layout()
  }

  private _fixFitToPanel = true;
  set fixFitToPanel(value: boolean) {
    this._fixFitToPanel = value;
    if (value) {
      // we don't need  clip bounds
      this._clipBounds=null;
      this._xZoom = null;
    } else {
      // hold current zoom value
      //this._xZoom=this.ce.offsetWidth/this._audioData.duration;
    }
    this.layout()
  }

  constructor(private ref: ElementRef) {
    this.parentE = this.ref.nativeElement;
  }

  ngOnInit() {
    this.ce = this.ceRef.nativeElement;
    this.dc = this.canvasRef.nativeElement;
  }

  ngAfterViewInit() {
    this.layout();
    let heightListener = new MutationObserver((mrs: Array<MutationRecord>, mo: MutationObserver) => {
      mrs.forEach((mr: MutationRecord) => {
        if ('attributes' === mr.type && ('class' === mr.attributeName || 'style' === mr.attributeName)) {
          this.layout();
        }
      })
    });
    heightListener.observe(this.parentE, {attributes: true, childList: true, characterData: true});
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
      this.dividerDrag(me);
      this.layout(false);
      this.dragStartY = null;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMousemove(me: MouseEvent) {
    if (this.dragStartY != null) {
      this.dividerDrag(me);
      this.layoutScaled();
    }
  }

  pointerPositionChanged(pp:Marker){
    this.pointer=pp
  }

  selectingChanged(s:Selection){
    this.selecting=s
  }

  selectionChanged(s:Selection){
    this.selection=s
  }

  private canvasMousePos(c: HTMLCanvasElement, e: MouseEvent): Point {
    const cr = c.getBoundingClientRect();
    const p = new Point();
    p.x = e.x - cr.left;
    p.y = e.y - cr.top;
    return p;
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

  layoutScaled() {

    const offW = this.ce.offsetWidth;
    const offH = this.ce.offsetHeight;

    const psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    const asTop = 0;

    const asH = Math.round(psH * this.dividerPosition);
    const soH = Math.round(psH * (1 - this.dividerPosition));
    const soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    const wStr = offW.toString() + 'px';

    const dTop = asH;
    const dTopStr = dTop.toString() + 'px';
    this.dc.style.top = dTopStr;
    this.dc.style.left = '0px';
    this.dc.style.width = wStr;

    //this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    //this.dc.width = offW;
    //this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

    this.dc.style.width = wStr;
    this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
    this.drawDivider();

    let cLeft = 0;
    let cWidth = this.ce.clientWidth;
    if ( !this._fixFitToPanel && this._clipBounds) {
      cLeft = this._clipBounds.position.left;
      cWidth = this._clipBounds.dimension.width;
    }
    let virtualDim = new Dimension(offW, 0)
    let asR = new Rectangle(new Position(cLeft, 0), new Dimension(cWidth, asH));

    this.as.layoutBounds(asR, virtualDim, false);

    let soR = new Rectangle(new Position(cLeft, soTop), new Dimension(cWidth, soH));

    this.so.layoutBounds(soR, virtualDim, false);
  }

  clipBounds(clipBounds: Rectangle) {
    this._clipBounds = clipBounds;

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

  layout(clear=true) {

    if(this.ce && this.dc) {

      const clientW=this.ce.clientWidth;
      const offsetW=this.ce.offsetWidth;
      const scrollW=this.ce.scrollWidth;

      //console.log("Cw: "+clientW+" ow: "+offsetW+" sw: "+scrollW+ " cb: "+this._clipBounds)

      if(this._audioData){
        if(this._fixFitToPanel) {
          // Set the virtual canvas width to the visible width only
          this.ce.style.width = '100%';
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

        let ow=this.ce.offsetWidth;
        if(ow<1){
          // at least one pixel width to avoid x-zoom zero values
          ow=1;
        }
      }

      const offW = this.ce.offsetWidth;
      const offH = this.ce.offsetHeight;

      let psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
      if(psH<0){
        psH=0;
      }
      const asTop = 0;

      const asH = Math.round(psH * this.dividerPosition);

      let soH=offH-AudioClipUIContainer.DIVIDER_PIXEL_SIZE-asH;
      if(soH<0){
        soH=0;
      }

      const soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
      const wStr = offW + 'px';

      let left=0;
      let intW=offW;
      if( !this._fixFitToPanel && this._clipBounds) {
        intW = Math.round(this._clipBounds.dimension.width);
        left=Math.round(this._clipBounds.position.left);
      }
      const dTop = asH;
      const dTopStr = dTop + 'px';

      this.dc.style.top = dTopStr;
      this.dc.style.left = left+'px';

      this.dc.style.width = intW+'px';

      this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
      this.dc.width = intW;
      this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

      this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
      this.drawDivider();

      let cLeft=0;
      let cWidth=this.ce.clientWidth;
      if(!this._fixFitToPanel &&  this._clipBounds){
        cLeft=this._clipBounds.position.left;
        cWidth=this._clipBounds.dimension.width;
      }

      let virtualDim=new Dimension(offW,0)


      let asR=new Rectangle(new Position(cLeft,0),new Dimension(cWidth,asH));

      this.as.layoutBounds(asR, virtualDim,true,clear);

      let soR=new Rectangle(new Position(cLeft,soTop),new Dimension(cWidth,soH));

      this.so.layoutBounds(soR, virtualDim, true,clear);
    }
  }

  @Input()
  set audioData(audioData: AudioBuffer | null) {
    this._audioData=audioData;
    this.as.setData(audioData);
    this.so.setData(audioData);
    this.layout();
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {
      let audioData:AudioBuffer=null;
      let sel:Selection=null;
      if(audioClip){
        audioData=audioClip.buffer;
        sel=audioClip.selection;
      }
      this._audioData = audioData;
      this.as.setData(this._audioData);
      this.so.setData(this._audioData);
      this.selection=sel;
    this.layout();
  }

  get playFramePosition(): number {
    return this._playFramePosition;
  }

  set playFramePosition(playFramePosition: number) {
    this._playFramePosition = playFramePosition;
    this.as.playFramePosition = playFramePosition;
    this.so.playFramePosition = playFramePosition;
  }
}

