import {
    ElementRef, AfterViewInit, HostListener, Input, OnInit
} from '@angular/core'
import {AudioSignal} from './audiosignal'
import {Sonagram} from './sonagram'
import {Point} from './common'

import {Component, ViewChild} from '@angular/core';

@Component({

  selector: 'app-audio',
  template: `
    <div #virtualCanvas>
    <canvas #container (mousedown)="mousedown($event)" (mouseover)="mouseover($event)" (mousemove)="mousemove($event)"
            (mouseleave)="mouseleave($event)"></canvas>
    <audio-signal></audio-signal>
    
    </div>
  `,
  styles: [`div {

    margin: 0; 
    padding: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    /*position: absolute;*/
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

  @ViewChild('virtualCanvas') ceRef:ElementRef;
  ce: HTMLDivElement;

  @ViewChild(AudioSignal) as: AudioSignal;
  //@ViewChild(Sonagram) so: Sonagram;

  private clipLeft=0;
  private clipTop=0;
  private clipWidth:number|null=null;
  private clipHeight:number|null=null;

  private _audioData:AudioBuffer|null;
  private _playFramePosition: number;
  private dragStartMouseY: number | null = null;
  private dragStartY: number | null = null;
  private dividerPosition = 0.5;

  private xZoom:number | null;

  constructor(private ref: ElementRef) {
  this.parentE=this.ref.nativeElement;
  }

  ngOnInit(){
    this.ce = this.ceRef.nativeElement;
    this.dc = this.canvasRef.nativeElement;
  }

  ngAfterViewInit() {
     this.layout();
      let heightListener=new MutationObserver((mrs:Array<MutationRecord>,mo:MutationObserver)=>{
        mrs.forEach((mr:MutationRecord)=>{
          if('attributes'===mr.type && ('class'===mr.attributeName || 'style'===mr.attributeName)){
            this.layout();
          }
        })
      });
      heightListener.observe(this.parentE,{attributes: true,childList: true, characterData: true});
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
      //this.layoutScaled();
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
      //this.layoutScaled();
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
      const ceHeight = this.ce.offsetHeight;

      let newTop = (this.dragStartY + dragOffset);
      if(newTop<0){
        newTop=0;
      }
      if(newTop>ceHeight-AudioClipUIContainer.DIVIDER_PIXEL_SIZE){
        newTop=ceHeight-AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
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
    if (g) {
      g.fillStyle = 'white';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'black';
      g.fillRect(5, 5, w - 10, 1);
    }
  }

  // layoutScaled() {
  //
  //   // // TODO test
  //   // this.ce.style.width='1000px';
  //   // this.ce.style.height='400px';
  //
  //   const offW = this.ce.offsetWidth;
  //   const offH = this.ce.offsetHeight;
  //
  //   const psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
  //   const asTop = 0;
  //
  //   const asH = Math.round(psH * this.dividerPosition);
  //   const soH = Math.round(psH * (1 - this.dividerPosition));
  //   const soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
  //   const wStr = offW.toString() + 'px';
  //
  //   const dTop = asH;
  //   const dTopStr = dTop.toString() + 'px';
  //   this.dc.style.top = dTopStr;
  //   this.dc.style.left = '0px';
  //   this.dc.style.width = wStr;
  //
  //   this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
  //   this.dc.width = offW;
  //   this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
  //
  //   this.dc.style.width = wStr;
  //   this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
  //   this.drawDivider();
  //   //this.so.layoutBounds(0, soTop, offW, soH, false);
  //   this.as.layoutBounds(0, 0, offW, asH, false);
  // }

  clipBounds(left:number,top:number,width:number,height:number){
    this.clipLeft=left;
    this.clipTop=top;
    this.clipWidth=width;
    this.clipHeight=height;
    this.layout();
  }

  layout() {
    if(this.ce && this.dc) {

      const clientW=this.ce.clientWidth;
      if(this.xZoom){
        const newClW=Math.round(this._audioData.length/this.xZoom);
        this.ce.style.width=newClW+'px';
      }else{

        this.ce.style.width=clientW+'px';
      }


      const offW = this.ce.offsetWidth;
      const offH = this.ce.offsetHeight;

      const psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
      const asTop = 0;

      const asH = Math.round(psH * this.dividerPosition);
      //const soH = Math.round(psH * (1 - this.dividerPosition));
      // teh rest
      const soH=offH-AudioClipUIContainer.DIVIDER_PIXEL_SIZE-asH;

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

      let cWidth=this.ce.clientWidth;
      if(this.clipWidth){
        cWidth=this.clipWidth;
      }
      console.log(this.clipLeft+ " "+cWidth);
      this.as.layoutBounds(this.clipLeft, 0, cWidth, asH, offW,true);
      //this.so.layoutBounds(0, soTop, offW, soH, true);
    }
  }

  @Input()
  set audioData(audioData: AudioBuffer | null) {
    this._audioData=audioData;
    this.as.setData(audioData);
    //this.so.setData(audioData);
    this.layout();
  }

  get playFramePosition(): number {
    return this._playFramePosition;
  }

  set playFramePosition(playFramePosition: number) {
    this._playFramePosition = playFramePosition;
    this.as.playFramePosition = playFramePosition;
    //this.so.playFramePosition = playFramePosition;
  }
}

