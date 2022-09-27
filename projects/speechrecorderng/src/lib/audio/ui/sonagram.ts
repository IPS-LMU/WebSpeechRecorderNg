import {DFTFloat32} from '../../math/dft';
import {DSPUtils} from '../../dsp/utils'
import {CSSUtils} from '../../utils/css_utils'
import {Marker, Point} from './common';
import {Component, ElementRef, ViewChild} from "@angular/core";
import {AudioCanvasLayerComponent} from "./audio_canvas_layer_comp";
import {WorkerHelper} from "../../utils/utils";
import {AudioDataHolder} from "../audio_data_holder";

declare function postMessage(message: any, transfer: Array<any>): void;

const DEFAULT_DFT_SIZE = 1024;

@Component({

    selector: 'audio-sonagram',
    template: `
        <canvas #sonagram height="10"></canvas>
        <canvas #bg height="10"></canvas>
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
export class Sonagram extends AudioCanvasLayerComponent {

    dft: DFTFloat32;
    n: any;
    ce!: HTMLDivElement;
    sonagramCanvas!: HTMLCanvasElement;
    //cursorCanvas: HTMLCanvasElement;
    markerCanvas!: HTMLCanvasElement;
    @ViewChild('sonagram', { static: true }) sonagramCanvasRef!: ElementRef;

    @ViewChild('marker', { static: true }) markerCanvasRef!: ElementRef;
    markers: Array<Marker>;
    private _playFramePosition: number|null=null;

    private worker: Worker | null;
    private workerURL: string;
    private dftSize = DEFAULT_DFT_SIZE;

    constructor(private ref: ElementRef) {
        super();
        this.worker = null;
        this._audioDataHolder = null;
        this.markers = new Array<Marker>();
        this.dft = new DFTFloat32(this.dftSize);

        this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
       this._bgColor=null;
       this._selectColor='rgba(255,255,0,0.1)'
    }

    ngAfterViewInit() {

        this.ce = this.ref.nativeElement;
        this.sonagramCanvas = this.sonagramCanvasRef.nativeElement;
        this.sonagramCanvas.style.zIndex = '1';
      this.bgCanvas = this.bgCanvasRef.nativeElement;
      this.bgCanvas.style.zIndex = '2';
        this.cursorCanvas = this.cursorCanvasRef.nativeElement;
        this.cursorCanvas.style.zIndex = '4';
        this.markerCanvas = this.markerCanvasRef.nativeElement;
        this.markerCanvas.style.zIndex = '3';

        this.canvasLayers[0] = this.sonagramCanvas;
      this.canvasLayers[1] = this.bgCanvas;
      this.canvasLayers[2] = this.cursorCanvas;
        this.canvasLayers[3] = this.markerCanvas;

    }

    get playFramePosition(): number|null {
        return this._playFramePosition;
    }

    set playFramePosition(playFramePosition: number|null) {
        this._playFramePosition = playFramePosition;
        // this.redraw();
        this.drawPlayPosition();
    }

    private canvasMousePos(c: HTMLCanvasElement, e: MouseEvent): Point {
        const cr = c.getBoundingClientRect();

        const x = e.x - cr.left;
        const y = e.y - cr.top;
        return new Point(x,y);
    }

  drawCursorPosition(e: MouseEvent, show: boolean) {

    if (this.cursorCanvas) {
      const w = this.cursorCanvas.width;
      const h = this.cursorCanvas.height;
      const g = this.cursorCanvas.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        if (show) {
          const pp = this.canvasMousePos(this.cursorCanvas, e);
          let xViewPortPixelpos = e.offsetX;

          g.fillStyle = 'yellow';
          g.strokeStyle = 'yellow';
          g.beginPath();
          g.moveTo(xViewPortPixelpos, 0);
          g.lineTo(xViewPortPixelpos, h);
          g.closePath();

          g.stroke();

          if (this._audioDataHolder) {

            let framePosRound = this.viewPortXPixelToFramePosition(xViewPortPixelpos);
            if(framePosRound!=null) {
              g.font = '14px sans-serif';
              g.fillStyle = 'yellow';
              g.fillText(framePosRound.toString(), xViewPortPixelpos + 2, 50);
            }
          }
        }
      }
    }
  }

    drawPlayPosition() {
        if (this.markerCanvas) {
            var w = this.markerCanvas.width;
            var h = this.markerCanvas.height;
            var g = this.markerCanvas.getContext("2d");
            if (g) {

                g.clearRect(0, 0, w, h);
                if(this._playFramePosition!=null) {
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

    // layout() {
    //
    //
    //   var offW = this.sonagramCanvas.offsetWidth;
    //   var offH = this.sonagramCanvas.offsetHeight;
    //   this.layoutBounds(0, 0, offW, offH, true);
    // }


    // layoutBounds(left: number, top: number, offW: number, offH: number, virtualWidth:number,redraw: boolean) {
    //
    //   const leftStr = left.toString() + 'px';
    //   this.sonagramCanvas.style.left = leftStr;
    //   const topStr = top.toString() + 'px';
    //   this.sonagramCanvas.style.top = topStr;
    //   this.cursorCanvas.style.top = topStr;
    //   this.markerCanvas.style.top = topStr;
    //
    //   if (offW) {
    //     const wStr = offW.toString() + 'px';
    //     if (redraw) {
    //
    //       this.cursorCanvas.width = offW;
    //       this.markerCanvas.width = offW;
    //     }
    //     this.sonagramCanvas.style.width = wStr;
    //     this.cursorCanvas.style.width = wStr;
    //     this.markerCanvas.style.width = wStr;
    //   }
    //   if (offH) {
    //     const hStr = offH.toString() + 'px';
    //     if (redraw) {
    //       this.cursorCanvas.height = offH;
    //       this.markerCanvas.height = offH;
    //     }
    //     this.sonagramCanvas.style.height = hStr;
    //     this.cursorCanvas.style.height = hStr;
    //     this.markerCanvas.style.height = hStr;
    //
    //   }
    //   if (redraw) {
    //     //this.redraw();
    //     if (offW > 0) {
    //       if (offH > 0) {
    //         this.startDraw(left,top,offW, offH,virtualWidth);
    //       }
    //     }
    //   }
    // }


    /*
     *  Method used as worker code.
     */
    workerFunction() {

        // Redefine some DSP classes for worker function
        // See e.g. audio.math.Complex
        class Complex {

            real: number;
            img: number;

            public static fromPolarForm(magnitude: number, argument: number): Complex {
                const r = Math.cos(argument) * magnitude;
                const i = Math.sin(argument) * magnitude;
                return new Complex(r, i);
            }

            constructor(real: number, img: number) {
                this.real = real;
                this.img = img;
            }

            public magnitude(): number {
                return Math.sqrt((this.real * this.real) + (this.img * this.img));
            }

            public argument(): number {
                return Math.atan2(this.img, this.real);
            }

            public add(addC: Complex): Complex {
                return new Complex(this.real + addC.real, this.img + addC.img);
            }

            public sub(subC: Complex): Complex {
                return new Complex(this.real - subC.real, this.img - subC.img);
            }

            public mult(multC: Complex): Complex {
                const multR = (this.real * multC.real) - (this.img * multC.img);
                const multI = (this.real * multC.img) + (multC.real * this.img);
                return new Complex(multR, multI);
            }

            public multReal(multF: number): Complex {
                return new Complex(this.real * multF, this.img * multF);
            }

            public div(divisor: Complex): Complex {
                const divReal = divisor.real;
                const divImg = divisor.img;
                const div = (divReal * divReal) + (divImg * divImg);
                const divisionReal = ((this.real * divReal) + (this.img * divImg)) / div;
                const divisionImg = ((divReal * this.img) - (this.real * divImg)) / div;

                return new Complex(divisionReal, divisionImg);
            }

            public divReal(divisor: number): Complex {
                const div = divisor * divisor;
                const divsionReal = (this.real * divisor) / div;
                const divsionImg = (divisor * this.img) / div;

                return new Complex(divsionReal, divsionImg);
            }

            public conjugate(): Complex {
                return new Complex(this.real, -this.img);
            }

            public equals(c: Complex): boolean {
                if (c === null) {
                    return false;
                }
                return (this.real === c.real && this.img === c.img);
            }

            public toString(): string {
                return 'Real: ' + this.real + ', Img: ' + this.img;
            }
        }

        class DFTFloat32 {

            private n: number;
            private m: number;

            private cosLookup: Float32Array;
            private sinLookup: Float32Array;

            constructor(n: number) {
                this.n = n;
                this.m = Math.log(n) / Math.log(2);

                // if(n != (1 << m))throw new RuntimeException("length N must be power of 2");

                // lookup tables
                this.cosLookup = new Float32Array(n / 2);
                this.sinLookup = new Float32Array(n / 2);

                for (let i = 0; i < n / 2; i++) {
                    const arc = (-2 * Math.PI * i) / n;
                    this.cosLookup[i] = Math.cos(arc);
                    this.sinLookup[i] = Math.sin(arc);
                }
            }

            public processReal(srcBuf: Float32Array): Array<Complex> {
                const x = srcBuf.slice();
                const y = new Float32Array(srcBuf.length);
                for (let yi = 0; yi < y.length; yi++) {
                    y[yi] = 0.0;
                }
                this.fftCooleyTukey(x, y);
                const rc = new Array<Complex>(x.length);
                for (let i = 0; i < x.length; i++) {
                    rc[i] = new Complex(x[i], y[i]);
                }
                return rc;
            }

            public processRealMagnitude(srcBuf: Float32Array): Float32Array {
                const x = srcBuf.slice();
                const y = new Float32Array(srcBuf.length);
                for (let yi = 0; yi < y.length; yi++) {
                    y[yi] = 0.0;
                }
                this.fftCooleyTukey(x, y);
                const rc = new Float32Array(x.length);
                for (let i = 0; i < x.length; i++) {
                    const rcc = new Complex(x[i], y[i]);
                    rc[i] = rcc.magnitude();
                }
                return rc;
            }

            public fftCooleyTukey(real: Float32Array, img: Float32Array): void {
                let i: number;
                let j = 0;
                let k: number;
                let n1: number;
                let n2: number = this.n / 2;
                let a: number;
                let c: number;
                let s: number;
                let t1: number;
                let t2: number;

                for (i = 1; i < this.n - 1; i++) {
                    n1 = n2;
                    while (j >= n1) {
                        j = j - n1;
                        n1 = n1 / 2;
                    }
                    j = j + n1;

                    if (i < j) {
                        t1 = real[i];
                        real[i] = real[j];
                        real[j] = t1;
                        t1 = img[i];
                        img[i] = img[j];
                        img[j] = t1;
                    }
                }

                n1 = 0;
                n2 = 1;
                for (i = 0; i < this.m; i++) {
                    n1 = n2;
                    n2 = n2 + n2;
                    a = 0;
                    for (j = 0; j < n1; j++) {
                        c = this.cosLookup[a];
                        s = this.sinLookup[a];
                        a += (1 << (this.m - i - 1));

                        for (k = j; k < this.n; k = k + n2) {
                            t1 = c * real[k + n1] - s * img[k + n1];
                            t2 = s * real[k + n1] + c * img[k + n1];
                            real[k + n1] = real[k] - t1;
                            img[k + n1] = img[k] - t2;
                            real[k] = real[k] + t1;
                            img[k] = img[k] + t2;
                        }
                    }
                }
            }


            public process(t: Array<Complex>): Array<Complex> {
                const reals: Float32Array = new Float32Array(this.n);
                const imgs: Float32Array = new Float32Array(this.n);
                const trans: Array<Complex> = new Array<Complex>(this.n);
                for (let i = 0; i < this.n; i++) {
                    reals[i] = t[i].real;
                    imgs[i] = t[i].img;
                }
                this.fftCooleyTukey(reals, imgs);
                for (let i = 0; i < this.n; i++) {
                    trans[i] = new Complex(reals[i], imgs[i]);
                }
                return trans;


            }

        }

        interface WindowFunction {
            getScale(i: number): number;
        }

        class GaussianWindow implements WindowFunction {

            public static DEFAULT_SIGMA = 0.3;
            // Gaussian window function,
            // http://reference.wolfram.com/language/ref/GaussianWindow.html
            // val=exp(-50*x*x/9) => sigma=0.3

            private buf: Float32Array;

            constructor(size: number, sigma: number = GaussianWindow.DEFAULT_SIGMA) {
                this.buf = new Float32Array(size);
                const center = (size - 1) / 2;
                for (let i = 0; i < size; i++) {
                    const quot = (i - center) / (sigma * center);
                    const exp = -0.5 * quot * quot;
                    this.buf[i] = Math.exp(exp);
                }
            }

            getScale(i: number): number {
                return this.buf[i];
            }

        }

        self.onmessage = function (msg:MessageEvent) {
            //console.debug("Sonagram render thread");
            let l = msg.data.l;
            let w = msg.data.w;
            let h = msg.data.h;
            let vw = msg.data.vw;
            let chs = msg.data.chs;
            let audioDataOffset=0;
            let adOffset=msg.data.audioDataOffset;
            if(adOffset){
              audioDataOffset=adOffset;
            }
           let maxPsd = null;
            if(msg.data.maxPsd!==undefined){
              maxPsd=msg.data.maxPsd;
            }

            let audioData = new Array(chs);
            for (let ch = 0; ch < chs; ch++) {
                audioData[ch] = new Float32Array(msg.data['audioData'][ch]);
            }

            let frameLength = msg.data.frameLength;
            let dftSize = msg.data.dftSize;

            let dftBands = dftSize / 2;
            let dft = new DFTFloat32(dftSize);
            let wf = new GaussianWindow(dftSize);

            let arrSize=w*h*4;
            if(arrSize<0){
                arrSize=0
            }
            let imgData = new Uint8ClampedArray(arrSize);
            //console.log("Render method:");
          //console.debug("Created imgData arrSize: "+arrSize+" ", w, "x", h);
          let calcMaxPsd=-Infinity;
            if (arrSize>0) {

                let chH = Math.round(h / chs);
                let framesPerPixel = frameLength / vw;
                //console.debug("Render: ", w, "x", h);

                let b = new Float32Array(dftSize);
                let sona = new Array(chs);


                //let p = 0;
                for (let ch = 0; ch < chs; ch++) {
                    //p = ch * frameLength;
                    let chDataLen=audioData[ch].length;
                    let x = 0;
                    // initialize DFT array buffer
                    sona[ch] = new Array(w);
                    let framePos = 0;
                    for (let pii = 0; pii < w; pii++) {
                        let virtPii = l + pii;
                        // Position of sample data frame is pixel position mapped to audio frame position.
                       // Then "center" the frame by shifting left by half the DFT size (=dftBands)
                        framePos = Math.round((virtPii * framesPerPixel)-dftBands);
                        // fill DFT buffer with windowed sample values
                        for (let i = 0; i < dftSize; i++) {
                            let samplePos=framePos + i;
                            // initialize for negative sample positions and out of bounds positions
                            let chDat=0;

                            // Set audio sample if available
                            let adp=samplePos-audioDataOffset;
                            if(adp>=0 && adp < chDataLen) {
                              chDat = audioData[ch][adp];
                              //console.debug("Audio data: "+chDat);
                            }else{
                              //console.debug("Sample buf pos oob: adp: "+adp+", chDataLen: "+chDataLen+", samplePos: "+samplePos+", i: "+i);
                            }

                            // apply Window
                            b[i] = chDat * wf.getScale(i);
                        }
                        // Calc DFT magnitudes
                        let spectr = dft.processRealMagnitude(b);

                        // Get maximum value of spectral energy
                        for (let s = 0; s < dftBands; s++) {
                            let psd = (2 * Math.pow(spectr[s], 2)) / dftBands;
                            if (psd > calcMaxPsd) {
                                calcMaxPsd = psd;
                            }
                        }
                        // Set render model data for this pixel
                        sona[ch][pii] = spectr;
                    }
                }

                if(!msg.data.norender) {
                  if(!maxPsd){
                    maxPsd=calcMaxPsd;
                  }
                for (let ch = 0; ch < chs; ch++) {

                  for (let pii = 0; pii < w; pii++) {
                    let allBlack = true;
                    for (let y = 0; y < chH; y++) {
                      let freqIdx = Math.round(y * dftBands / chH);
                      // calculate the one sided power spectral density PSD (f, t) in Pa2/Hz
                      // PSD(f) proportional to 2|X(f)|2 / (t2 - t1)
                      let val = sona[ch][pii][freqIdx];
                      let psd = (2 * Math.pow(val, 2)) / dftBands;
                      // Calculate logarithmic value
                      //let psdLog = ips.dsp.DSPUtils.toLevelInDB(psd / maxPsd);
                      let linearLevel = psd / maxPsd;
                      let psdLog = 10 * Math.log(linearLevel) / Math.log(10);
                      // Fixed dynamic Range value of 70dB for now
                      let dynRangeInDb = 70;
                      let scaledVal = (psdLog + dynRangeInDb) / dynRangeInDb;

                      // are the following checks necessary for clamped array ?
                      if (scaledVal > 1.0)
                        scaledVal = 1;
                      if (scaledVal < 0.0) {
                        scaledVal = 0;
                      }
                      let rgbVal = Math.round(255 * scaledVal);
                      if (rgbVal < 0) {
                        //							System.out.println("Neg RGB val: "+rgbVal);
                        rgbVal = 0;
                      }
                      if (rgbVal > 255) {
                        rgbVal = 255;
                      }
                      rgbVal = 255 - rgbVal;
                      if (rgbVal > 0) {
                        allBlack = false;
                      }
                      let py = chH - y;
                      let dataPos = ((((ch * chH) + py) * w) + pii) * 4;
                      imgData[dataPos + 0] = rgbVal; //R
                      imgData[dataPos + 1] = rgbVal; //G
                      imgData[dataPos + 2] = rgbVal; //B
                      imgData[dataPos + 3] = 255; //A (alpha: fully opaque)
                      //console.debug("Rendered: py: "+py+", rgbval: "+rgbVal);
                      // example 1x1, 2chs
                      //  ch0x0y0R,ch0x0y0G,ch0x0y0B,ch0x0y0A,
                      //  ch0x1y0R,ch0x1y0G,ch0x1y0B,ch0x1y0A,
                      //  ch0x0y0R,ch0x0y0G,ch0x0y0B,ch0x0y0A,
                      //  ch0x1y1R,ch0x1y1G,ch0x1y1B,ch0x1y1A,

                      //  ch1x0y0R,ch1x0y0G,ch1x0y0B,ch1x0y0A,
                      //  ch1x1y0R,ch1x1y0G,ch1x1y0B,ch1x1y0A,
                      //  ch1x0y0R,ch1x0y0G,ch1x0y0B,ch1x0y0A,
                      //  ch1x1y1R,ch1x1y1G,ch1x1y1B,ch1x1y1A
                    }
                    // if (allBlack) {
                    //   console.log("Black: ", pii, " ", ch);
                    // }
                  }
                }
                }
            }
            //console.debug("Render thread post message imgData: "+imgData.length)
            postMessage({imgData: imgData, l: l, w: msg.data.w, h: msg.data.h, vw: vw,maxPsd:calcMaxPsd,terminate:msg.data.terminate}, [imgData.buffer]);
        }
    }

    startDraw(clear = true) {
        if (clear) {
            if(this.bounds) {
                this.sonagramCanvas.style.left = Math.round(this.bounds.position.left).toString() + 'px';
                let intW = Math.round(this.bounds.dimension.width)
                let intH = Math.round(this.bounds.dimension.height)
                this.sonagramCanvas.width = intW;
                this.sonagramCanvas.height = intH;

                let g = this.sonagramCanvas.getContext("2d");
                if (g) {
                    //g.clearRect(0, 0,w, h);
                    g.fillStyle = "white";
                    g.fillRect(0, 0, intW, intH);
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
        if (this.bounds) {
            let w = Math.round(this.bounds.dimension.width);
            let h = Math.round(this.bounds.dimension.height);


            if (this._audioDataHolder && w>0 && h>0) {

                this.worker = new Worker(this.workerURL);
                //this.wo = new Worker('./worker/sonagram.worker', { type: `module` });

                let chs = this._audioDataHolder.numberOfChannels;
              let vw=Math.round(this.virtualDimension.width);

                let frameLength = this._audioDataHolder.frameLen;
              let framesPerPixel = Math.ceil(frameLength / vw);
              let leftPos= Math.round(this.bounds.position.left);
              let renderPos=leftPos;
              let raAs=this._audioDataHolder.randomAccessAudioStream();
              let audioBuffer=this._audioDataHolder.buffer;
                //let arrayAudioBuffer=this._audioDataHolder.arrayBuffer;
              let arrAbBuf:Float32Array[]|null;
              let imgData:Uint8ClampedArray;
              let maxPsd=-Infinity;
              let norender=true;

              if (this.worker) {
                this.worker.onmessage = (me) => {
                  if(true===me.data.terminate){
                    let drawImgData;
                    if(imgData){
                      drawImgData=imgData;
                    }else{
                      drawImgData=me.data.imgData;
                    }
                    this.drawRendered(w, h, drawImgData);
                    if (this.worker) {
                      this.worker.terminate();
                    }
                    this.worker = null;
                  }else {

                    // set rendered vertical values of one pixel of timescale
                    //let dataPos = renderPos * h * 4;
                    if(norender) {
                      if(me.data.maxPsd>maxPsd){
                        maxPsd=me.data.maxPsd;
                        //console.debug("new maxPsd: "+maxPsd);
                      }
                    }else{
                      let chH = Math.round(h / chs);
                      let idp=me.data.l-leftPos;
                      for (let ch = 0; ch < chs; ch++) {
                        for (let y = 0; y < chH; y++) {
                          let py = chH - y;
                          let dataPos = ((((ch * chH) + py) * w) + idp) * 4;
                          let mePos = ((ch * chH) + py) * 4;
                          //let lastPos = dataPos + me.data.imgData.length;
                          //if (lastPos < imgData.length) {
                          // set one pixel

                          imgData[dataPos] = me.data.imgData[mePos];
                          imgData[dataPos + 1] = me.data.imgData[mePos + 1];
                          imgData[dataPos + 2] = me.data.imgData[mePos + 2];
                          imgData[dataPos + 3] = me.data.imgData[mePos + 3];
                          //} else {
                          //console.error("Out of range: " + dataPos + "+" + me.data.imgData.length + ">=" + imgData.length);
                          // }
                        }
                      }
                    }
                    if(this._audioDataHolder && arrAbBuf && this.worker) {
                      // proceed with next pixel
                      renderPos++;
                      //console.debug("Render pos: "+renderPos);

                      let terminate=false;
                      let windowEnd= renderPos >= leftPos + w;

                      if(windowEnd){
                        if(norender) {
                          // phase two: rendering
                          norender = false;
                          // start from beginning
                          renderPos=leftPos;
                          //console.debug("now rendering: maxPsd: "+maxPsd);
                        }else {
                          // terminate render phase
                          terminate=true;
                        }
                      }

                      let leftFramePos = Math.floor(frameLength * renderPos / vw)-this.dftSize/2;
                      if(leftFramePos<0){
                        leftFramePos=0;
                      }
                      let ada = new Array<ArrayBuffer>(chs);

                      //console.debug("Render pos: "+renderPos+" leftFramePos: "+leftFramePos);

                      if (!terminate) {
                        if(this._audioDataHolder) {
                          //let read = this._audioDataHolder.frames(leftFramePos, this.dftSize, arrAbBuf);
                          raAs.framesObs(leftFramePos, this.dftSize, arrAbBuf).subscribe(
                            {
                              next:(read)=>{
                                if(arrAbBuf && this.worker) {
                                  for (let ch = 0; ch < chs; ch++) {
                                    // Need a copy here for the worker, otherwise this.audioData is not accessible after posting to the worker
                                    ada[ch] = arrAbBuf[ch].buffer.slice(0);
                                  }
                                  this.worker.postMessage({
                                    audioData: ada,
                                    audioDataOffset: leftFramePos,
                                    l: renderPos,
                                    w: me.data.w,
                                    h: h,
                                    vw: vw,
                                    chs: chs,
                                    frameLength: frameLength,
                                    dftSize: this.dftSize,
                                    maxPsd: maxPsd,
                                    norender: norender,
                                    terminate: terminate
                                  }, ada);
                                }
                              }
                            }

                          )


                        }
                      } else {
                        for (let ch = 0; ch < chs; ch++) {
                          ada[ch] = new ArrayBuffer(0);
                        }

                      }

                      this.worker.postMessage({
                        audioData: ada,
                        audioDataOffset:leftFramePos,
                        l: renderPos,
                        w: me.data.w,
                        h: h,
                        vw: vw,
                        chs: chs,
                        frameLength: frameLength,
                        dftSize: this.dftSize,
                        maxPsd:maxPsd,
                        norender:norender,
                        terminate:terminate
                      }, ada);
                    }

                  }
                }
              }
              if (audioBuffer && audioBuffer.length*audioBuffer.numberOfChannels < AudioCanvasLayerComponent.ENABLE_STREAMING_NUMBER_OF_SAMPLES_THRESHOLD) {
                  let ada = new Array<ArrayBuffer>(chs);
                  for (let ch = 0; ch < chs; ch++) {
                    // Need a copy here for the worker, otherwise this.audioData is not accessible after posting to the worker
                    ada[ch] = audioBuffer.getChannelData(ch).buffer.slice(0);
                  }
                  let start = Date.now();

                  if (this.markerCanvas) {
                    let g = this.markerCanvas.getContext("2d");
                    if (g) {
                      g.fillText("Rendering...", 10, 20);
                    }

                }
                this.worker.postMessage({
                    audioData: ada,
                    l: leftPos,
                    w: w,
                    h: h,
                    vw: Math.round(this.virtualDimension.width),
                    chs: chs,
                    frameLength: frameLength,
                    dftSize: this.dftSize,
                    terminate:true
                  }, ada);
                }else{
                  if(w>0) {

                    if (framesPerPixel > 0) {
                      let arrSize = w * h * 4;
                      if (arrSize < 0) {
                        arrSize = 0
                      }
                      imgData = new Uint8ClampedArray(arrSize);


                      let rw = 1;
                      //ais = new ArrayAudioBufferInputStream(arrayAudioBuffer);
                      arrAbBuf = new Array<Float32Array>(chs);

                      for (let ch = 0; ch < chs; ch++) {
                        arrAbBuf[ch] = new Float32Array(this.dftSize);
                      }

                      let leftFramePos = Math.floor(frameLength * renderPos / vw) - this.dftSize / 2;
                      let framesToRead = this.dftSize;
                      if (leftFramePos < 0) {
                        //framesToRead=this.dftSize+leftFramePos;
                        leftFramePos = 0;
                      }
                      //let read=this._audioDataHolder.frames(leftFramePos,framesToRead,arrAbBuf);
                      raAs.framesObs(leftFramePos, framesToRead, arrAbBuf).subscribe(
                        {
                          next: (read) => {
                            if (arrAbBuf && this.worker) {
                              let ad = new Float32Array(chs * framesToRead);
                              for (let ch = 0; ch < chs; ch++) {
                                ad.set(arrAbBuf[ch], ch * framesToRead);
                              }

                              this.worker.postMessage({
                                l: renderPos,
                                w: rw,
                                h: h,
                                vw: vw,
                                chs: chs,
                                frameLength: frameLength,
                                audioData: ad,
                                audioDataOffset: leftFramePos,
                                dftSize: this.dftSize,
                                norender: norender,
                                terminate: false
                              }, [ad.buffer]);
                            }
                          }
                        }
                      );
                    }
                  }
              }
            } else {
                let g = this.sonagramCanvas.getContext("2d");
                if (g) {
                    g.clearRect(0, 0, w, h);
                }
            }
        }
    }

    drawRendered(w:number,h:number,imgData:Uint8ClampedArray) {
        if (this.sonagramCanvas) {

            this.sonagramCanvas.width = w;
            this.sonagramCanvas.height = h;
            let g = this.sonagramCanvas.getContext("2d");
            if (g) {
                let imgDataArr: Uint8ClampedArray = imgData;
                if (w > 0 && h > 0) {
                    let gImgData = g.createImageData(w, h);
                    gImgData.data.set(imgDataArr);
                    g.putImageData(gImgData, 0, 0);
                }
            }
        }
        this.drawBg()
        this.drawPlayPosition();
    }

    // synchronous draw (not used anymore)
  redraw() {

    let g = this.sonagramCanvas.getContext("2d");

    let w = this.sonagramCanvas.width;
    let h = this.sonagramCanvas.height;
    if (g) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "white";
      g.fillRect(0, 0, w, h);
      if (this._audioDataHolder) {
        let spectSize = Math.floor(this.dftSize / 2)
        let chs = this._audioDataHolder.numberOfChannels;
        let chH = h / chs;

        let frameLength = this._audioDataHolder.frameLen;

        let framesPerPixel = frameLength / w;
        let y = 0;
        let audioBuffer=this._audioDataHolder.buffer;
        let arrayAudioBuffer=this._audioDataHolder.arrayBuffer;
        if(audioBuffer) {
          let b = new Float32Array(this.dftSize)

          let sona = new Array<Array<Float32Array>>(chs);
          let max = 0;
          let maxPsd = -Infinity;
          for (let ch = 0; ch < chs; ch++) {
            let x = 0;
            sona[ch] = new Array<Float32Array>(w);

            let chData = audioBuffer.getChannelData(ch);
            // TODO center buffer

            let framePos = 0;
            for (let pii = 0; pii < w; pii++) {
              framePos = Math.round(pii * framesPerPixel);
              // calculate DFT at pixel position
              for (let i = 0; i < this.dftSize; i++) {
                let chDat = chData[framePos + i];
                b[i] = chDat;
              }
              let spectr = this.dft.processRealMagnitude(b);
              sona[ch][pii] = spectr;
              // @ts-ignore
              let pMax = Math.max.apply(null, spectr);
              if (pMax > max) {
                max = pMax;
              }

              for (let s = 0; s < spectSize; s++) {
                let psd = (2 * Math.pow(spectr[s], 2)) / spectSize;
                if (psd > maxPsd) {
                  maxPsd = psd;
                }
              }
            }
          }
          //console.log("max: ", max);
          maxPsd = (2 * Math.pow(max, 2)) / spectSize;
          for (let ch = 0; ch < chs; ch++) {

            let framePos = 0;
            for (let pii = 0; pii < w; pii++) {
              framePos = pii * framesPerPixel;

              for (let y = 0; y < h; y++) {
                let freqIdx = Math.round(y * spectSize / h);

                // calculate the one sided power spectral density PSD (f, t) in Pa2/Hz
                // PSD(f) proportional to 2|X(f)|2 / (t2 - t1)
                let val = sona[ch][pii][freqIdx];
                let psd = (2 * Math.pow(val, 2)) / spectSize;

                // Calculate logarithmic
                let psdLog = DSPUtils.toLevelInDB(psd / maxPsd);
                let dynRangeInDb = 70;
                let scaledVal = (psdLog + dynRangeInDb) / dynRangeInDb;

                if (scaledVal > 1)
                  scaledVal = 1;
                if (scaledVal < 0) {
                  scaledVal = 0;
                }
                let rgbVal = (255 * scaledVal);
                if (rgbVal < 0) {
//							System.out.println("Neg RGB val: "+rgbVal);
                  rgbVal = 0;
                }
                if (rgbVal > 255) {
                  rgbVal = 255;
                }
                rgbVal = 255 - rgbVal;
                let colorStr = CSSUtils.toColorString(rgbVal, rgbVal, rgbVal);
                g.fillStyle = colorStr;
                g.fillRect(pii, chH - y, 1, 1);
              }
            }
          }
          this.drawPlayPosition();
        }else if(arrayAudioBuffer){
            throw Error("Redraw with array audio buffer not supported.")
        }
      }
    }
  }


    setData(audioData: AudioDataHolder | null) {
        this._audioDataHolder = audioData;
        this.playFramePosition = 0;
    }


}

