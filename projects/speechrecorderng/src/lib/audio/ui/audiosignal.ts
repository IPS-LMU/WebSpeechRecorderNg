import {Component, ViewChild, ElementRef} from '@angular/core';
import {AudioCanvasLayerComponent} from "./audio_canvas_layer_comp";
import {WorkerHelper} from "../../utils/utils";
import {AudioDataHolder} from "../audio_data_holder";
import {ArrayAudioBufferInputStream} from "../array_audio_buffer";
import {Float32ArrayChunkerOutStream, Float32ArrayInputStream} from "../../io/stream";

declare function postMessage(message: any, transfer: Array<any>): void;

@Component({

  selector: 'audio-signal',
  template: `
    <canvas #bg height="10"></canvas>
    <canvas #audioSignal height="10"></canvas>
    <canvas #cursor height="10" (mousedown)="selectionStart($event)" (mouseover)="updateCursorCanvas($event)" (mousemove)="updateCursorCanvas($event)"
            (mouseleave)="updateCursorCanvas($event, false)"></canvas>
    <canvas #marker height="10"></canvas>`,

  styles: [`:host{
      min-height: 0px;
    }`,`canvas {
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    min-height: 0px;
    position: absolute;
  }`]

})
export class AudioSignal extends AudioCanvasLayerComponent{

  n: any;
  ce!: HTMLDivElement;
  @ViewChild('audioSignal', { static: true }) audioSignalCanvasRef!: ElementRef;
  @ViewChild('marker', { static: true }) playPosCanvasRef!: ElementRef;
  signalCanvas!: HTMLCanvasElement;

  markerCanvas!: HTMLCanvasElement;

  private _playFramePosition: number|null=null;

  //private ais:ArrayAudioBufferInputsStream|null=null;
  //private aisBuf:Float32Array[]|null=null;
  //private psMinMax:Float32Array[]|null=null;
  private worker: Worker | null;
  private workerURL: string;

  constructor(private ref: ElementRef) {
    super();
    this.worker = null;
    this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
    this._audioDataHolder = null;
    this._bgColor='black';
    this._selectColor='rgba(255,255,0,0.8)'

  }

  ngAfterViewInit() {

    this.ce = this.ref.nativeElement;
    this.bgCanvas = this.bgCanvasRef.nativeElement;
    this.bgCanvas.style.zIndex = '1';
    this.signalCanvas = this.audioSignalCanvasRef.nativeElement;
    this.signalCanvas.style.zIndex = '2';
    this.markerCanvas = this.playPosCanvasRef.nativeElement;
    this.markerCanvas.style.zIndex = '3';
    this.cursorCanvas = this.cursorCanvasRef.nativeElement;
    this.cursorCanvas.style.zIndex = '4';

    this.canvasLayers[0]=this.bgCanvas;
    this.canvasLayers[1]=this.signalCanvas;
    this.canvasLayers[2]=this.cursorCanvas;
    this.canvasLayers[3]=this.markerCanvas;

  }

  get playFramePosition(): number |null{
    return this._playFramePosition;
  }

  set playFramePosition(playFramePosition: number|null) {
    this._playFramePosition = playFramePosition;
    this.drawPlayPosition();
  }



  drawPlayPosition() {
    if (this.markerCanvas) {
      let w = this.markerCanvas.width;
      let h = this.markerCanvas.height;
      let g = this.markerCanvas.getContext("2d");
      if (g) {
        g.clearRect(0, 0, w, h);
        if(this._playFramePosition) {
          let pixelPos = this.frameToViewPortXPixelPosition(this._playFramePosition);
          if (pixelPos) {
            g.fillStyle = 'red';
            g.strokeStyle = 'red';
            g.beginPath();
            g.moveTo(pixelPos, 0);
            g.lineTo(pixelPos, h);
            g.closePath();
            g.stroke();
          }
        }
      }
    }
  }

