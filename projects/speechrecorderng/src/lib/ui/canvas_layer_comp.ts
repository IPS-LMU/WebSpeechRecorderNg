import {Position,Dimension, Rectangle} from "../math/2d/geometry";

export abstract class CanvasLayerComponent{

  protected bounds:Rectangle=null;
  protected virtualDimension:Dimension;
  protected canvasLayers:Array<HTMLCanvasElement>;

  constructor(){

    // TODO make clear that first element is background canvas
    this.canvasLayers=new Array<HTMLCanvasElement>();
  }

  toXViewPortPixelPosition(virtualX:number){
    let pixelPos=virtualX;
      if(this.bounds){
          pixelPos=Math.round(virtualX-this.bounds.position.left);
      }
      return pixelPos;
  }

  toXVirtualPixelPosition(viewPortX:number){
    let pixelPos=viewPortX;
    if(this.bounds){
      pixelPos=Math.round(viewPortX+this.bounds.position.left);
    }
    return pixelPos;
  }

  toViewPortPosition(virtualPos:Position):Position{

    if(this.bounds){
      return new Position(virtualPos.left-this.bounds.position.left,virtualPos.top-this.bounds.position.top);
    }else{
      return virtualPos;
    }
  }


}
