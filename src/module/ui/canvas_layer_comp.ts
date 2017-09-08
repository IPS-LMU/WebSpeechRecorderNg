export abstract class CanvasLayerComponent{

  protected canvasLayers:Array<HTMLCanvasElement>;

  constructor(){

    // TODO make clear that first elemnt is background canvas
    this.canvasLayers=new Array<HTMLCanvasElement>();
  }

  layoutBounds(left: number, top: number, offW: number, offH: number, redraw: boolean) {

    //this.canvasLayers.forEach(cl=>{
    for(let ci=0;ci<this.canvasLayers.length;ci++) {
      let cl = this.canvasLayers[ci];
      cl.style.left = left.toString() + 'px';
      cl.style.top = top.toString() + 'px';
    }
      if (offW) {
        let wStr = offW.toString() + 'px';

          if (redraw) {
            // Do not set width of background canvas (causes flicker on start render)
            for(let ci=1;ci<this.canvasLayers.length;ci++) {
              let cl = this.canvasLayers[ci];
              cl.width = offW;
            }
          }
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
          let cl = this.canvasLayers[ci];
          cl.style.width = wStr;
        }
      }
      if (offH) {
        let hStr = offH.toString() + 'px';

          if (redraw) {
            // Do not set height of background canvas (causes flicker on start render)
            for(let ci=1;ci<this.canvasLayers.length;ci++) {
              let cl = this.canvasLayers[ci];
              cl.height = offH;
            }
          }
        for(let ci=0;ci<this.canvasLayers.length;ci++) {
          let cl = this.canvasLayers[ci];
          cl.style.height = hStr;
        }
      }
      //});

    if (redraw) {
      this.startRender(offW, offH);
    }
  }

  abstract startRender(offWidth:number,offsetHeight:number);
}
