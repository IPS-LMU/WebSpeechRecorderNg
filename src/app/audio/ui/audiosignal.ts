import { Marker, Point } from './common'

  declare function postMessage (message: any, transfer: Array<any>): void;
  // declare function Worker (blob:Blob):void;
    export class AudioSignal {
        canvasId: string;
        audioData: AudioBuffer;
        n: any;
        ce: HTMLDivElement;
        c: HTMLCanvasElement;
        cCursor: HTMLCanvasElement;
        cPlaypos: HTMLCanvasElement;
        markers: Array<Marker>;
        private _playFramePosition: number;
        private wo: Worker;

        constructor(container: HTMLDivElement) {
            this.ce = container;
            this.wo = null;
            this.c = this.createCanvas();
            this.ce.appendChild(this.c);
            this.cPlaypos = this.createCanvas();
            this.ce.appendChild(this.cPlaypos);

            this.cCursor = this.createCanvas();
            this.ce.appendChild(this.cCursor);
            this.cCursor.addEventListener('mouseover', (e) => {
                this.drawCursorPosition(e, true);
            });
            this.cCursor.addEventListener('mousemove', (e) => {
                this.drawCursorPosition(e, true);
            }, false);
            this.cCursor.addEventListener('mouseleave', (e) => {
                this.drawCursorPosition(e, false);
            });

            this.audioData = null;
            this.markers = new Array<Marker>();

        }

        private createCanvas(): HTMLCanvasElement {
            const c = document.createElement('canvas');
            c.width = 0;
            c.height = 0;
            c.className = 'audioSignalCanvas';
            return c;
        }

        init() {


            // window.addEventListener('ips.ui.layoutchanged', ()=>{
            //    console.log("layout event")
            //    this.redraw();
            // } ,false);
            // this.layout();
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
            const p = new Point();
            p.x = e.x - cr.left;
            p.y = e.y - cr.top;
            return p;
        }

        drawCursorPosition(e: MouseEvent, show: boolean) {

            if (this.cCursor) {
                const w = this.cCursor.width;
                const h = this.cCursor.height;
                const g = this.cCursor.getContext('2d');
                g.clearRect(0, 0, w, h);
                if (show) {
                    const pp = this.canvasMousePos(this.cCursor, e);
                    const offX = e.layerX - this.cCursor.offsetLeft;
                    const offY = e.layerY - this.cCursor.offsetTop;
                    const pixelPos = offX;
                    g.fillStyle = 'yellow';
                    g.strokeStyle = 'yellow';

                    g.beginPath();
                    g.moveTo(pixelPos, 0);
                    g.lineTo(pixelPos, h);
                    g.closePath();

                    g.stroke();
                    if (this.audioData) {
                        const ch0 = this.audioData.getChannelData(0);
                        const frameLength = ch0.length;
                        const framesPerPixel = frameLength / w;
                        const framePos = framesPerPixel * pixelPos;
                        const framePosRound = Math.round(framePos);
                        g.font = '14px sans-serif';
                        g.fillStyle = 'yellow';
                        g.fillText(framePosRound.toString(), pixelPos + 2, 50);
                    }
                }

            }
        }

        drawPlayPosition() {
            if (this.cPlaypos) {
                const w = this.cPlaypos.width;
                const h = this.cPlaypos.height;
                const g = this.cPlaypos.getContext('2d');
                g.clearRect(0, 0, w, h);
                if (this.audioData && this.audioData.numberOfChannels > 0) {
                    const ch0 = this.audioData.getChannelData(0);
                    const frameLength = ch0.length;
                    const framesPerPixel = frameLength / w;
                    const pixelPos = this._playFramePosition * w / frameLength;
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

        // layout() {
        //
        //     // console.log("Container: ",ct.offsetWidth,ct.offsetHeight,ct.clientWidth,ct.clientHeight);
        //
        //     // const foo=(this.c.width!==ct.offsetWidth || this.c.height!==ct.offsetHeight);
        //
        //     const offW = this.c.offsetWidth;
        //     const offH = this.c.offsetHeight;
        //     this.layoutBounds(0, 0, offW, offH);
        // }


        layoutBounds(left: number, top: number, offW: number, offH: number, redraw: boolean) {

            // this.c.offsetLeft = left;
            // this.cCursor.offsetLeft = left;
            // this.cPlaypos.offsetLeft = left;
            //
            // this.c.offsetTop = top;
            // this.cCursor.offsetTop = top;
            // this.cPlaypos.offsetTop = top;

            if (offW) {
                const wStr = offW.toString() + 'px';
                if (redraw) {
                    // this.c.width = offW;
                    this.cPlaypos.width = offW;
                    this.cCursor.width = offW;
                }
                this.c.style.width = wStr;
                this.cCursor.style.width = wStr;
                this.cPlaypos.style.width = wStr;
            }
            if (offH) {
                const hStr = offH.toString() + 'px';
                if (redraw) {
                    // this.c.height = offH;
                    this.cCursor.height = offH;
                    this.cPlaypos.height = offH;
                }
                this.c.style.height = hStr;
                this.cCursor.style.height = hStr;
                this.cPlaypos.style.height = hStr;

            }
            if (redraw) {
                this.startRender(offW, offH);
            }
        }

      workerFunction() {
        self.onmessage = function (msg) {
            // console.log("Worker got message..");

          const audioData = msg.data.audioData;
          const w = msg.data.w;
          const h = msg.data.h;
          const chs = msg.data.chs;
          const frameLength = msg.data.frameLength;

            // console.log("Audio signal render method:");
          const psMinMax = <Float32Array>null;
          if (audioData) {
            // const chs = this.audioData.numberOfChannels;
            const chH = h / chs;
            // const frameLength = this.audioData.getChannelData(0).length;
            const framesPerPixel = frameLength / w;
              // console.log("Render audio signal: ", w, "x", h, "fraem per pixel: "+framesPerPixel);
            const y = 0;
            const std = Date.now();
            const pointsLen = w * chs;
            // one for min one for max
            const arrLen = pointsLen * 2;
            const psMinMax = new Float32Array(arrLen);
            let chFramePos = 0;
            for (let ch = 0; ch < chs; ch++) {
              const x = 0;

                chFramePos = ch * frameLength;
                // console.log("ch frame pos: "+chFramePos);
              for (let pii = 0; pii < w; pii++) {
                let pMin = Infinity;
                let pMax = -Infinity;
                  const pixelFramePos = Math.round(chFramePos + (pii * framesPerPixel));
                  // console.log("pixel frame pos: "+pixelFramePos);
                // calculate pixel min/max amplitude
                for (let ai = 0; ai < framesPerPixel; ai++) {
                    const framePos = pixelFramePos + ai;

                  // const a = this.audioData.getChannelData(ch)[framePos++];
                    const a = audioData[framePos];
                  if (a < pMin) {
                    pMin = a;
                  }
                  if (a > pMax) {
                    pMax = a;
                  }
                }

                const psMinPos = ch * w + pii;
                psMinMax[psMinPos] = pMin;
                const psMaxPos = pointsLen + psMinPos;
                psMinMax[psMaxPos] = pMax;

              }

            }
            const sd = Date.now();

              // console.log("As rendertime: ", (sd - std));
          }
            // console.log("Rendered post message");

          postMessage({psMinMax: psMinMax, w: msg.data.w, h: msg.data.h, chs: msg.data.chs}, [psMinMax.buffer]);
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

                const wb = new Blob(['(' + this.workerFunction.toString() + ')();'], {type: 'text/javascript'});
               const wDataUrl = window.URL.createObjectURL(wb);
                this.wo = new Worker(wDataUrl);

                const chs = this.audioData.numberOfChannels;

                const frameLength = this.audioData.getChannelData(0).length;
                // if(frameLength != this.audioData.getChannelData(1).length){
                //   alert("Ungleiche Länge");
                // }
                const ad = new Float32Array(chs * frameLength);
                for (let ch = 0; ch < chs; ch++) {
                    ad.set(this.audioData.getChannelData(ch), ch * frameLength);
                }
                const start = Date.now();
                this.wo.onmessage = (me) => {
                    // console.log("As rendertime: ", Date.now() - start);
                    this.drawRendered(me);
                    this.wo.terminate();
                    this.wo = null;
                }
                if (this.cPlaypos) {
                    const g = this.cPlaypos.getContext('2d');
                    g.fillStyle = 'white';
                    g.fillText('Rendering...', 10, 20);

                }
                this.wo.postMessage({w: w, h: h, chs: chs, frameLength: frameLength, audioData: ad}, [ad.buffer]);
            } else {
                const g = this.c.getContext('2d');
                g.clearRect(0, 0, w, h);
            }
        }


        drawRendered(me: MessageEvent) {

            this.c.width = me.data.w;
            this.c.height = me.data.h;
            const g = this.c.getContext('2d');
            g.clearRect(0, 0, me.data.w, me.data.h);
            g.fillStyle = 'black';
            g.fillRect(0, 0, me.data.w, me.data.h);
            const pointsLen = me.data.w * me.data.chs;
            // one for min one for max
            const arrLen = pointsLen * 2;
            if (this.audioData) {
                const std = Date.now();

                const chH = me.data.h / me.data.chs;

                let y = 0;
                for (let ch = 0; ch < me.data.chs; ch++) {
                    const x = 0;

                    const psMinPos = ch * me.data.w;
                    const psMaxPos = pointsLen + psMinPos;

                    g.fillStyle = 'green';
                    g.strokeStyle = 'green';

                    // draw audio signal as single polygon
                    g.beginPath();
                    g.moveTo(0, y + (chH / 2) + me.data.psMinMax[psMaxPos] * chH / 2);

                    for (let pii = 0; pii < me.data.w; pii++) {
                        const psMax = me.data.psMinMax[psMaxPos + pii];
                        const pv = psMax * chH / 2;
                        // console.log("Min: ",pv);
                        g.lineTo(pii, y + (chH / 2) - pv);
                    }
                    for (let pii = <number>me.data.w; pii >= 0; pii--) {
                        const psMin = me.data.psMinMax[psMinPos + pii];
                        const pv = psMin * chH / 2;
                        // console.log("Max: ",pv);
                        g.lineTo(pii, y + (chH / 2) - pv);
                    }
                    g.closePath();

                    g.fill();
                    g.stroke();
                    y += chH;
                }

                this.drawPlayPosition();
            }

        }

        redraw() {

            const g = this.c.getContext('2d');
            const w = this.c.width;
            const h = this.c.height;
            g.clearRect(0, 0, w, h);
            g.fillStyle = 'black';
            g.fillRect(0, 0, w, h);
            if (this.audioData) {
                const std = Date.now();
                const chs = this.audioData.numberOfChannels;
                const chH = h / chs;

                const frameLength = this.audioData.getChannelData(0).length;

                const framesPerPixel = frameLength / w;
                let y = 0;
                for (let ch = 0; ch < chs; ch++) {
                    const x = 0;
                    const psMin = new Float32Array(w);
                    const psMax = new Float32Array(w);
                    let framePos = 0;
                    for (let pii = 0; pii < w; pii++) {
                        let pMin = 0;
                        let pMax = 0;

                        // calculate pixel min/max amplitude
                        for (let ai = 0; ai < framesPerPixel; ai++) {
                            // const framePos=(pii*framesPerPixel)+ai;
                            const a = this.audioData.getChannelData(ch)[framePos++];

                            if (a < pMin) {
                                pMin = a;
                            }
                            if (a > pMax) {
                                pMax = a;
                            }
                        }
                        psMin[pii] = pMin;
                        psMax[pii] = pMax;
                        // console.log("Min: ", pMin, " max: ", pMax);

                    }

                    g.fillStyle = 'green';
                    g.strokeStyle = 'green';

                    // draw audio signal as single polygon
                    g.beginPath();
                    g.moveTo(0, y + (chH / 2) + psMin[0] * chH / 2);

                    for (let pii = 0; pii < w; pii++) {
                        const pv = psMin[pii] * chH / 2;
                        // console.log("Min: ",pv);
                        g.lineTo(pii, y + (chH / 2) + pv);
                    }
                    for (let pii = w; pii >= 0; pii--) {
                        const pv = psMax[pii] * chH / 2;
                        // console.log("Max: ",pv);
                        g.lineTo(pii, y + (chH / 2) + pv);
                    }
                    g.closePath();
                    // g.lineTo()
                    g.fill();
                    g.stroke();
                    g.fillStyle = 'yellow"';
                    g.stroke();
                    y += chH;
                }

                this.drawPlayPosition();
            }
        }


        setData(audioData: AudioBuffer) {
            this.audioData = audioData;
            this.playFramePosition = 0;
        }


    }

