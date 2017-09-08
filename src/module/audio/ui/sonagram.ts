import {DFTFloat32} from '../../math/dft';
import {DSPUtils} from '../../dsp/utils'
import {CSSUtils} from '../../utils/css_utils'
import {Marker, Point} from './common';
import {Component, ElementRef, ViewChild} from "@angular/core";


declare function postMessage(message: any, transfer: Array<any>): void;

const DEFAULT_DFT_SIZE = 1024;

@Component({

  selector: 'audio-sonagram',
  template: `
    <canvas #cC></canvas>
    <canvas #cursorC (mouseover)="drawCursorPosition($event, true)" (mousemove)="drawCursorPosition($event, true)"
            (mouseleave)="drawCursorPosition($event, false)"></canvas>
    <canvas #playPosC></canvas>`,

  styles: [`canvas {
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    position: absolute;
  }`]

})
export class Sonagram {

  audioData: AudioBuffer | null;
  dft: DFTFloat32;
  n: any;
  ce: HTMLDivElement;
  c: HTMLCanvasElement;
  cCursor: HTMLCanvasElement;
  cPlaypos: HTMLCanvasElement;
  @ViewChild('cC') canvasRef: ElementRef;
  @ViewChild('cursorC') cursorCRef: ElementRef;
  @ViewChild('playPosC') playPosCRef: ElementRef;
  markers: Array<Marker>;
  private _playFramePosition: number;

  private wo: Worker | null;
  private workerURL: string;
  private dftSize = DEFAULT_DFT_SIZE;

  constructor(private ref: ElementRef) {
    this.wo = null;
    this.audioData = null;
    this.markers = new Array<Marker>();
    this.dft = new DFTFloat32(this.dftSize);
    let wb = new Blob(['(' + this.workerFunction.toString() + ')();'], {type: 'text/javascript'});
    this.workerURL = window.URL.createObjectURL(wb);
  }

  ngAfterViewInit() {

    this.ce = this.ref.nativeElement;
    this.c = this.canvasRef.nativeElement;
    this.c.style.zIndex = '1';
    this.cCursor = this.cursorCRef.nativeElement;
    this.cCursor.style.zIndex = '3';
    this.cPlaypos = this.playPosCRef.nativeElement;
    this.cPlaypos.style.zIndex = '2';

  }

  get playFramePosition(): number {
    return this._playFramePosition;
  }

  set playFramePosition(playFramePosition: number) {
    this._playFramePosition = playFramePosition;
    // this.redraw();
    this.drawPlayPosition();
  }

  private canvasMousePos(c: HTMLCanvasElement, e: MouseEvent): Point {
    const cr = c.getBoundingClientRect();
    let p = new Point();
    p.x = e.x - cr.left;
    p.y = e.y - cr.top;
    return p;
  }

