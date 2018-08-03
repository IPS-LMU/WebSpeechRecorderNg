import {Dimension, Rectangle} from "../math/2d/geometry";

export abstract class CanvasLayerComponent{

  protected bounds:Rectangle;
  protected canvasLayers:Array<HTMLCanvasElement>;

  constructor(){

    // TODO make clear that first element is background canvas
    this.canvasLayers=new Array<HTMLCanvasElement>();
  }

  layoutBounds(bounds:Rectangle, virtualWidth:number,redraw: boolean) {

    //this.canvasLayers.forEach(cl=>{
    for(let ci=0;ci<this.canvasLayers.length;ci++) {
      let cl = this.canvasLayers[ci];
      const leftStyle=bounds.position.left.toString() + 'px';
      console.log("Canvas left: "+leftStyle)
      cl.style.left = bounds.position.left.toString() + 'px';
      cl.style.top = top.toString() + 'px';
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
      this.startDraw(bounds,new Dimension(virtualWidth,0));
    }
  }

  abstract startDraw(bounds:Rectangle,virtualDimension:Dimension):void;
}
