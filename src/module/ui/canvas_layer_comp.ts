import {Position,Dimension, Rectangle} from "../math/2d/geometry";

export abstract class CanvasLayerComponent{

  protected bounds:Rectangle;
  protected virtualDimension:Dimension;
  protected canvasLayers:Array<HTMLCanvasElement>;

  constructor(){

    // TODO make clear that first element is background canvas
    this.canvasLayers=new Array<HTMLCanvasElement>();
  }

  toViewPortPosition(virtualPos:Position):Position{

    if(this.bounds){
      return new Position(virtualPos.left-this.bounds.position.left,virtualPos.top-this.bounds.position.top);
    }else{
      return virtualPos;
    }
  }

  layoutBounds(bounds:Rectangle, virtualDimension:Dimension,redraw: boolean,clear?:boolean) {

    this.bounds=bounds;
    this.virtualDimension=virtualDimension;
    //this.canvasLayers.forEach(cl=>{
    for(let ci=0;ci<this.canvasLayers.length;ci++) {
      let cl = this.canvasLayers[ci];
      const leftStyle=bounds.position.left.toString() + 'px';
        const topStyle=bounds.position.top.toString() + 'px';
      cl.style.left = leftStyle;
      cl.style.top = topStyle;
    }
      if (bounds.dimension.width) {
        let wStr = bounds.dimension.width.toString() + 'px';

          if (redraw) {
            // Do not set width of background canvas (causes flicker on start render)
            for(let ci=1;ci<this.canvasLayers.length;ci++) {
              let cl = this.canvasLayers[ci];
              cl.width = bounds.dimension.width;

            }
          }
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
          let cl = this.canvasLayers[ci];
          cl.style.width = wStr;
        }
      }
      if (bounds.dimension.height) {
        let hStr = bounds.dimension.height.toString() + 'px';

          if (redraw) {
            // Do not set height of background canvas (causes flicker on start render)
            for(let ci=1;ci<this.canvasLayers.length;ci++) {
              let cl = this.canvasLayers[ci];
              cl.height = bounds.dimension.height;
            }
          }
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
          let cl = this.canvasLayers[ci];
          cl.style.height = hStr;
        }
      }
      //});

    if (redraw) {
      this.startDraw(clear);
    }
  }

  abstract startDraw(clear:boolean):void;
}
