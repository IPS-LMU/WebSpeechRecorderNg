import {CanvasLayerComponent} from "../../ui/canvas_layer_comp";
import {Selection} from '../persistor'
import {ElementRef, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {Marker} from "./common";


export class ViewSelection{
  get startX(): number {
    return this._startX;
  }

  get endX(): number {
    return this._endX;
  }

  constructor(private _startX:number, private _endX:number){}
}

export abstract class AudioCanvasLayerComponent extends CanvasLayerComponent {
  audioData: AudioBuffer=null;
  _pointerPosition:Marker=null;

  protected selectStartX:number=null;

  @ViewChild('cursor') cursorCanvasRef: ElementRef;
  cursorCanvas: HTMLCanvasElement;

  @Input() set pointerPosition(pointerPosition:Marker){
    this._pointerPosition=pointerPosition
    this.drawCursorLayer()
  }

  _selecting: Selection =null
  @Input() set selecting(selecting:Selection| null){
    this._selecting=selecting
    this.drawCursorLayer()
  }

  get selecting():Selection{
    return this._selecting
  }

   _selection: Selection =null
  @Input() set selection(selection:Selection){
    this._selection=selection
    this.drawCursorLayer()
  }

  get selection():Selection{
    return this._selection
  }

    selectionStart(me:MouseEvent){
      //this.select(null);
      this.selectStartX=me.offsetX;
    }

    selectionCommit(me:MouseEvent){
      let vs:ViewSelection=null;
        if(this.selectStartX) {
            vs=new ViewSelection(this.selectStartX,me.offsetX)
        }
        this.selectStartX=null;
      this.select(vs);
    }

    updateCursorCanvas(me:MouseEvent=null,showCursorPosition=true){
        if (this.cursorCanvas) {
            let w = this.cursorCanvas.width;
            let h = this.cursorCanvas.height;
            let g = this.cursorCanvas.getContext("2d");

            if (!showCursorPosition) {
                this.selectStartX = null
                this.selectingChange(null)
            }
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

  frameToViewPortXPixelPosition(framePos: number): number | null {
    if (this.audioData && this.audioData.numberOfChannels > 0) {
      let ch0 = this.audioData.getChannelData(0);
      let frameLength = ch0.length;
      let vw = this.bounds.dimension.width;
      if (this.virtualDimension) {
        vw = this.virtualDimension.width;
      }
      let vPixelPos = framePos * vw / frameLength;
      let pixelPos = this.toXViewPortPixelPosition(vPixelPos);
      return pixelPos;
    } else {
      return null;
    }
  }

  viewPortXPixelToFramePosition(xViewPortPixelPos: number): number | null {
    if (this.audioData && this.audioData.numberOfChannels > 0) {
      let ch0 = this.audioData.getChannelData(0);
      let frameLength = ch0.length;
      let vw = this.bounds.dimension.width;
      if (this.virtualDimension) {
        vw = this.virtualDimension.width;
      }
      let xVirtualPixelPos=this.toXVirtualPixelPosition(xViewPortPixelPos)
      let framesPerPixel = frameLength / vw;
      let framePos = framesPerPixel * xVirtualPixelPos;
      let framePosRound = Math.round(framePos);
      return framePosRound;
    }
  }

  pointerPositionChanged(xPosition:number| null){
    let pointerPosition:Marker=null
    if(xPosition){
      pointerPosition=new Marker()
      pointerPosition.framePosition=this.viewPortXPixelToFramePosition(xPosition)
    }
    this.pointerPositionEventEmitter.emit(pointerPosition)
  }

  selectingChange(viewSel:ViewSelection| null){
    let ns:Selection=null
    if(viewSel) {
      let frameStart = this.viewPortXPixelToFramePosition(viewSel.startX)
      let frameEnd = this.viewPortXPixelToFramePosition(viewSel.endX)
      ns = new Selection(frameStart, frameEnd)
    }
    this.selectingEventEmitter.emit(ns)
  }

    select(viewSel:ViewSelection| null){
      let ns:Selection=null
      if(viewSel) {
        let frameStart = this.viewPortXPixelToFramePosition(viewSel.startX)
        let frameEnd = this.viewPortXPixelToFramePosition(viewSel.endX)
        ns = new Selection(frameStart, frameEnd)
      }
        this.selectedEventEmitter.emit(ns)
    }

    drawCursorLayer(){
        if (this.cursorCanvas) {
            let w = this.cursorCanvas.width;
            let h = this.cursorCanvas.height;
            let g = this.cursorCanvas.getContext("2d");
            if(g) {
                g.clearRect(0, 0, w, h);
                let s:Selection=null;
                if(this._selecting){
                    s=this._selecting
                }else if(this._selection){
                    s=this._selection
                }
                if(s){
                    let sf=s.startFrame
                    let ef=s.endFrame
                    let xs=this.frameToViewPortXPixelPosition(sf)
                    let xe=this.frameToViewPortXPixelPosition(ef)
                    let sw=xe-xs
                    g.fillStyle = 'rgba(0%,0%,100%,25%)';
                    g.fillRect(xs,0,sw,h);
                }

                if(this._pointerPosition){

                    let framePos=this._pointerPosition.framePosition
                    if(framePos) {
                      let xViewPortPixelpos = this.frameToViewPortXPixelPosition(framePos)

                      g.fillStyle = 'yellow';
                      g.strokeStyle = 'yellow';
                      g.beginPath();
                      g.moveTo(xViewPortPixelpos, 0);
                      g.lineTo(xViewPortPixelpos, h);
                      g.closePath();

                      g.stroke();
                      if (this.audioData) {
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
