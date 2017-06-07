import {ElementRef,Renderer2,AfterContentInit} from '@angular/core'
import { AudioSignal} from './audiosignal'
import { Sonagram } from './sonagram'
import { Point } from './common'

import { Component,ViewChild } from '@angular/core';
import {Element} from "@angular/compiler";

@Component({

  selector: 'app-audio',
  template: `<p>AudioSignal</p><div #signalContainer></div>`
})
    export class AudioClipUIContainer implements AfterContentInit{
        cc:HTMLCanvasElement;
  @ViewChild("signalContainer") signalContainerRef: ElementRef;
        ce:HTMLDivElement;
        dc:HTMLCanvasElement;
        as:AudioSignal;
        so:Sonagram;
        private _playFramePosition:number;
        private dragStartMouseY:number = null;
        private dragStartY:number = null;
        private dividerPosition:number = 0.5;
        private static DIVIDER_PIXEL_SIZE:number = 10;

       constructor(private renderer:Renderer2) {


       }



  ngAfterContentInit() {

      this.ce=this.signalContainerRef.nativeElement;

  this.dc = this.createCanvas();

  this.ce.appendChild(this.dc);
  this.dc.style.cursor = 'ns-resize';
  this.dc.style.zIndex = '3';
  this.dc.addEventListener('mouseover', (e)=> {
    this.dividerCursorPosition(e, true);
  });
  this.dc.addEventListener('mousemove', (e)=> {

  }, false);
  this.dc.addEventListener('mouseleave', (e)=> {
    this.dividerCursorPosition(e, false);
  });
  this.dc.addEventListener('mousedown', (e)=> {
    this.dragStartMouseY = e.clientY;
    this.dragStartY = this.dc.offsetTop;
    //console.log("drag start ", this.dragStartY, this.dragStartMouseY);
    document.onmouseup = (e)=> {
      if (this.dragStartY != null) {
        this.dividerDrag(e);
        this.layout();
        document.onmousemove = null;
        document.onmouseup = null;
        this.dragStartY = null;
      }
    }
    document.onmousemove = (e)=> {
      if (this.dragStartY != null) {
        this.dividerDrag(e);
        this.layoutScaled();
      }
    }
  });
  this.dc.addEventListener('mouseup', (e)=> {

  });


  this.as = new AudioSignal(this.ce);
  this.so = new Sonagram(this.ce);
  this.so.init();
  window.addEventListener('resize', ()=> {
    //console.log("Window resize event received")
    this.layout();
  }, true);

  this.layout();
  }

        private canvasMousePos(c:HTMLCanvasElement, e:MouseEvent):Point {
            var cr = c.getBoundingClientRect();
            var p = new Point();
            p.x = e.x - cr.left;
            p.y = e.y - cr.top;
            return p;
        }

        dividerCursorPosition(e:MouseEvent, show:boolean) {
            if (this.dc) {

                var w = this.dc.width;
                var h = this.dc.height;
                var g = this.dc.getContext("2d");

                var pp = this.canvasMousePos(this.dc, e);
                var offX = e.layerX - this.dc.offsetLeft;
                var offY = e.layerY - this.dc.offsetTop;

            }
        }

        dividerDrag(e:MouseEvent) {
            if (this.dc) {

                var dragOffset = e.clientY - this.dragStartMouseY;
                //console.log("Drag offset: ", dragOffset);
                var newTop = (this.dragStartY + dragOffset);
                this.dc.style.top = newTop.toString() + 'px';
                var ceHeight = this.ce.offsetHeight;
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
            var w = this.dc.width;
            var h = this.dc.height;
            var g = this.dc.getContext("2d");
            g.fillStyle = 'white';
            g.fillRect(0, 0, w, h);
            g.fillStyle = 'black';
            g.fillRect(5, 5, w - 10, 1);

        }


        private createCanvas():HTMLCanvasElement {
            var c = document.createElement('canvas');
            c.width = 0;
            c.height = 0;
            c.className = 'audioSignalCC';
            return c;
        }

        layoutScaled() {
            var offW = this.ce.offsetWidth;
            var offH = this.ce.offsetHeight;

            var psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
            var asTop = 0;

            var asH = Math.round(psH * this.dividerPosition);
            var soH = Math.round(psH * (1 - this.dividerPosition));
            var soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
            var wStr = offW.toString() + 'px';

            var dTop = asH;
            var dTopStr = dTop.toString() + 'px';
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
            var offW = this.ce.offsetWidth;
            var offH = this.ce.offsetHeight;

            var psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
            var asTop = 0;

            var asH = Math.round(psH * this.dividerPosition);
            var soH = Math.round(psH * (1 - this.dividerPosition));
            var soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
            var wStr = offW.toString() + 'px';

            var dTop = asH;
            var dTopStr = dTop.toString() + 'px';
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

        setData(audioData:AudioBuffer) {
            //this.audioData = audioData;
            this.as.setData(audioData);
            this.so.setData(audioData);
            this.layout();
        }

        get playFramePosition():number {
            return this._playFramePosition;
        }

        set playFramePosition(playFramePosition:number) {
            this._playFramePosition = playFramePosition;
            this.as.playFramePosition = playFramePosition;
            this.so.playFramePosition = playFramePosition;
        }


    }

