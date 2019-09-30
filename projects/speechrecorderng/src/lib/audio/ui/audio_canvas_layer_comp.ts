import {CanvasLayerComponent} from "../../ui/canvas_layer_comp";

export abstract class AudioCanvasLayerComponent extends CanvasLayerComponent {
  audioData: AudioBuffer | null;

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
      let xVirtualPixelPos = this.toXVirtualPixelPosition(xViewPortPixelPos)
      let framesPerPixel = frameLength / vw;
      let framePos = framesPerPixel * xVirtualPixelPos;
      let framePosRound = Math.round(framePos);
      return framePosRound;
    }
  }

}
