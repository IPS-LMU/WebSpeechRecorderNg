import {ElementRef, Renderer2, AfterContentInit, AfterViewInit} from '@angular/core'
import {AudioSignal} from './audiosignal'
import {Sonagram} from './sonagram'
import {Point} from './common'

import {Component, ViewChild} from '@angular/core';


// CSS selector #signalC does NOT work here !!
@Component({

  selector: 'app-audio',
  template: `
    <canvas #signalC (mousedown)="mousedown($event)" (mouseover)="mouseover($event)" (mousemove)="mousemove($event)"></canvas>
    `,
  styles: [`:host {

    margin: 0;
    padding: 0;
    /* position: relative; */
    position: relative;
    width: 100%;
    height: 100%;
    flex: 1;
    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
    text-align: center;
  }`, `div {

    margin: 0;
    padding: 0;
    position: relative;
    width: 100%;
    height: 100%;

    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
    text-align: center;
  }`, `canvas {
    width: 0;
    height: 0;
   /* c.className = 'audioSignalCC'; */
 
    position: absolute;
    zIndex: 1;
  }`]

})
export class AudioClipUIContainer implements AfterViewInit {
  private static DIVIDER_PIXEL_SIZE = 10;
  cc: HTMLCanvasElement;
  //@ViewChild(':host') signalContainerRef: ElementRef;
  @ViewChild('signalC') canvasRef: ElementRef;
  ce: HTMLDivElement;
  dc: HTMLCanvasElement;
  as: AudioSignal;
  so: Sonagram;
  private _playFramePosition: number;
  private dragStartMouseY: number | null = null;
  private dragStartY: number | null = null;
  private dividerPosition = 0.5;

  constructor(private ref:ElementRef) {}


  ngAfterViewInit() {

    this.ce = this.ref.nativeElement;
    this.dc = this.canvasRef.nativeElement;
    //this.dc = this.createCanvas();

    //this.ce.appendChild(this.dc);
    this.dc.style.cursor = 'ns-resize';
    this.dc.style.zIndex = '3';
    // this.dc.addEventListener('mouseover', (e) => {
    //   this.dividerCursorPosition(e, true);
    // });
    // this.dc.addEventListener('mousemove', (e) => {
    //
    // }, false);
    this.dc.addEventListener('mouseleave', (e) => {
      this.dividerCursorPosition(e, false);
    });
    // this.dc.addEventListener('mousedown', (e) => {
    //   this.dragStartMouseY = e.clientY;
    //   this.dragStartY = this.dc.offsetTop;
    //   // console.log("drag start ", this.dragStartY, this.dragStartMouseY);
    //   document.onmouseup = (e2) => {
    //     if (this.dragStartY != null) {
    //       this.dividerDrag(e2);
    //       this.layout();
    //       document.onmousemove = (ev) => {
    //       };
    //       document.onmouseup = (ev) => {
    //       };
    //       this.dragStartY = null;
    //     }
    //   }
    //   document.onmousemove = (e2) => {
    //     if (this.dragStartY != null) {
    //       this.dividerDrag(e2);
    //       this.layoutScaled();
    //     }
    //   }
    // });
    this.dc.addEventListener('mouseup', (e) => {

    });


    this.as = new AudioSignal(this.ce);
    this.so = new Sonagram(this.ce);
    this.so.init();
    window.addEventListener('resize', () => {
      console.log("Window resize event received")
      this.layout();
    }, true);

    this.layout();
  }

  mouseover(me:MouseEvent){
    this.dividerCursorPosition(me, true);
  }

  mousemove(me:MouseEvent){

  }

  mousedown(me:MouseEvent){

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
      // console.log("Drag offset: ", dragOffset);
      const newTop = (this.dragStartY + dragOffset);
      this.dc.style.top = newTop.toString() + 'px';
      const ceHeight = this.ce.offsetHeight;
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
    if (g) {
      g.fillStyle = 'white';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'black';
      g.fillRect(5, 5, w - 10, 1);
    }
  }


  private createCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 0;
    c.height = 0;
    c.className = 'audioSignalCC';
    // position: absolute;
    // z-index: 1;
    // top: 0px;
    // left: 0px;
    // width: 100%;
    // height: 100%;
    // max-height: 100%;
    // text-align: center;
    // vertical-align: middle;
    c.style.position = 'absolute';
    c.style.zIndex = '1';
    return c;
  }

  layoutScaled() {
    console.log("Layout scaled")
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

    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    this.dc.width = offW;
    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

    this.dc.style.width = wStr;
    this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
    this.drawDivider();
    this.so.layoutBounds(0, soTop, offW, soH, false);
    this.as.layoutBounds(0, 0, offW, asH, false);
  }

  layout() {
    console.log("Layout")
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

    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
    this.dc.width = offW;
    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;

    this.dc.style.width = wStr;
    this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
    this.drawDivider();
    this.as.layoutBounds(0, 0, offW, asH, true);
    this.so.layoutBounds(0, soTop, offW, soH, true);
  }

  setData(audioData: AudioBuffer | null) {
    // this.audioData = audioData;
    this.as.setData(audioData);
    this.so.setData(audioData);
    this.layout();
    console.log("AudioContainer layout")
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