  drawCursorPosition(e: MouseEvent, show: boolean) {

    if (this.cCursor) {
      const w = this.cCursor.width;
      const h = this.cCursor.height;
      const g = this.cCursor.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        if (show) {
          const pp = this.canvasMousePos(this.cCursor, e);
          const offX = e.offsetX - this.cCursor.offsetLeft;
          const offY = e.offsetY - this.cCursor.offsetTop;
          const pixelPos = offX;
          g.fillStyle = 'yellow';
          g.strokeStyle = 'yellow';

          g.beginPath();
          g.moveTo(pixelPos, 0);
          g.lineTo(pixelPos, h);
          g.closePath();

          g.stroke();
          if (this.audioData) {
            var ch0 = this.audioData.getChannelData(0);
            var frameLength = ch0.length;
            var framesPerPixel = frameLength / w;
            var framePos = framesPerPixel * pixelPos;
            var framePosRound = Math.round(framePos);
            g.font = '14px sans-serif';
            g.fillStyle = 'yellow';
            g.fillText(framePosRound.toString(), pixelPos + 2, 50);
          }
        }
      }
    }
  }

  drawPlayPosition() {
    if (this.cPlaypos) {
      var w = this.cPlaypos.width;
      var h = this.cPlaypos.height;
      var g = this.cPlaypos.getContext("2d");
      if (g) {
        g.clearRect(0, 0, w, h);
        if (this.audioData && this.audioData.numberOfChannels > 0) {
          var ch0 = this.audioData.getChannelData(0);
          var frameLength = ch0.length;
          var framesPerPixel = frameLength / w;
          var pixelPos = this._playFramePosition * w / frameLength;
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

  layout() {


    var offW = this.c.offsetWidth;
    var offH = this.c.offsetHeight;
    this.layoutBounds(0, 0, offW, offH, true);
  }


  layoutBounds(left: number, top: number, offW: number, offH: number, redraw: boolean) {

    const leftStr = left.toString() + 'px';
    this.c.style.left = leftStr;
    const topStr = top.toString() + 'px';
    this.c.style.top = topStr;
    this.cCursor.style.top = topStr;
    this.cPlaypos.style.top = topStr;

    if (offW) {
      const wStr = offW.toString() + 'px';
      if (redraw) {

        this.cCursor.width = offW;
        this.cPlaypos.width = offW;
      }
      this.c.style.width = wStr;
      this.cCursor.style.width = wStr;
      this.cPlaypos.style.width = wStr;
    }
    if (offH) {
      const hStr = offH.toString() + 'px';
      if (redraw) {
        this.cCursor.height = offH;
        this.cPlaypos.height = offH;
      }
      this.c.style.height = hStr;
      this.cCursor.style.height = hStr;
      this.cPlaypos.style.height = hStr;

    }
    if (redraw) {
      //this.redraw();
      if (offW > 0) {
        if (offH > 0) {
          this.startRender(offW, offH);
        }
      }
    }
  }


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
            a += ( 1 << (this.m - i - 1));

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

    self.onmessage = function (msg) {

      let w = msg.data.w;
      let h = msg.data.h;
      let chs = msg.data.chs;
      let audioData = new Array(chs);
      for (let ch = 0; ch < chs; ch++) {
        // TODO can we use the transferred array directly?
        audioData[ch] = new Float32Array(msg.data['audioData'][ch]);
      }

      let frameLength = msg.data.frameLength;
      let dftSize = msg.data.dftSize;

      let dftBands = dftSize / 2;
      let dft = new DFTFloat32(dftSize);
      let wf = new GaussianWindow(dftSize);
      let imgData = new Uint8ClampedArray(w * h * 4);
      //console.log("Render method:");
      if (audioData) {
        let chH = Math.round(h / chs);
        let framesPerPixel = frameLength / w;
        //console.log("Render: ", w, "x", h);

        let b = new Float32Array(dftSize);
        let sona = new Array(chs);

        let maxPsd = -Infinity;
        let p = 0;
        for (let ch = 0; ch < chs; ch++) {
          p = ch * frameLength;
          let x = 0;
          sona[ch] = new Array(w);
          //let chData = this.audioData.getChannelData(ch);
          // TODO center buffer
          let framePos = 0;
          for (let pii = 0; pii < w; pii++) {
            framePos = Math.round(pii * framesPerPixel);
            // calculate DFT at pixel position
            for (let i = 0; i < dftSize; i++) {
              let chDat = audioData[ch][framePos + i];
              b[i] = chDat * wf.getScale(i);
            }
            let spectr = dft.processRealMagnitude(b);
            sona[ch][pii] = spectr;
            for (let s = 0; s < dftBands; s++) {
              let psd = (2 * Math.pow(spectr[s], 2)) / dftBands;
              if (psd > maxPsd) {
                maxPsd = psd;
              }
            }
          }
        }
        //maxPsd = (2 * Math.pow(max, 2)) / dftBands;

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
              let dataPos = ((((ch * chH ) + py) * w ) + pii) * 4;
              imgData[dataPos + 0] = rgbVal; //R
              imgData[dataPos + 1] = rgbVal; //G
              imgData[dataPos + 2] = rgbVal; //B
              imgData[dataPos + 3] = 255; //A (alpha: fully opaque)
            }
            // if (allBlack) {
            //   console.log("Black: ", pii, " ", ch);
            // }
          }
        }
      }
      postMessage({imgData: imgData, w: msg.data.w, h: msg.data.h}, [imgData.buffer]);
    }
  }

  startRender(w: number, h: number) {

    if (this.wo) {
      this.wo.terminate();
      this.wo = null;

    }
    if (this.audioData && w && h) {
      w = Math.round(w);
      h = Math.round(h);

      this.wo = new Worker(this.workerURL);

      let chs = this.audioData.numberOfChannels;

      let frameLength = this.audioData.getChannelData(0).length;
      let ada = new Array<ArrayBuffer>(chs);
      for (let ch = 0; ch < chs; ch++) {
        // Need a copy here for the worker, otherwise this.audioData is not accessible after posting to the worker
        ada[ch] = this.audioData.getChannelData(ch).buffer.slice(0);
      }
      let start = Date.now();
      if (this.wo) {
        this.wo.onmessage = (me) => {
          this.drawRendered(me);
          if (this.wo) {
            this.wo.terminate();
          }
          this.wo = null;
        }
      }
      if (this.cPlaypos) {
        let g = this.cPlaypos.getContext("2d");
        if (g) {
          g.fillText("Rendering...", 10, 20);
        }

      }
      this.wo.postMessage({audioData: ada, w: w, h: h, chs: chs, frameLength: frameLength, dftSize: this.dftSize}, ada);
    } else {
      let g = this.c.getContext("2d");
      if (g) {
        g.clearRect(0, 0, w, h);
      }
    }
  }

  drawRendered(me: MessageEvent) {
    if (this.c) {

      this.c.width = me.data.w;
      this.c.height = me.data.h;
      let g = this.c.getContext("2d");
      if (g) {
        let imgDataArr: Uint8ClampedArray = me.data.imgData;
        let imgData = g.createImageData(me.data.w, me.data.h);
        imgData.data.set(imgDataArr);
        g.putImageData(imgData, 0, 0);
      }
    }

    this.drawPlayPosition();
  }

  // synchronous draw (not used anymore)
  redraw() {

    let g = this.c.getContext("2d");

    let w = this.c.width;
    let h = this.c.height;
    if (g) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "white";
      g.fillRect(0, 0, w, h);
      if (this.audioData) {
        let spectSize = Math.floor(this.dftSize / 2)
        let chs = this.audioData.numberOfChannels;
        let chH = h / chs;

        let frameLength = this.audioData.getChannelData(0).length;

        let framesPerPixel = frameLength / w;
        let y = 0;
        // TODO
        let b = new Float32Array(this.dftSize)

        let sona = new Array<Array<Float32Array>>(chs);
        let max = 0;
        let maxPsd = -Infinity;
        for (let ch = 0; ch < chs; ch++) {
          let x = 0;
          sona[ch] = new Array<Float32Array>(w);

          let chData = this.audioData.getChannelData(ch);
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
      }
    }
  }


  setData(audioData: AudioBuffer | null) {
    this.audioData = audioData;
    this.playFramePosition = 0;
    //this.redraw();
    //this.startRender();
  }


}

