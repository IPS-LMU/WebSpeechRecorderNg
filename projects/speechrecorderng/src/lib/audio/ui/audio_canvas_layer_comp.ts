import {CanvasLayerComponent} from "../../ui/canvas_layer_comp";
import {Selection} from '../persistor'
import { ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, Directive } from "@angular/core";
import {Marker} from "./common";
import {Dimension, Rectangle} from "../../math/2d/geometry";
import {AudioDataHolder} from "../audio_data_holder";


export class ViewSelection{
  get startX(): number {
    return this._startX;
  }

  get endX(): number {
    return this._endX;
  }

  width():number{
    return this._endX-this._startX
  }

  constructor(private _startX:number, private _endX:number){}
}

@Directive()
export abstract class BasicAudioCanvasLayerComponent extends CanvasLayerComponent {
  protected _audioDataHolder:AudioDataHolder| null=null;
  protected _bgColor:string|null='white';
  protected _selectColor='rgba(0%,0%,100%,25%)';

  /**
   * Returns pixel position depending on current zoom setting.
   * @param framePos audio frame (sample) position
   */
  frameToXPixelPosition(framePos: number): number | null {
    let pixelPos=null;
    let frameLength = this._audioDataHolder?.frameLen;

    if(frameLength!==undefined) {
      let vw;
      if (this.bounds) {
        vw = this.bounds.dimension.width;
      }
      if (this.virtualDimension) {
        vw = this.virtualDimension.width;
      }
      if (vw !== undefined) {
        pixelPos = framePos * vw / frameLength;
      }
    }
    return pixelPos;
  }

  /**
   * Returns pixel position in view port (visible window of scroll pane).
   * @param framePos audio frame (sample) position
   */
  frameToViewPortXPixelPosition(framePos: number): number | null {
    let pixelPos=this.frameToXPixelPosition(framePos);
    if(pixelPos!=null){
      return this.toXViewPortPixelPosition(pixelPos);
    } else {
      return null;
    }
  }

  viewPortXPixelToFramePosition(xViewPortPixelPos: number): number | null {
    let vpXframePos=null;
    const frameLength = this._audioDataHolder?.frameLen;
    if(frameLength!==undefined) {
      let vw:number|undefined=undefined;
      if (this.bounds) {
        vw= this.bounds.dimension.width;
      }
      if (this.virtualDimension) {
        vw = this.virtualDimension.width;
      }
      if(vw!== undefined) {
        const xVirtualPixelPos = this.toXVirtualPixelPosition(xViewPortPixelPos)
        const framesPerPixel = frameLength / vw;
        let framePos = framesPerPixel * xVirtualPixelPos;
        if (framePos < 0) {
          framePos = 0
        }
        if (framePos >= frameLength) {
          framePos = frameLength - 1
        }
        vpXframePos = Math.round(framePos);
      }
    }
    return vpXframePos;
  }

    layoutBounds(bounds:Rectangle, virtualDimension:Dimension,redraw: boolean) {
        this.bounds=bounds;
        this.virtualDimension=virtualDimension;
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
            const cl = this.canvasLayers[ci];
            const leftStyle=bounds.position.left+ 'px';
            if(cl.style.left!=leftStyle) {
              cl.style.left = leftStyle;
            }
            const topStyle=bounds.position.top + 'px';
            if(cl.style.top!=topStyle) {
              cl.style.top = topStyle;
            }
        }
        if (bounds.dimension.width) {
            const intW=Math.floor(bounds.dimension.width);
            if (redraw) {
                // Do not set width of background canvas (causes flicker on start render)
                for(let ci=1;ci<this.canvasLayers.length;ci++) {
                    let cl = this.canvasLayers[ci];
                    if(cl.width!=intW) {
                      cl.width = intW;
                    }
                }
            }
            const wStr = intW.toString() + 'px';
            for(let ci=0;ci<this.canvasLayers.length;ci++) {
                let cl = this.canvasLayers[ci];
                if(cl.style.width!=wStr) {
                  cl.style.width = wStr;
                }
            }
        }
        if (bounds.dimension.height) {
            const intH=Math.floor(bounds.dimension.height)
            if (redraw) {
                // Do not set height of background canvas (causes flicker on start render)
                for(let ci=1;ci<this.canvasLayers.length;ci++) {
                    let cl = this.canvasLayers[ci];
                    if(cl.height!=intH) {
                      cl.height = intH;
                    }
                }
            }
            const hStr = intH + 'px';
            for(let ci=0;ci<this.canvasLayers.length;ci++) {
                let cl = this.canvasLayers[ci];
                if(cl.style.height!=hStr){
                  cl.style.height = hStr;
                }
            }
        }
    }
}

@Directive()
export abstract class AudioCanvasLayerComponent extends BasicAudioCanvasLayerComponent {

    protected static readonly ENABLE_STREAMING_NUMBER_OF_SAMPLES_THRESHOLD=10*60*48000;  // Use streaming/chunking if audio clip has more than this number of samples

    _pointerPosition:Marker|null=null;

    protected selectStartX:number|null=null;

    @ViewChild('bg', { static: true }) bgCanvasRef!: ElementRef;
    bgCanvas!: HTMLCanvasElement;

    @ViewChild('cursor', { static: true }) cursorCanvasRef!: ElementRef;
    cursorCanvas!: HTMLCanvasElement;

  @HostListener('document:mouseup', ['$event'])
  onMouseup(me: MouseEvent) {
    this.selectionCommit(me)
  }

    layoutBounds(bounds:Rectangle, virtualDimension:Dimension,redraw: boolean,clear:boolean=true) {
        super.layoutBounds(bounds,virtualDimension,redraw)
        if (redraw) {
            this.startDraw(clear);
        }
    }