  /*
   *  Method used as worker code.
   */
  workerFunction() {
    addEventListener('message', ({ data }) => {

      let audioData = data.audioData; // audio data part required to render view port
      let auOffset=data.audioDataOffset;
      let l= data.l; // left pixel position of view port
      let w = data.w;  // width of viewport
      let vw = data.vw; //  total width of (virtual) audio view (not viewport width)
      let chs = data.chs; // number of channels
      let frameLength = data.frameLength;  // frame length auf audio data part required for view port

      //console.debug("W: left: "+l+", w:"+w+", vw: "+vw+", chs: "+chs+", frameLength: "+frameLength);

      let psMinMax= new Float32Array(0);

      if(audioData && w>=0 && vw>0) {

        let framesPerPixel = frameLength / vw;

        let pointsLen = w * chs;
        // one for min one for max
        let arrLen = pointsLen * 2;
        psMinMax = new Float32Array(arrLen);
        let chFramePos = 0;
        for (let ch = 0; ch < chs; ch++) {

          chFramePos = ch * frameLength;
          for (let pii = 0; pii < w; pii++) {
            let virtPii=l+pii;
            let pMin = Infinity;
            let pMax = -Infinity;
            let pixelFramePos = Math.round(chFramePos + (virtPii * framesPerPixel));

            // calculate pixel min/max amplitude
            for (let ai = 0; ai < framesPerPixel; ai++) {
              let framePos = pixelFramePos + ai;
              let a = 0;
              let bufPos=framePos-auOffset;
              if(bufPos>=0 && bufPos<audioData.length){
                a=audioData[bufPos];
              }
              //console.debug("W: pixelFramePos: "+pixelFramePos+", framePos: "+framePos+", bufPos: "+bufPos+", audioData.length: "+audioData.length+", a: "+a);
              if (a < pMin) {
                pMin = a;
              }
              if (a > pMax) {
                pMax = a;
              }
            }

            let psMinPos = ch * w + pii;
            psMinMax[psMinPos] = pMin;
            let psMaxPos = pointsLen + psMinPos;
            psMinMax[psMaxPos] = pMax;

          }

        }
      }
      postMessage({psMinMax: psMinMax, l:data.l,w: data.w, chs: data.chs,framesPerPixel:data.framesPerPixel,eod:data.eod}, [psMinMax.buffer]);
    })
  }



  startDraw(clear = true) {
    if (clear) {
      if(this.bounds) {
        this.signalCanvas.style.left = Math.round(this.bounds.position.left).toString() + 'px';
        this.signalCanvas.width = Math.round(this.bounds.dimension.width);
        this.signalCanvas.height = Math.round(this.bounds.dimension.height);

        let g = this.signalCanvas.getContext("2d");
        if (g) {
          //g.clearRect(0, 0,w, h);
          g.fillStyle = "black";
          g.fillRect(0, 0, Math.round(this.bounds.dimension.width), Math.round(this.bounds.dimension.height));
        }
      }
    }
    this.startRender();
    this.drawCursorLayer()
  }


