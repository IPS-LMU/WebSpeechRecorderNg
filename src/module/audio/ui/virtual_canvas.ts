import {ChangeDetectorRef, Component, ComponentFactoryResolver, ElementRef, ViewContainerRef} from "@angular/core";
import {LevelInfos, LevelListener} from "../dsp/level_measure";
import {DEFAULT_WARN_DB_LEVEL, MIN_DB_LEVEL} from "./livelevel";

@Component({

  selector: 'virtual-canvas',
  template: `
   <canvas></canvas>
   
  `,
  styles: [`:host {
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
export class VirtualCanvas {
  vcEl: HTMLDivElement;


  constructor(private ref: ViewContainerRef,private compFactResolver:ComponentFactoryResolver) {

  }

  ngAfterViewInit() {

   var compFact=this.compFactResolver.resolveComponentFactory(BaseCanvas);
   var compRef=this.ref.createComponent(compFact);

  }
}


@Component({

  selector: 'base-canvas',
  template: `
    <canvas></canvas>
  `,
  styles: [`:host {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    position: absolute;
  }`]

})
export class BaseCanvas {
  constructor(private ref: ElementRef) {

  }
  ngAfterViewInit() {
    let canvasEl=<HTMLCanvasElement>this.ref.nativeElement;
    let gc=<CanvasRenderingContext2D>canvasEl.getContext("2D");
    gc.fillRect(20,20,200,300);
  }

}


@Component({

  selector: 'virtual-canvas-test',
  template: `
    <virtual-canvas></virtual-canvas>
  `,
  styles: [`:host {
    top: 0;
    left: 0;
    width: 500px;
    height: 300px;

    /*position: absolute;*/
    box-sizing: border-box;
  }`]

})
export class VirtualCanvasTest {



  constructor() {

  }

  ngAfterViewInit() {


  }
}
