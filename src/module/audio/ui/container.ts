import {
    ElementRef, Renderer2, AfterContentInit, AfterViewInit, HostListener, Input, OnInit,
    OnChanges, SimpleChanges
} from '@angular/core'
import {AudioSignal} from './audiosignal'
import {Sonagram} from './sonagram'
import {Point} from './common'

import {Component, ViewChild} from '@angular/core';

@Component({

  selector: 'app-audio',
  template: `
    <canvas #container (mousedown)="mousedown($event)" (mouseover)="mouseover($event)" (mousemove)="mousemove($event)"
            (mouseleave)="mouseleave($event)"></canvas>
    <audio-signal></audio-signal>
    <audio-sonagram></audio-sonagram>
  `,
  styles: [`:host {

    margin: 0;
    padding: 0;
    position: relative;
    width: 100%;
    height: 100%;
    flex: 1;
    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
    text-align: center;
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
export class AudioClipUIContainer implements OnInit,AfterViewInit,OnChanges {
  private static DIVIDER_PIXEL_SIZE = 10;
  @ViewChild('container') canvasRef: ElementRef;

  ce: HTMLDivElement;
  dc: HTMLCanvasElement;
  @ViewChild(AudioSignal) as: AudioSignal;
  @ViewChild(Sonagram) so: Sonagram;
  private _playFramePosition: number;
  private dragStartMouseY: number | null = null;
  private dragStartY: number | null = null;
  private dividerPosition = 0.5;

  constructor(private ref: ElementRef) {
  }

  ngOnInit(){
    this.ce = this.ref.nativeElement;
    this.dc = this.canvasRef.nativeElement;
  }

  ngAfterViewInit() {

    this.layout();
  }

  ngOnChanges(changes: SimpleChanges): void{
    this.layout();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event:Event):void {
    this.layout();
  }

  mouseover(me: MouseEvent) {
    this.dividerCursorPosition(me, true);
  }

  mousemove(me: MouseEvent) {
    if (this.dragStartY != null) {
      this.dividerDrag(me);
      this.layoutScaled();
    }
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
  onMouseup(me:MouseEvent) {
    if (this.dragStartY != null) {
      this.dividerDrag(me);
      this.layout();
      this.dragStartY = null;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMousemove(me:MouseEvent) {
    if (this.dragStartY != null) {
      this.dividerDrag(me);
      this.layoutScaled();
    }
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
    if(this.ce && this.dc) {
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
  }

  @Input()
  set audioData(audioData: AudioBuffer | null) {
    this.as.setData(audioData);
    this.so.setData(audioData);
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

