
import { Marker,Point } from './common'

  declare function postMessage (message:any, transfer:Array<any>):void;
  //declare function Worker (blob:Blob):void;
    export class AudioSignal {
        canvasId:string;
        audioData:AudioBuffer;
        n:any;
        ce:HTMLDivElement;
        c:HTMLCanvasElement;
        cCursor:HTMLCanvasElement;
        cPlaypos:HTMLCanvasElement;
        markers: Array<Marker>;
        private _playFramePosition: number;
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

            this.audioData=null;
            this.markers=new Array<Marker>();

        }

        private createCanvas():HTMLCanvasElement {
            var c = document.createElement('canvas');
            c.width = 0;
            c.height = 0;
            c.className = 'audioSignalCanvas';
            c.style.top='0px';
          c.style.left='0px';
          c.style.position='absolute';
          c.style.zIndex='3';
            return c;
        }

        init(){


            //window.addEventListener('ips.ui.layoutchanged', ()=>{
            //    console.log("layout event")
            //    this.redraw();
            //},false);
            // this.layout();
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

        drawPlayPosition(){
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

        // layout() {
        //
        //     //console.log("Container: ",ct.offsetWidth,ct.offsetHeight,ct.clientWidth,ct.clientHeight);
        //
        //     //var foo=(this.c.width!==ct.offsetWidth || this.c.height!==ct.offsetHeight);
        //
        //     var offW = this.c.offsetWidth;
        //     var offH = this.c.offsetHeight;
        //     this.layoutBounds(0, 0, offW, offH);
        // }


        layoutBounds(left:number, top:number, offW:number, offH:number, redraw:boolean) {

            this.c.style.left= left.toString()+'px';
            this.cCursor.style.left = left.toString()+'px';
            this.cPlaypos.style.left = left.toString()+'px';
            this.c.style.top= top.toString()+'px';
          this.cCursor.style.top = top.toString()+'px';
          this.cPlaypos.style.top = top.toString()+'px';

            if(offW) {
                var wStr = offW.toString() + 'px';
                if (redraw) {
                    //this.c.width = offW;
                    this.cPlaypos.width = offW;
                    this.cCursor.width = offW;
                }
                this.c.style.width = wStr;
                this.cCursor.style.width = wStr;
                this.cPlaypos.style.width = wStr;
            }
            if(offH) {
                var hStr = offH.toString() + 'px';
                if (redraw) {
                    //this.c.height = offH;
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

          var audioData = msg.data.audioData;
          var w = msg.data.w;
          var h = msg.data.h;
          var chs = msg.data.chs;
          var frameLength = msg.data.frameLength;

            //console.log("Audio signal render method:");
          var psMinMax = <Float32Array>null;
          if (audioData) {
            // var chs = this.audioData.numberOfChannels;
            var chH = h / chs;
            // var frameLength = this.audioData.getChannelData(0).length;
            var framesPerPixel = frameLength / w;
              //console.log("Render audio signal: ", w, "x", h, "fraem per pixel: "+framesPerPixel);
            var y = 0;
            var std = Date.now();
            var pointsLen = w * chs;
            // one for min one for max
            var arrLen = pointsLen * 2;
            var psMinMax = new Float32Array(arrLen);
              var chFramePos = 0;
            for (var ch = 0; ch < chs; ch++) {
              var x = 0;

                chFramePos = ch * frameLength;
                //console.log("ch frame pos: "+chFramePos);
              for (var pii = 0; pii < w; pii++) {
                var pMin = Infinity;
                var pMax = -Infinity;
                  var pixelFramePos = Math.round(chFramePos + (pii * framesPerPixel));
                  //console.log("pixel frame pos: "+pixelFramePos);
                // calculate pixel min/max amplitude
                for (var ai = 0; ai < framesPerPixel; ai++) {
                    var framePos = pixelFramePos + ai;

                  //var a = this.audioData.getChannelData(ch)[framePos++];
                    var a = audioData[framePos];
                  if (a < pMin) {
                    pMin = a;
                  }
                  if (a > pMax) {
                    pMax = a;
                  }
                }

                var psMinPos = ch * w + pii;
                psMinMax[psMinPos] = pMin;
                var psMaxPos = pointsLen + psMinPos;
                psMinMax[psMaxPos] = pMax;

              }

            }
            var sd = Date.now();

              //console.log("As rendertime: ", (sd - std));
          }
            //console.log("Rendered post message");

          postMessage({psMinMax: psMinMax, w: msg.data.w, h: msg.data.h, chs: msg.data.chs}, [psMinMax.buffer]);
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
                this.wo = new Worker(wDataUrl);

                var chs = this.audioData.numberOfChannels;

                var frameLength = this.audioData.getChannelData(0).length;
                // if(frameLength != this.audioData.getChannelData(1).length){
                //   alert("Ungleiche Länge");
                // }
                var ad = new Float32Array(chs * frameLength);
                for (var ch = 0; ch < chs; ch++) {
                    ad.set(this.audioData.getChannelData(ch), ch * frameLength);
                }
                var start = Date.now();
                this.wo.onmessage = (me) => {
                    //console.log("As rendertime: ", Date.now() - start);
                    this.drawRendered(me);
                    this.wo.terminate();
                    this.wo = null;
                }
                if (this.cPlaypos) {
                    var g = this.cPlaypos.getContext("2d");
                    g.fillStyle = 'white';
                    g.fillText("Rendering...", 10, 20);

                }
                this.wo.postMessage({w: w, h: h, chs: chs, frameLength: frameLength, audioData: ad}, [ad.buffer]);
            } else {
                var g = this.c.getContext("2d");
                g.clearRect(0, 0, w, h);
            }
        }


        drawRendered(me:MessageEvent) {

            this.c.width = me.data.w;
            this.c.height = me.data.h;
            var g = this.c.getContext("2d");
            g.clearRect(0, 0, me.data.w, me.data.h);
            g.fillStyle = "black";
            g.fillRect(0, 0, me.data.w, me.data.h);
            var pointsLen = me.data.w * me.data.chs;
            // one for min one for max
            var arrLen = pointsLen * 2;
            if (this.audioData) {
                var std = Date.now();

                var chH = me.data.h / me.data.chs;

                var y = 0;
                for (var ch = 0; ch < me.data.chs; ch++) {
                    var x = 0;

                    var psMinPos = ch * me.data.w;
                    var psMaxPos = pointsLen + psMinPos;

                    g.fillStyle = 'green';
                    g.strokeStyle = 'green';

                    // draw audio signal as single polygon
                    g.beginPath();
                    g.moveTo(0, y + (chH / 2) + me.data.psMinMax[psMaxPos] * chH / 2);

                    for (var pii = 0; pii < me.data.w; pii++) {
                        var psMax = me.data.psMinMax[psMaxPos + pii];
                        var pv = psMax * chH / 2;
                        //console.log("Min: ",pv);
                        g.lineTo(pii, y + (chH / 2) - pv);
                    }
                    for (var pii = <number>me.data.w; pii >= 0; pii--) {
                        var psMin = me.data.psMinMax[psMinPos + pii];
                        var pv = psMin * chH / 2;
                        //console.log("Max: ",pv);
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

        redraw(){

            var g=this.c.getContext("2d");
            var w = this.c.width;
            var h = this.c.height;
            g.clearRect(0, 0, w,h);
            g.fillStyle = "black";
            g.fillRect(0, 0, w, h);
            if(this.audioData) {
                var std = Date.now();
                var chs = this.audioData.numberOfChannels;
                var chH = h / chs;

                var frameLength = this.audioData.getChannelData(0).length;

                var framesPerPixel = frameLength / w;
                var y = 0;
                for (var ch = 0; ch < chs; ch++) {
                    var x = 0;
                    var psMin = new Float32Array(w);
                    var psMax = new Float32Array(w);
                    var framePos = 0;
                    for (var pii = 0; pii < w; pii++) {
                        var pMin = 0;
                        var pMax = 0;

                        // calculate pixel min/max amplitude
                        for (var ai = 0; ai < framesPerPixel; ai++) {
                            //var framePos=(pii*framesPerPixel)+ai;
                            var a = this.audioData.getChannelData(ch)[framePos++];

                            if (a < pMin) {
                                pMin = a;
                            }
                            if (a > pMax) {
                                pMax = a;
                            }
                        }
                        psMin[pii] = pMin;
                        psMax[pii] = pMax;
                        //console.log("Min: ", pMin, " max: ", pMax);

                    }

                    g.fillStyle = 'green';
                    g.strokeStyle = 'green';

                    // draw audio signal as single polygon
                    g.beginPath();
                    g.moveTo(0, y + (chH / 2) + psMin[0] * chH / 2);

                    for (var pii = 0; pii < w; pii++) {
                        var pv = psMin[pii] * chH / 2;
                        //console.log("Min: ",pv);
                        g.lineTo(pii, y + (chH / 2) + pv);
                    }
                    for (var pii = w; pii >= 0; pii--) {
                        var pv = psMax[pii] * chH / 2;
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

                this.drawPlayPosition();
            }
        }


        setData(audioData:AudioBuffer) {

            this.audioData = audioData;

            this.playFramePosition = 0;


        }


    }

