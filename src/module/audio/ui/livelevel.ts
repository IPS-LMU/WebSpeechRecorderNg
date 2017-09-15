import {ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild} from "@angular/core"
import {LevelInfos, LevelListener} from "../dsp/level_measure";

export const MIN_DB_LEVEL=-60.0;
export const LINE_WIDTH=2;
export const LINE_DISTANCE=2;
export const OVERFLOW_INCR_FACTOR=0.75; // TODO

@Component({

    selector: 'audio-levelbar',
    template: `
      <div #virtualCanvas><canvas #levelbar></canvas></div>
    `,
    styles: [`:host {
       
        width: 100%;
        background: darkgray;
        box-sizing:border-box;
       height: 100%;
      position: relative;
      overflow-x: scroll;
      overflow-y:auto;
    }`,`div {
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      
      /*position: absolute;*/
      box-sizing:border-box;
    }`,`canvas {
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      position: absolute;
    }`]

})
export class LevelBar implements LevelListener{

    @ViewChild('virtualCanvas') virtualCanvasRef: ElementRef;
    virtualCanvas:HTMLDivElement;
    @ViewChild('levelbar') liveLevelCanvasRef: ElementRef;
    liveLevelCanvas: HTMLCanvasElement;
    ce:HTMLDivElement;
    dbValues: Array<Array<number>>;

    peakDbLvl=MIN_DB_LEVEL;

    constructor(private ref: ElementRef,private changeDetectorRef: ChangeDetectorRef) {
        this.dbValues=new Array<Array<number>>();
    }

    ngAfterViewInit() {
        this.ce=this.ref.nativeElement;
        this.liveLevelCanvas = this.liveLevelCanvasRef.nativeElement;
        this.virtualCanvas=this.virtualCanvasRef.nativeElement;
        this.layout();
        this.drawAll();
    }

    @HostListener('scroll',['$event'])
    onScroll(se:Event){
      console.log("Host div scroll event: "+se);
      // se.preventDefault();
      // se.stopImmediatePropagation();
      // se.stopPropagation();
      this.liveLevelCanvas.style.left=this.ce.scrollLeft+'px';
      //this.liveLevelCanvas.style.height=offH;
      this.drawAll();
    }

    set channelCount(channelCount:number){
       this.reset();
    }

    @HostListener('window:resize', ['$event'])
    onResize(event:Event) {

        this.layout();
        //this.liveLevelCanvas.style.height=offH;
        this.drawAll();
    }

    layout(){
        // let offW=this.ce.offsetWidth.toString() + 'px';
        // let offH=this.ce.offsetHeight.toString() + 'px';
        // this.liveLevelCanvas.width=this.ce.offsetWidth;
        // this.liveLevelCanvas.height=this.ce.offsetHeight;
        // this.liveLevelCanvas.style.width=offW;
        // this.liveLevelCanvas.style.height=offH;


      // set Canvas size to viewport size
        this.liveLevelCanvas.width=this.ce.offsetWidth;
       this.liveLevelCanvas.height=this.ce.offsetHeight;

       // and move to viewport position
       this.liveLevelCanvas.style.left=this.ce.scrollLeft+'px';
        this.drawAll();
       // console.log("Canvas style offsetWidth: "+this.liveLevelCanvas.offsetWidth+",  width: "+this.liveLevelCanvas.width)
    }

    update(levelInfos:LevelInfos){
        let dbVals=levelInfos.powerLevelsDB();
        let peakDBVals=levelInfos.powerLevelsDB();
        if(this.peakDbLvl<peakDBVals[0]){
            this.peakDbLvl=peakDBVals[0];
            //this.peakDbLevelStr=this.peakDbLvl+" dB";
            this.changeDetectorRef.detectChanges();
        }
        this.dbValues.push(dbVals);
        let i=this.dbValues.length-1;
        let x=i*(LINE_DISTANCE+LINE_WIDTH);
        this.drawPushValue(x,dbVals);

        this.checkWidth();

    }

    streamFinished(){
      console.log("Stream finished");
      let requiredWidth=this.dbValues.length*(LINE_DISTANCE+LINE_WIDTH);

        this.virtualCanvas.style.width=requiredWidth+'px';
        this.ce.scrollLeft=requiredWidth-this.ce.offsetWidth;
        this.layout();

    }

    checkWidth(){
      let requiredWidth=this.dbValues.length*(LINE_DISTANCE+LINE_WIDTH);
      if(this.virtualCanvas.offsetWidth<requiredWidth){
        let newWidth=Math.round(requiredWidth+(this.ce.offsetWidth*OVERFLOW_INCR_FACTOR));
        this.virtualCanvas.style.width=newWidth+'px';
        this.ce.scrollLeft=newWidth-this.ce.offsetWidth;
        this.layout();
      }
    }


    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;
        this.dbValues=new Array<Array<number>>();
        this.layout();
        this.drawAll();
    }

    private drawLevelLine(g:CanvasRenderingContext2D,x:number,h:number,dbVal:number){
      //translate to viewport
      let xc=x-this.ce.scrollLeft;

      if(dbVal>=-0.3){
        g.strokeStyle = 'red';
        g.fillStyle='red';

      }else {
        g.strokeStyle = '#00c853';
        g.fillStyle='#00c853';
      }
      g.beginPath();
      g.moveTo(xc, h);
      let pVal = ((dbVal-MIN_DB_LEVEL)/-MIN_DB_LEVEL) * h;

      //console.log("Draw lvl: "+dbVal+"dB: "+x+","+pVal+" on "+w+"x"+h);
      g.lineTo(xc, h-pVal);
      g.closePath();
      g.stroke();

    }

    drawPushValue(x: number, dbVals: Array<number>) {

        // TODO test channel 0 only
        let dbVal=dbVals[0];
        if (this.liveLevelCanvas) {
            let w = this.liveLevelCanvas.width;
            let h = this.liveLevelCanvas.height;
            let g = this.liveLevelCanvas.getContext("2d");
            if (g) {

              this.drawLevelLine(g,x,h,dbVal);


            }
        }
    }

    drawAll(){
        if (this.liveLevelCanvas) {


            let w = this.liveLevelCanvas.width;
            let h = this.liveLevelCanvas.height;
            let g = this.liveLevelCanvas.getContext("2d");
            if (g) {
                g.fillStyle='black';
                g.fillRect(0, 0, w, h);

                g.lineWidth=LINE_WIDTH;

                if(this.dbValues.length>0) {
                  // draw only viewport part:

                  // draw from x1 to x2
                  let x1 = this.ce.scrollLeft;
                  let x2 = x1 + this.ce.offsetWidth;

                  // corresponds to this level values:
                  let i1 = Math.floor(x1 / (LINE_DISTANCE + LINE_WIDTH));
                  let i2 = Math.ceil(x2 / (LINE_DISTANCE + LINE_WIDTH));
                  // some values around
                  i1 -= 2;
                  i2 += 2;
                  // limits
                  if (i1 < 0) {
                    i1 = 0;
                  }
                  if (i2 > this.dbValues.length) {
                    i2 = this.dbValues.length;
                  }

                    for (let i = i1; i < i2; i++) {
                      let x = i * (LINE_DISTANCE + LINE_WIDTH);
                      let dbVals=this.dbValues[i];
                      if(dbVals) {
                        this.drawLevelLine(g, x, h,dbVals[0]);
                      }

                    }

                }

            }
        }
    }

}
