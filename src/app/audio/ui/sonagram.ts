

    import { DFTFloat32 } from 'app/math/dft';
    import { DSPUtils } from 'app/dsp/utils'
    import { CSSUtils } from 'app/utils/css_utils'
    import { Marker,Point } from './common';

    declare function postMessage (message:any, transfer:Array<any>):void;

    export class Sonagram {
        canvasId:string;
        audioData:AudioBuffer;
        dft:DFTFloat32;
        n:any;
        ce:HTMLDivElement;
        c:HTMLCanvasElement;
        cCursor:HTMLCanvasElement;
        cPlaypos:HTMLCanvasElement;
        markers:Array<Marker>;
        private _playFramePosition:number;

        private wo:Worker;

        constructor(container:HTMLDivElement) {
            this.ce = container;
            this.wo = null;
            this.c = this.createCanvas();
            this.ce.appendChild(this.c);
            this.cPlaypos = this.createCanvas();
            this.ce.appendChild(this.cPlaypos);

            this.cCursor = this.createCanvas();
            this.ce.appendChild(this.cCursor);
            this.cCursor.addEventListener('mouseover', (e)=> {
                this.drawCursorPosition(e, true);
            });
            this.cCursor.addEventListener('mousemove', (e)=> {
                this.drawCursorPosition(e, true);
            }, false);
            this.cCursor.addEventListener('mouseleave', (e)=> {
                this.drawCursorPosition(e, false);
            });

            this.audioData = null;
            this.markers = new Array<Marker>();

        }

        private createCanvas():HTMLCanvasElement {
            var c = document.createElement('canvas');
            c.width = 0;
            c.height = 0;
            c.className = 'audioSignalCanvas';
            return c;
        }

        init() {
            // window.addEventListener('resize', ()=> {
            //     console.log("Window resized")
            //     this.layout();
            // });

            //window.addEventListener('ips.ui.layoutchanged', ()=>{
            //    console.log("layout event")
            //    this.redraw();
            //},false);
            this.dft = new DFTFloat32(1024);
            //this.layout();
        }

        get playFramePosition():number {
            return this._playFramePosition;
        }

        set playFramePosition(playFramePosition:number) {
            this._playFramePosition = playFramePosition;
            //this.redraw();
            this.drawPlayPosition();
        }

        private canvasMousePos(c:HTMLCanvasElement, e:MouseEvent):Point {
            var cr = c.getBoundingClientRect();
            var p = new Point();
            p.x = e.x - cr.left;
            p.y = e.y - cr.top;
            return p;
        }

        drawCursorPosition(e:MouseEvent, show:boolean) {

            if (this.cCursor) {
                var w = this.cCursor.width;
                var h = this.cCursor.height;
                var g = this.cCursor.getContext("2d");
                g.clearRect(0, 0, w, h);
                if (show) {
                    var pp = this.canvasMousePos(this.cCursor, e);
                    var offX = e.layerX - this.cCursor.offsetLeft;
                    var offY = e.layerY - this.cCursor.offsetTop;
                    var pixelPos = offX;
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

        drawPlayPosition() {
            if (this.cPlaypos) {
                var w = this.cPlaypos.width;
                var h = this.cPlaypos.height;
                var g = this.cPlaypos.getContext("2d");
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

        layout() {


            var offW = this.c.offsetWidth;
            var offH = this.c.offsetHeight;
            this.layoutBounds(0, 0, offW, offH, true);
        }


        layoutBounds(left:number, top:number, offW:number, offH:number, redraw:boolean) {

            // this.c.offsetLeft = left;
            // this.cCursor.offsetLeft = left;
            // this.cPlaypos.offsetLeft = left;

            var topStr = top.toString() + 'px';
            this.c.style.top = topStr;
            //this.cCursor.offsetTop = top;
            this.cCursor.style.top = topStr;
            //this.cPlaypos.offsetTop = top;
            this.cPlaypos.style.top = topStr;

            if (offW) {
                var wStr = offW.toString() + 'px';
                if (redraw) {

                    this.cCursor.width = offW;
                    this.cPlaypos.width = offW;
                }
                this.c.style.width = wStr;
                this.cCursor.style.width = wStr;
                this.cPlaypos.style.width = wStr;
            }
            if (offH) {
                var hStr = offH.toString() + 'px';
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

        var Complex = (function () {
          function Complex(real, img) {
            this.real = real;
            this.img = img;
          }

          Complex.prototype.magnitude = function () {
            return Math.sqrt((this.real * this.real) + (this.img * this.img));
          };
          Complex.prototype.argument = function () {
            return Math.atan2(this.img, this.real);
          };
          Complex.prototype.add = function (addC) {
            return new Complex(this.real + addC.real, this.img + addC.img);
          };
          Complex.prototype.sub = function (subC) {
            return new Complex(this.real - subC.real, this.img - subC.img);
          };
          Complex.prototype.mult = function (multC) {
            var multR = (this.real * multC.real) - (this.img * multC.img);
            var multI = (this.real * multC.img) + (multC.real * this.img);
            return new Complex(multR, multI);
          };
          Complex.prototype.multReal = function (multF) {
            return new Complex(this.real * multF, this.img * multF);
          };
          Complex.prototype.div = function (divisor) {
            var divReal = divisor.real;
            var divImg = divisor.img;
            var div = (divReal * divReal) + (divImg * divImg);
            var divisionReal = ((this.real * divReal) + (this.img * divImg)) / div;
            var divisionImg = ((divReal * this.img) - (this.real * divImg)) / div;
            return new Complex(divisionReal, divisionImg);
          };
          Complex.prototype.divReal = function (divisor) {
            var div = divisor * divisor;
            var divsionReal = (this.real * divisor) / div;
            var divsionImg = (divisor * this.img) / div;
            return new Complex(divsionReal, divsionImg);
          };
          Complex.prototype.conjugate = function () {
            return new Complex(this.real, -this.img);
          };
          Complex.prototype.equals = function (c) {
            if (c == null)
              return false;
            return (this.real == c.real && this.img == c.img);
          };
          Complex.prototype.toString = function () {
            return "Real: " + this.real + ", Img: " + this.img;
          };
          return Complex;
        }());

        // copied from TS compiler output !!
        var DFTFloat32 = (function () {
          function DFTFloat32(n) {
            this.n = n;
            this.m = Math.log(n) / Math.log(2);
            //if(n != (1 << m))throw new RuntimeException("length N must be power of 2");
            // lookup tables
            this.cosLookup = new Float32Array(n / 2);
            this.sinLookup = new Float32Array(n / 2);
            for (var i = 0; i < n / 2; i++) {
              var arc = (-2 * Math.PI * i) / n;
              this.cosLookup[i] = Math.cos(arc);
              this.sinLookup[i] = Math.sin(arc);
            }
          }
          DFTFloat32.prototype.processReal = function (srcBuf) {
            var x = srcBuf.slice();
            var y = new Float32Array(srcBuf.length);
            for (var yi = 0; yi < y.length; yi++) {
              y[yi] = 0.0;
            }
            this.fftCooleyTukey(x, y);
            var rc = new Array(x.length);
            for (var i = 0; i < x.length; i++) {
              rc[i] = new Complex(x[i], y[i]);
            }
            return rc;
          };
          DFTFloat32.prototype.processRealMagnitude = function (srcBuf) {
            var x = srcBuf.slice();
            var y = new Float32Array(srcBuf.length);
            for (var yi = 0; yi < y.length; yi++) {
              y[yi] = 0.0;
            }
            this.fftCooleyTukey(x, y);
            var rc = new Float32Array(x.length);
            for (var i = 0; i < x.length; i++) {
              var rcc = new Complex(x[i], y[i]);
              rc[i] = rcc.magnitude();
            }
            return rc;
          };
          DFTFloat32.prototype.fftCooleyTukey = function (real, img) {
            var i;
            var j = 0;
            var k;
            var n1;
            var n2 = this.n / 2;
            var a;
            var c;
            var s;
            var t1;
            var t2;
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
                a += 1 << (this.m - i - 1);
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
          };
          DFTFloat32.prototype.process = function (t) {
            var reals = new Float32Array(this.n);
            var imgs = new Float32Array(this.n);
            var trans = new Array(this.n);
            for (var i = 0; i < this.n; i++) {
              reals[i] = t[i].real;
              imgs[i] = t[i].img;
            }
            this.fftCooleyTukey(reals, imgs);
            for (var i = 0; i < this.n; i++) {
              trans[i] = new Complex(reals[i], imgs[i]);
            }
            return trans;
          };
          return DFTFloat32;
        }());

        // copied from TS compiler ourtput !!
        var GaussianWindow = (function () {
          function GaussianWindow(size) {
            var sigma = 0.3;

            this.buf = new Float32Array(size);
            var center = (size - 1) / 2;
            for (var i = 0; i < size; i++) {
              var quot = (i - center) / (sigma * center);
              var exp = -0.5 * quot * quot;
              var val = Math.exp(exp);
              this.buf[i] = val;
            }
          }
          GaussianWindow.prototype.getScale = function (i) {
            return this.buf[i];
          };

          return GaussianWindow;
        }());


        self.onmessage = function (msg) {

            // var audioDataBuf=msg.data.audioData;
          var w= msg.data.w;
          var h=msg.data.h;
          var chs= msg.data.chs;
            var audioData = new Array(chs);
            for (var ch = 0; ch < chs; ch++) {
                audioData[ch] = new Float32Array(msg.data['audioData' + ch]);
            }

          var frameLength=msg.data.frameLength;
          var dftSize=msg.data.dftSize;

          var dftBands = dftSize / 2;
          var dft = new DFTFloat32(dftSize);
          var wf = new GaussianWindow(dftSize);
          // var imgData = new ImageData(w, h);
          var imgData = new Uint8ClampedArray(w * h * 4);
          //console.log("Render method:");
          if (audioData) {
            // var chs = this.audioData.numberOfChannels;
            var chH = Math.round(h / chs);
            // var frameLength = this.audioData.getChannelData(0).length;
            var framesPerPixel = frameLength / w;
            //console.log("Render: ", w, "x", h);
            var y = 0;
            // TODO
            var b = new Float32Array(dftSize);
            var sona = new Array(chs);
            var max = 0;
            var maxPsd = -Infinity;
            var p = 0;
            for (var ch = 0; ch < chs; ch++) {
              p = ch * frameLength;
              var x = 0;
              sona[ch] = new Array(w);
              //var chData = this.audioData.getChannelData(ch);
              // TODO center buffer
              var framePos = 0;
              for (var pii = 0; pii < w; pii++) {
                  framePos = Math.round(pii * framesPerPixel);
                // calculate DFT at pixel position
                for (var i = 0; i < dftSize; i++) {
                    var chDat = audioData[ch][framePos + i];
                  b[i] = chDat * wf.getScale(i);
                }
                var spectr = dft.processRealMagnitude(b);
                sona[ch][pii] = spectr;
                for (var s = 0; s < dftBands; s++) {
                  var psd = (2 * Math.pow(spectr[s], 2)) / dftBands;
                  if (psd > maxPsd) {
                    maxPsd = psd;
                  }
                }
              }
            }
            //maxPsd = (2 * Math.pow(max, 2)) / dftBands;

            for (var ch = 0; ch < chs; ch++) {

              for (var pii = 0; pii < w; pii++) {
                var allBlack = true;
                for (var y = 0; y < chH; y++) {
                  var freqIdx = Math.round(y * dftBands / chH);
                  // calculate the one sided power spectral density PSD (f, t) in Pa2/Hz
                  // PSD(f) proportional to 2|X(f)|2 / (t2 - t1)
                  var val = sona[ch][pii][freqIdx];
                  var psd = (2 * Math.pow(val, 2)) / dftBands;
                  // Calculate logarithmic value
                  //var psdLog = ips.dsp.DSPUtils.toLevelInDB(psd / maxPsd);
                  var linearLevel=psd/maxPsd;
                  var psdLog=10 * Math.log(linearLevel) / Math.log(10);
                  // Fixed dynamic Range value of 70dB for now
                  var dynRangeInDb = 70;
                  var scaledVal = (psdLog + dynRangeInDb) / dynRangeInDb;

                  // are the following checks necessary for clamped array ?
                  if (scaledVal > 1.0)
                    scaledVal = 1;
                  if (scaledVal < 0.0) {
                    scaledVal = 0;
                  }
                  var rgbVal = Math.round(255 * scaledVal);
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
                  var py = chH - y;
                  var dataPos = ((((ch * chH ) + py) * w ) + pii) * 4;
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
          //console.log("Rendered post message");
          postMessage({imgData: imgData, w: msg.data.w, h: msg.data.h}, [imgData.buffer]);
        }
      }

        startRender(w:number, h:number) {

            if (this.wo) {
                this.wo.terminate();
                this.wo = null;

            }
            if (this.audioData && w && h) {
                w = Math.round(w);
                h = Math.round(h);



                var wb=new Blob(['('+this.workerFunction.toString()+')();'], {type: 'text/javascript'});
                var wDataUrl = window.URL.createObjectURL(wb);
                this.wo=new Worker(wDataUrl);

                var chs = this.audioData.numberOfChannels;

                var frameLength = this.audioData.getChannelData(0).length;
                var ada = new Array<ArrayBuffer>(chs);
                for (var ch = 0; ch < chs; ch++) {
                    // we need a copy here for the worker, otherwise this.audioData is not accessible after posting to the worker
                    ada[ch] = this.audioData.getChannelData(ch).buffer.slice(0);
                }
                var start = Date.now();
                this.wo.onmessage = (me) => {
                    //console.log("So rendertime: ", Date.now() - start);
                    this.drawRendered(me);
                    this.wo.terminate();
                    this.wo = null;
                }
                if (this.cPlaypos) {
                    var g = this.cPlaypos.getContext("2d");
                    g.fillText("Rendering...", 10, 20);

                }
                var postData = {
                    w: w,
                    h: h,
                    chs: chs,
                    frameLength: frameLength,
                    dftSize: 1024
                };
                for (var ch = 0; ch < chs; ch++) {
                    postData['audioData' + ch] = ada[ch];
                }
                this.wo.postMessage(postData, ada);
            } else {
                var g = this.c.getContext("2d");
                g.clearRect(0, 0, w, h);
            }
        }

        drawRendered(me:MessageEvent) {
            if (this.c) {

                this.c.width = me.data.w;
                this.c.height = me.data.h;
                var g = this.c.getContext("2d");
                var imgDataArr:Uint8ClampedArray = me.data.imgData;
                var imgData = g.createImageData(me.data.w, me.data.h);
                imgData.data.set(imgDataArr);
                g.putImageData(imgData, 0, 0);

            }

            this.drawPlayPosition();
        }

        // synchronous draw (not used anymore)
        redraw() {

            var g = this.c.getContext("2d");

            var w = this.c.width;
            var h = this.c.height;
            g.clearRect(0, 0, w, h);
            g.fillStyle = "white";
            g.fillRect(0, 0, w, h);
            if (this.audioData) {
                var chs = this.audioData.numberOfChannels;
                var chH = h / chs;

                var frameLength = this.audioData.getChannelData(0).length;

                var framesPerPixel = frameLength / w;
                var y = 0;
                // TODO
                var b = new Float32Array(1024)

                var sona = new Array<Array<Float32Array>>(chs);
                var max = 0;
                var maxPsd = -Infinity;
                for (var ch = 0; ch < chs; ch++) {
                    var x = 0;
                    sona[ch] = new Array<Float32Array>(w);

                    var chData = this.audioData.getChannelData(ch);
                    // TODO center buffer

                    var framePos = 0;
                    for (var pii = 0; pii < w; pii++) {
                        framePos = Math.round(pii * framesPerPixel);
                        // calculate DFT at pixel position
                        for (var i = 0; i < 1024; i++) {
                            var chDat = chData[framePos + i];
                            b[i] = chDat;
                        }
                        var spectr = this.dft.processRealMagnitude(b);
                        sona[ch][pii] = spectr;
                        var pMax = Math.max.apply(null, spectr);
                        if (pMax > max) {
                            max = pMax;
                        }
                        for (var s = 0; s < 512; s++) {
                            var psd = (2 * Math.pow(spectr[s], 2)) / 512;
                            if (psd > maxPsd) {
                                maxPsd = psd;
                            }
                        }
                    }
                }
                //console.log("max: ", max);
                maxPsd = (2 * Math.pow(max, 2)) / 512;
                for (var ch = 0; ch < chs; ch++) {

                    var framePos = 0;
                    for (var pii = 0; pii < w; pii++) {
                        framePos = pii * framesPerPixel;

                        for (var y = 0; y < h; y++) {
                            var freqIdx = Math.round(y * 512 / h);

                            // calculate the one sided power spectral density PSD (f, t) in Pa2/Hz
                            // PSD(f) proportional to 2|X(f)|2 / (t2 - t1)
                            var val = sona[ch][pii][freqIdx];
                            var psd = (2 * Math.pow(val, 2)) / 512;

                            // Calculate logarithmic
                            var psdLog = DSPUtils.toLevelInDB(psd / maxPsd);
                            var dynRangeInDb = 70;
                            var scaledVal = (psdLog + dynRangeInDb) / dynRangeInDb;

                            if (scaledVal > 1)
                                scaledVal = 1;
                            if (scaledVal < 0) {
                                scaledVal = 0;
                            }
                            var rgbVal = (255 * scaledVal);
                            if (rgbVal < 0) {
//							System.out.println("Neg RGB val: "+rgbVal);
                                rgbVal = 0;
                            }
                            if (rgbVal > 255) {
                                rgbVal = 255;
                            }
                            rgbVal = 255 - rgbVal;
                            // if(rgbVal<minRgbVal){
                            //     minRgbVal=rgbVal;
                            // }
                            var colorStr = CSSUtils.toColorString(rgbVal, rgbVal, rgbVal);
                            g.fillStyle = colorStr;

                            g.fillRect(pii, chH - y, 1, 1);
                        }
                    }
                }


                this.drawPlayPosition();
            }
        }


        setData(audioData:AudioBuffer) {

            this.audioData = audioData;

            this.playFramePosition = 0;
            //this.redraw();
            //this.startRender();
        }


    }

