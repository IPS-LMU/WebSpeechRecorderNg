import {CanvasLayerComponent} from "../../ui/canvas_layer_comp";
import {Selection} from '../persistor'
import { ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, Directive } from "@angular/core";
import {Marker} from "./common";
import {Dimension, Rectangle} from "../../math/2d/geometry";


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
  protected _audioData: AudioBuffer|null=null;
  protected _bgColor:string|null='white';
  protected _selectColor='rgba(0%,0%,100%,25%)';

  /**
   * Returns pixel position depending on current zoom setting.
   * @param framePos audio frame (sample) position
   */
  frameToXPixelPosition(framePos: number): number | null {
      let pixelPos=null;
      if (this._audioData && this._audioData.numberOfChannels > 0) {
          let ch0 = this._audioData.getChannelData(0);
          let frameLength = ch0.length;
          let vw;
          if(this.bounds) {
              vw = this.bounds.dimension.width;
          }
          if (this.virtualDimension) {
              vw = this.virtualDimension.width;
          }
          if(vw !== undefined) {
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
      let vPixelPos = this.toXViewPortPixelPosition(pixelPos);
      return vPixelPos;
    } else {
      return null;
    }
  }

    viewPortXPixelToFramePosition(xViewPortPixelPos: number): number | null {
        let vpXramePos=null;
        if (this._audioData && this._audioData.numberOfChannels > 0) {
            let ch0 = this._audioData.getChannelData(0);
            let frameLength = ch0.length;
            let vw;
            if (this.bounds) {
                vw= this.bounds.dimension.width;
            }
            if (this.virtualDimension) {
                vw = this.virtualDimension.width;
            }
            if(vw!== undefined) {
                let xVirtualPixelPos = this.toXVirtualPixelPosition(xViewPortPixelPos)
                let framesPerPixel = frameLength / vw;
                let framePos = framesPerPixel * xVirtualPixelPos;
                if (framePos < 0) {
                    framePos = 0
                }
                if (framePos >= frameLength) {
                    framePos = frameLength - 1
                }
                vpXramePos = Math.round(framePos);
            }
        }
        return vpXramePos;
    }

    layoutBounds(bounds:Rectangle, virtualDimension:Dimension,redraw: boolean) {

        this.bounds=bounds;
        this.virtualDimension=virtualDimension;
        //this.canvasLayers.forEach(cl=>{
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
            let cl = this.canvasLayers[ci];
            const leftStyle=bounds.position.left+ 'px';
            const topStyle=bounds.position.top + 'px';
            cl.style.left = leftStyle;
            cl.style.top = topStyle;
        }
        if (bounds.dimension.width) {
            let intW=Math.round(bounds.dimension.width);
            if (redraw) {
                // Do not set width of background canvas (causes flicker on start render)
                for(let ci=1;ci<this.canvasLayers.length;ci++) {
                    let cl = this.canvasLayers[ci];
                    cl.width = intW;
                }
            }
            let wStr = intW.toString() + 'px';
            for(let ci=0;ci<this.canvasLayers.length;ci++) {
                let cl = this.canvasLayers[ci];
                cl.style.width = wStr;
            }
        }
        if (bounds.dimension.height) {
            let intH=Math.round(bounds.dimension.height)
            if (redraw) {
                // Do not set height of background canvas (causes flicker on start render)
                for(let ci=1;ci<this.canvasLayers.length;ci++) {
                    let cl = this.canvasLayers[ci];
                    cl.height = intH;
                }
            }
            let hStr = intH + 'px';
            for(let ci=0;ci<this.canvasLayers.length;ci++) {
                let cl = this.canvasLayers[ci];
                cl.style.height = hStr;
            }
        }
        //});


    }
}

@Directive()
export abstract class AudioCanvasLayerComponent extends BasicAudioCanvasLayerComponent {
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

            let w = this.cursorCanvas.width;
            let h = this.cursorCanvas.height;
            let g = this.cursorCanvas.getContext("2d");

            // if (!showCursorPosition) {
            //     this.selectStartX = null
            //     this.selectingChange(null)
            // }
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

    selectingChange(viewSel:ViewSelection| null){
        let ns:Selection|undefined=undefined;
        if(viewSel) {
            let frameStart = this.viewPortXPixelToFramePosition(viewSel.startX)
            let frameEnd = this.viewPortXPixelToFramePosition(viewSel.endX)
            if(this._audioData && frameStart!=null && frameEnd!=null) {
                ns = new Selection(this._audioData.sampleRate, frameStart, frameEnd);
            }
        }
        this.selectingEventEmitter.emit(ns)
    }

    select(viewSel:ViewSelection| null){
        let ns:Selection|undefined=undefined;
        if(viewSel) {
          let frameStart = this.viewPortXPixelToFramePosition(viewSel.startX)
          let frameEnd = this.viewPortXPixelToFramePosition(viewSel.endX)
            if(this._audioData && frameStart!=null && frameEnd!=null) {
                ns = new Selection(this._audioData.sampleRate, frameStart, frameEnd);
            }
        }
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
        let sf=s.startFrame;
        let ef=s.endFrame;
        let xs=this.frameToViewPortXPixelPosition(sf)
        let xe=this.frameToViewPortXPixelPosition(ef)
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
          let w = this.bgCanvas.width;
          let h = this.bgCanvas.height;
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
            let w = this.cursorCanvas.width;
            let h = this.cursorCanvas.height;
            let g = this.cursorCanvas.getContext("2d");
            if(g) {
                g.clearRect(0, 0, w, h);
                // let s:Selection=null;
                // if(this._selecting){
                //     s=this._selecting
                // }else if(this._selection){
                //     s=this._selection
                // }
                // if(s){
                //     let sf=s.startFrame
                //     let ef=s.endFrame
                //     let xs=this.frameToViewPortXPixelPosition(sf)
                //     let xe=this.frameToViewPortXPixelPosition(ef)
                //     let sw=xe-xs
                //     g.fillStyle = 'rgba(0%,0%,100%,25%)';
                //     g.fillRect(xs,0,sw,h);
                // }

                if(this._pointerPosition){

                    let framePos=this._pointerPosition.framePosition
                    if(framePos) {
                        let xViewPortPixelpos = this.frameToViewPortXPixelPosition(framePos)
                        if (xViewPortPixelpos) {
                            //console.debug("Cursor: "+w+"x"+h+", "+xViewPortPixelpos+", FP:"+framePos);
                            g.fillStyle = 'yellow';
                            g.strokeStyle = 'yellow';
                            g.beginPath();
                            g.moveTo(xViewPortPixelpos, 0);
                            g.lineTo(xViewPortPixelpos, h);
                            g.closePath();

                            g.stroke();

                            if (this._audioData) {
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



