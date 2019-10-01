import {CanvasLayerComponent} from "../../ui/canvas_layer_comp";
import {Selection} from '../persistor'
import {EventEmitter, Input, Output} from "@angular/core";

export abstract class AudioCanvasLayerComponent extends CanvasLayerComponent {
  audioData: AudioBuffer=null;
  _selecting: Selection =null
  @Input() set selecting(selecting:Selection){
    this._selecting=selecting
    this.drawSelecting()
  }

  get selecting():Selection{
    return this._selecting
  }

   _selection: Selection =null
  @Input() set selection(selection:Selection){
    this._selection=selection
    this.drawSelection()
  }

  get selection():Selection{
    return this._selection
  }
  abstract drawSelecting();
  abstract drawSelection();

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

  selectingChange(xFrom:number,xTo:number){
    let frameStart=this.viewPortXPixelToFramePosition(xFrom)
    let frameEnd=this.viewPortXPixelToFramePosition(xTo)
    let ns=new Selection(frameStart,frameEnd)
    this.selectingEventEmitter.emit(ns)
  }

  select(xFrom:number,xTo:number){
    let frameStart=this.viewPortXPixelToFramePosition(xFrom)
    let frameEnd=this.viewPortXPixelToFramePosition(xTo)
    let ns=new Selection(frameStart,frameEnd)
    this.selectedEventEmitter.emit(ns)
  }

}