    @Input() set pointerPosition(pointerPosition:Marker|null){
        this._pointerPosition=pointerPosition
        this.drawCursorLayer()
    }

    _selecting: Selection|null =null;
    @Input() set selecting(selecting:Selection| null){
        this._selecting=selecting
        this.drawBg()
        this.drawCursorLayer()
    }

    get selecting():Selection|null{
        return this._selecting
    }

    _selection: Selection|null =null
    @Input() set selection(selection:Selection|null){
        this._selection=selection;
        this.selecting=null;
        this.drawBg()
        this.drawCursorLayer()
    }

    get selection():Selection|null{
        return this._selection
    }

    selectionStart(me:MouseEvent){
        this.selectStartX=me.offsetX;
    }

    selectionCommit(me:MouseEvent){
        let vs:ViewSelection|null=null;
        if(this.selectStartX!=null) {
          vs=new ViewSelection(this.selectStartX,me.offsetX)
          this.selectStartX=null;
          this.select(vs);
        }
    }

    abstract startDraw(clear:boolean):void;

    updateCursorCanvas(me:MouseEvent,showCursorPosition=true){
        if (this.cursorCanvas) {
            if (me) {
                if (this.selectStartX) {
                    this.pointerPositionChanged(null)
                    this.selectingChange(new ViewSelection(this.selectStartX, me.offsetX));
                } else {
                    if (showCursorPosition) {
                        this.pointerPositionChanged(me.offsetX)
                    }else{
                        this.pointerPositionChanged(null)
                    }
                }
            }
        }
    }

    @Output() pointerPositionEventEmitter = new EventEmitter<Marker>();
    @Output() selectingEventEmitter = new EventEmitter<Selection>();
    @Output() selectedEventEmitter = new EventEmitter<Selection>();


    pointerPositionChanged(xPosition:number| null){
        let pointerPosition:Marker|undefined=undefined;
        if(xPosition){
            pointerPosition=new Marker();
            let vpXPos=this.viewPortXPixelToFramePosition(xPosition);
            if(vpXPos!=null) {
                pointerPosition.framePosition =vpXPos;
            }
        }
        this.pointerPositionEventEmitter.emit(pointerPosition);
    }

    private _selectingChange(viewSel:ViewSelection| null):Selection|undefined {
      let ns: Selection | undefined = undefined;
      if (viewSel) {
        let frameStart = this.viewPortXPixelToFramePosition(viewSel.startX)
        let frameEnd = this.viewPortXPixelToFramePosition(viewSel.endX)
        if (this._audioDataHolder && frameStart != null && frameEnd != null) {
          ns = new Selection(this._audioDataHolder.sampleRate, frameStart, frameEnd);
        }
      }
      return ns;
    }

    selectingChange(viewSel:ViewSelection| null){
        const ns=this._selectingChange(viewSel);
        this.selectingEventEmitter.emit(ns)
    }

    select(viewSel:ViewSelection| null){
        const ns=this._selectingChange(viewSel);
        this.selectedEventEmitter.emit(ns)
    }

    viewSelection():ViewSelection|null{
      let vs:ViewSelection|null=null;
      let s:Selection|null=null;
      if(this._selecting){
        s=this._selecting
      }else if(this._selection){
        s=this._selection
      }
      if(s){
        const sf=s.startFrame;
        const ef=s.endFrame;
        const xs=this.frameToViewPortXPixelPosition(sf)
        const xe=this.frameToViewPortXPixelPosition(ef)
          if(xs!=null && xe!=null) {
              vs = new ViewSelection(xs, xe)
          }
      }
      return vs;
    }


  drawBg(){
      if(this.bgCanvas && this.bounds) {
          this.bgCanvas.style.left = Math.round(this.bounds.position.left).toString() + 'px';
          this.bgCanvas.width = Math.round(this.bounds.dimension.width);
          this.bgCanvas.height = Math.round(this.bounds.dimension.height);
        let g1 = this.bgCanvas.getContext("2d");
        if (g1) {
          const w = this.bgCanvas.width;
          const h = this.bgCanvas.height;
          g1.clearRect(0, 0, w, h);
          if(this._bgColor) {
            g1.fillStyle = this._bgColor;
            g1.fillRect(0, 0, w, h);
          }
          let vs = this.viewSelection()
          if (vs) {
            g1.fillStyle = this._selectColor;
            g1.fillRect(vs.startX, 0, vs.width(), h);
          }
        }
      }
  }
    drawCursorLayer(){
        if (this.cursorCanvas) {
            const w = this.cursorCanvas.width;
            const h = this.cursorCanvas.height;
            const g = this.cursorCanvas.getContext("2d");
            if(g) {
                g.clearRect(0, 0, w, h);
                if(this._pointerPosition){
                    let framePos=this._pointerPosition.framePosition
                    if(framePos) {
                        let xViewPortPixelpos = this.frameToViewPortXPixelPosition(framePos)
                        if (xViewPortPixelpos) {

                            g.fillStyle = 'yellow';
                            g.strokeStyle = 'yellow';
                            g.beginPath();
                            g.moveTo(xViewPortPixelpos, 0);
                            g.lineTo(xViewPortPixelpos, h);
                            g.closePath();

                            g.stroke();

                            if (this._audioDataHolder) {
                                g.font = '14px sans-serif';
                                g.fillStyle = 'yellow';
                                g.fillText(framePos.toString(), xViewPortPixelpos + 2, 50);
                            }
                        }
                    }
                }
            }
        }
    }

}



