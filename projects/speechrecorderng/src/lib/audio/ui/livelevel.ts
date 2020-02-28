import {ChangeDetectorRef, Component, ElementRef, HostListener, Input, ViewChild} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../dsp/level_measure";

export const DEFAULT_WARN_DB_LEVEL = -2;
export const MIN_DB_LEVEL = -60.0;
export const LINE_WIDTH = 2;
export const LINE_DISTANCE = 2;
export const OVERFLOW_THRESHOLD = 0.25;
export const OVERFLOW_INCR_FACTOR = 0.5;


@Component({

  selector: 'audio-levelbar',
  template: `
    <div #virtualCanvas>
      <canvas #levelbar></canvas>
      <canvas #markerCanvas></canvas>
    </div>
  `,
  styles: [`:host {

    width: 100%;
    background: darkgray;
    box-sizing: border-box;
    height: 100%;
    position: relative;
    overflow-x: scroll;
    overflow-y: auto;
  }`, `div {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    /*position: absolute;*/
    box-sizing: border-box;
  }`, `canvas {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    position: absolute;
  }`]

})
export class LevelBar implements LevelListener {

  @ViewChild('virtualCanvas', { static: true }) virtualCanvasRef: ElementRef;
  virtualCanvas: HTMLDivElement;
  @ViewChild('levelbar', { static: true }) liveLevelCanvasRef: ElementRef;
  liveLevelCanvas: HTMLCanvasElement;
  @ViewChild('markerCanvas', { static: true }) markerCanvasRef: ElementRef;
  markerCanvas: HTMLCanvasElement;
  ce: HTMLDivElement;
  dbValues: Array<Array<number>>;
  peakDbLvl = MIN_DB_LEVEL;
  private _streamingMode = false;
  private _staticLevelInfos: LevelInfos | null = null;
  private _playFramePosition: number;

  warnDBLevel = DEFAULT_WARN_DB_LEVEL;

  constructor(private ref: ElementRef, private changeDetectorRef: ChangeDetectorRef) {
    this.dbValues = new Array<Array<number>>();
  }

  ngAfterViewInit() {
    this.ce = this.ref.nativeElement;
    this.liveLevelCanvas = this.liveLevelCanvasRef.nativeElement;
    this.markerCanvas = this.markerCanvasRef.nativeElement;
    this.markerCanvas.style.zIndex = '4';
    this.virtualCanvas = this.virtualCanvasRef.nativeElement;
    this.layout();
    this.drawAll();
  }


  @HostListener('scroll', ['$event'])
  onScroll(se: Event) {
    setTimeout(()=>{
          this.updateViewportPosition()
          this.drawAll();
          this.drawPlayPosition();
      });
  }

  private updateViewportPosition(){
    // Move canvases to visible viewport position
    let viewPortStyleLeft=this.ce.scrollLeft + 'px';
    this.liveLevelCanvas.style.left = viewPortStyleLeft;
    this.markerCanvas.style.left = viewPortStyleLeft;
  }

  @Input()
  set streamingMode(streamingMode: boolean) {
    if (this._streamingMode !== streamingMode) {
      this._streamingMode = streamingMode;
      this.reset();
      this.layoutStatic();
    }
  }

  @Input()
  set displayLevelInfos(levelInfos: LevelInfos | null) {
    this._staticLevelInfos = levelInfos;
    if (levelInfos) {

      this.dbValues = levelInfos.bufferLevelInfos.map((li) => {
        return li.powerLevelsDB()
      });
    } else {
      this.dbValues = new Array<Array<number>>();
    }
    this.layoutStatic();
  }

  set channelCount(channelCount: number) {
    this.reset();
  }