  private startRender() {

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.bounds && this.bounds.dimension) {

      let w = Math.round(this.bounds.dimension.width);
      let h = Math.round(this.bounds.dimension.height);

      if (this._audioDataHolder && w>0 && h>0) {
        //this.wo = new Worker('./audiosignal.worker.js',{type: 'module'});
        this.worker = new Worker(this.workerURL);
        //this.wo = new Worker('worker/audiosignal.worker.ts');

        //let Worker = require('worker!../../../workers/uploader/main');
        let chs = this._audioDataHolder.numberOfChannels;
        let leftPos= Math.round(this.bounds.position.left);
        let renderPos=leftPos;
        let vw=Math.round(this.virtualDimension.width);
        let frameLength = this._audioDataHolder.frameLen;
        let framesPerPixel = Math.ceil(frameLength / w);
        let audioBuffer=this._audioDataHolder.buffer;
        let arrayAudioBuffer=this._audioDataHolder.arrayBuffer;
        let arrAbBuf:Float32Array[]|null;

        //let ais:ArrayAudioBufferInputStream|null=null;
        //let aisBuf:Float32Array[]|null=null;
        let psMinMax:Float32Array|null=null;

        if (this.worker) {
          this.worker.onmessage = (me) => {
            if(me.data.eod===true){
              let psMinMaxTmp;
              if(psMinMax){
                psMinMaxTmp=psMinMax;
              }else{
                psMinMaxTmp=me.data.psMinMax;
              }
              this.drawRendered(leftPos,w,h,me.data.chs,psMinMaxTmp);
              if (this.worker) {
                this.worker.terminate();
              }
              this.worker = null;
            }else if(arrayAudioBuffer && arrAbBuf){
              for (let ch = 0; ch < chs; ch++) {
                if(psMinMax){
                  let pos=ch*w +renderPos;
                  let pointsLen=chs*w;
                  // TODO Test 1 channel, 1 pixel
                  psMinMax[pos]=me.data.psMinMax[0];
                  //console.debug('Min: ('+pos+'): '+me.data.psMinMax[0]);
                  psMinMax[pointsLen+pos]=me.data.psMinMax[1];
                  //console.debug('Max: ('+(pointsLen+pos)+'): '+me.data.psMinMax[1]);
                }
              }
              renderPos++;
              let leftFramePos=Math.floor(frameLength*renderPos/w);
              let read = arrayAudioBuffer.frames(leftFramePos,framesPerPixel,arrAbBuf);
              //console.debug("First read frame: "+arrAbBuf[0][0]);
              let ad = new Float32Array(chs * me.data.framesPerPixel);
              for (let ch = 0; ch < chs; ch++) {
                ad.set(arrAbBuf[ch], ch * framesPerPixel);
              }
              if (this.worker) {
                this.worker.postMessage({
                  l: renderPos,
                  w: 1,
                  h:h,
                  vw: vw,
                  chs: chs,
                  frameLength: frameLength,
                  framesPerPixel:me.data.framesPerPixel,
                  audioData: ad,
                  audioDataOffset: leftFramePos,
                  eod:(read<=0)
                }, [ad.buffer]);
              }
            }
          }
        }

        if (audioBuffer) {
          arrAbBuf=null;
          psMinMax=null;
          let ad = new Float32Array(chs * frameLength);
          for (let ch = 0; ch < chs; ch++) {
            ad.set(audioBuffer.getChannelData(ch), ch * frameLength);
          }
          this.worker.postMessage({
            l: leftPos,
            w: w,
            vw: vw,
            chs: chs,
            frameLength: frameLength,
            audioData: ad,
            audioDataOffset:0,
            eod:true
          }, [ad.buffer]);

        }else if(arrayAudioBuffer){
          if(w>0) {

            if (framesPerPixel > 0) {
              //ais = new ArrayAudioBufferInputStream(arrayAudioBuffer);
              arrAbBuf = new Array<Float32Array>(chs);
              psMinMax=new Float32Array(chs*w*2);
              for (let ch = 0; ch < chs; ch++) {
                arrAbBuf[ch] = new Float32Array(framesPerPixel);
              }
              let auOffset=0; // should always be 0
              let read=arrayAudioBuffer.frames(0,framesPerPixel,arrAbBuf);
              let ad=new Float32Array(chs*framesPerPixel);
              for (let ch = 0; ch < chs; ch++) {
                ad.set(arrAbBuf[ch],ch*framesPerPixel);
              }

              this.worker.postMessage({
                l: renderPos,
                w: 1,
                vw: vw,
                chs: chs,
                frameLength: frameLength,
                framesPerPixel:framesPerPixel,
                audioData: ad,
                audioDataOffset:auOffset,
                eod:(read<=0)
              }, [ad.buffer]);
            }
          }
        }


      } else {
        let g = this.signalCanvas.getContext("2d");
        if (g) {
          g.clearRect(0, 0, w, h);
        }
      }
    }
  }


  drawRendered(left:number,w:number,h:number,chs:number,psMinMax:Float32Array) {
    this.drawBg();
    this.signalCanvas.style.left=left.toString()+'px';
    this.signalCanvas.width = w;
    this.signalCanvas.height = h;
    let g = this.signalCanvas.getContext("2d");
    if (g) {
      g.clearRect(0, 0, w, h);
      //g.fillStyle = "black";
      //g.fillRect(0, 0, me.data.w, me.data.h);
      let pointsLen = w * chs;
      // one for min one for max
      let arrLen = pointsLen * 2;
      if (this._audioDataHolder) {
        let std = Date.now();

        let chH = h / chs;

        let y = 0;
        for (let ch = 0; ch < chs; ch++) {
          let x = 0;

          let psMinPos = ch * w;
          let psMaxPos = pointsLen + psMinPos;

          g.fillStyle = 'green';
          g.strokeStyle = 'green';

          // draw audio signal as single polygon
          g.beginPath();
          g.moveTo(0, y + (chH / 2) + psMinMax[psMaxPos] * chH / 2);

          for (let pii = 0; pii < w; pii++) {
            let psMax = psMinMax[psMaxPos + pii];
            let pv = psMax * chH / 2;
            let yd=y + (chH / 2) - pv;
            //console.log("LineTo: : "+pii+" "+yd)
            g.lineTo(pii, yd);
          }
          let revPixelStart=w-1;

          for (let pii = revPixelStart; pii >= 0; pii--) {
            let psMin = psMinMax[psMinPos + pii];
            let pv = psMin * chH / 2;
            let yd=y + (chH / 2) - pv;
            //console.log("LineTo: : "+pii+" "+yd)
            g.lineTo(pii, yd);
          }
          g.closePath();

          g.fill();
          g.stroke();
          y += chH;
        }

        //this.drawPlayPosition();
      }
    }
  }

  redraw() {
    this.drawBg()
    let g = this.signalCanvas.getContext("2d");
    if (g) {
      let w = this.signalCanvas.width;
      let h = this.signalCanvas.height;
      g.clearRect(0, 0, w, h);
      //g.fillStyle = "black";
      //g.fillRect(0, 0, w, h);
      if (this._audioDataHolder) {
        let std = Date.now();
        let chs = this._audioDataHolder.numberOfChannels;
        let chH = h / chs;

        let frameLength = this._audioDataHolder.frameLen;

        let framesPerPixel = frameLength / w;
        let y = 0;
        let ais:Float32ArrayInputStream|null=null;
        let audioBuffer=this._audioDataHolder.buffer;
        let aisBuffer:Array<Float32Array>|null=null;
        if(!audioBuffer) {
          ais=this._audioDataHolder.audioInputStream();
          aisBuffer=new Array<Float32Array>(chs);
          for(let ch=0;ch<chs;ch++) {
            aisBuffer[ch] = new Float32Array(framesPerPixel);
          }
        }
          for (let ch = 0; ch < chs; ch++) {
            let x = 0;
            let psMin = new Float32Array(w);
            let psMax = new Float32Array(w);
            let framePos = 0;
            for (let pii = 0; pii < w; pii++) {
              let pMin = 0;
              let pMax = 0;

              if (audioBuffer){
                // calculate pixel min/max amplitude
                for (let ai = 0; ai < framesPerPixel; ai++) {
                  //let framePos=(pii*framesPerPixel)+ai;
                  let a = audioBuffer.getChannelData(ch)[framePos++];

                  if (a < pMin) {
                    pMin = a;
                  }
                  if (a > pMax) {
                    pMax = a;
                  }
                }
            }else if(ais && aisBuffer) {
                let r = ais.read(aisBuffer);
                for (let ai = 0; ai < r; ai++) {

                  let a = aisBuffer[ch][ai];

                  if (a < pMin) {
                    pMin = a;
                  }
                  if (a > pMax) {
                    pMax = a;
                  }
                }
              }
              psMin[pii] = pMin;
              psMax[pii] = pMax;
            }
            g.fillStyle = 'green';
            g.strokeStyle = 'green';

            // draw audio signal as single polygon
            g.beginPath();
            g.moveTo(0, y + (chH / 2) + psMin[0] * chH / 2);

            for (let pii = 0; pii < w; pii++) {
              let pv = psMin[pii] * chH / 2;
              //console.log("Min: ",pv);
              g.lineTo(pii, y + (chH / 2) + pv);
            }
            for (let pii = w; pii >= 0; pii--) {
              let pv = psMax[pii] * chH / 2;
              //console.log("Max: ",pv);
              g.lineTo(pii, y + (chH / 2) + pv);
            }
            g.closePath();
            //g.lineTo()
            g.fill();
            g.stroke();
            g.fillStyle = "yellow";
            g.stroke();
            y += chH;
          }

      }
    }
  }

  setData(audioData: AudioDataHolder | null) {
    this._audioDataHolder = audioData;
    this.playFramePosition = 0;
  }
}