  set playFramePosition(playFramePosition: number) {
    this._playFramePosition = playFramePosition;
    this.drawPlayPosition();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {

    this.layout();
    this.drawAll();
  }

  layout() {

    // set Canvas size to viewport size
    this.liveLevelCanvas.width = this.ce.offsetWidth;
    this.liveLevelCanvas.height = this.ce.offsetHeight;

    this.markerCanvas.width = this.ce.offsetWidth;
    this.markerCanvas.height = this.ce.offsetHeight;

    // and move to viewport position
    this.updateViewportPosition();

    this.drawAll();
    this.drawPlayPosition();
  }

  update(levelInfos: LevelInfo) {
    if (this._streamingMode) {
      let dbVals = levelInfos.powerLevelsDB();
      let peakDBVal = levelInfos.powerLevelDB();
      if (this.peakDbLvl < peakDBVal) {
        this.peakDbLvl = peakDBVal;
        this.changeDetectorRef.detectChanges();
      }
      this.dbValues.push(dbVals);
      let i = this.dbValues.length - 1;
      let x = i * (LINE_DISTANCE + LINE_WIDTH);
      this.drawPushValue(x, dbVals);
      this.checkWidth();
    }
  }

  streamFinished() {
    this.layoutStatic();
  }

  private layoutStatic() {

    let requiredWidth = Math.round(this.dbValues.length * (LINE_DISTANCE + LINE_WIDTH));
    if (this.virtualCanvas && this.ce) {

      this.virtualCanvas.style.width = requiredWidth + 'px';
      this.ce.scrollLeft = requiredWidth - this.ce.offsetWidth;
      this.layout();
    }

  }

  private checkWidth() {
    let requiredWidth = this.dbValues.length * (LINE_DISTANCE + LINE_WIDTH);
    if (this.virtualCanvas.offsetWidth - requiredWidth < this.ce.offsetWidth * OVERFLOW_THRESHOLD) {
      let newWidth = Math.round(this.virtualCanvas.offsetWidth + (this.ce.offsetWidth * OVERFLOW_INCR_FACTOR));
      this.virtualCanvas.style.width = newWidth + 'px';
      this.ce.scrollLeft = newWidth - this.ce.offsetWidth;

      //console.log("checkWidth: without layout()")

       // do not call layout here it is triggered by the scroll event
      //this.layout();
    }
  }

  reset() {
    this.peakDbLvl = MIN_DB_LEVEL;
    this.dbValues = new Array<Array<number>>();
    this.layout();
    this.drawAll();
    this.drawPlayPosition();
  }

  private drawLevelLine(g: CanvasRenderingContext2D, x: number, h: number, dbVal: number) {
    //translate to viewport
    let xc = x - this.ce.scrollLeft;

    if (dbVal >= this.warnDBLevel) {
      g.strokeStyle = 'red';
      g.fillStyle = 'red';

    } else {
      g.strokeStyle = '#00c853';
      g.fillStyle = '#00c853';
    }
    g.beginPath();
    g.moveTo(xc, h);
    let pVal = ((dbVal - MIN_DB_LEVEL) / -MIN_DB_LEVEL) * h;

    g.lineTo(xc, h - pVal);
    g.closePath();
    g.stroke();

  }

  private drawLevelLines(g: CanvasRenderingContext2D, x: number, h: number, dbVals: Array<number>) {
    //translate to viewport
    let xc = x - this.ce.scrollLeft;
    let chH = Math.floor(h / dbVals.length);
    for (let ch = 0; ch < dbVals.length; ch++) {
      let dbVal = dbVals[ch];
      let y = Math.floor(ch * chH);
      if (dbVal >= this.warnDBLevel) {
        g.strokeStyle = 'red';
        g.fillStyle = 'red';

      } else {
        g.strokeStyle = '#00c853';
        g.fillStyle = '#00c853';
      }
      g.beginPath();
      g.moveTo(xc, y + chH);
      let pVal = ((dbVal - MIN_DB_LEVEL) / -MIN_DB_LEVEL) * chH;

      g.lineTo(xc, y + chH - pVal);
      g.closePath();
      g.stroke();
    }
  }

  private drawPushValue(x: number, dbVals: Array<number>) {

    if (this.liveLevelCanvas) {
      let w = this.liveLevelCanvas.width;
      let h = this.liveLevelCanvas.height;
      let g = this.liveLevelCanvas.getContext("2d");
      if (g) {
        this.drawLevelLines(g, x, h, dbVals);
      }
    }
  }

  private  drawAll() {
    if (this.liveLevelCanvas) {
      let w = this.liveLevelCanvas.width;
      let h = this.liveLevelCanvas.height;
      let g = this.liveLevelCanvas.getContext("2d");
      if (g) {
        g.fillStyle = 'black';
        if (!this._streamingMode && !this._staticLevelInfos) {
          g.fillStyle = 'grey'
        }
        g.fillRect(0, 0, w, h);

        g.lineWidth = LINE_WIDTH;

        if (this.dbValues.length > 0) {
          // draw only viewport part:

          // draw from x1 to x2
          let x1 = this.ce.scrollLeft;
          let x2 = x1 + this.ce.offsetWidth;

          // corresponds to this level values:
          let i1 = Math.floor(x1 / (LINE_DISTANCE + LINE_WIDTH));
          let i2 = Math.ceil(x2 / (LINE_DISTANCE + LINE_WIDTH));
          // some values around
          i1 -= 2;
          i2 += 2;
          // limits
          if (i1 < 0) {
            i1 = 0;
          }
          if (i2 > this.dbValues.length) {
            i2 = this.dbValues.length;
          }

          var c=0;
          for (let i = i1; i < i2; i++) {
              let x = i * (LINE_DISTANCE + LINE_WIDTH);
              let dbVals = this.dbValues[i];
              if (dbVals) {
                  this.drawLevelLines(g, x, h, dbVals);
                  c++;
              }

          }
        }

      }
    }
  }


  private framesPerPixel(): number | null {
    // one buffer
    if (this._staticLevelInfos) {
      let framesPerBuffer = this._staticLevelInfos.framesPerBuffer();
      let pixelsPerBuffer = LINE_DISTANCE + LINE_WIDTH;

      let framesPerPixel=framesPerBuffer / pixelsPerBuffer;
      return framesPerPixel;
    }
    return null;
  }


  private drawPlayPosition() {
    if (this.markerCanvas) {
      let w = this.markerCanvas.width;
      let h = this.markerCanvas.height;
      let g = this.markerCanvas.getContext("2d");
      if (g) {
        g.clearRect(0, 0, w, h);
        let framesPerPixel = this.framesPerPixel();
        if (framesPerPixel && this._playFramePosition) {
          let x = this._playFramePosition / framesPerPixel;

          // Get position in viewport
          let xc = x - this.ce.scrollLeft;
          // Only draw if inside marker (viewport) canvas
          if(xc>=0 && xc<=w) {
            g.fillStyle = 'red';
            g.strokeStyle = 'red';
            g.lineWidth = LINE_WIDTH;
            g.beginPath();
            // paint over all channels
            g.moveTo(xc, 0);
            g.lineTo(xc, h);
            g.closePath();
            g.stroke();
          }
        }
      }
    }

  }


}
