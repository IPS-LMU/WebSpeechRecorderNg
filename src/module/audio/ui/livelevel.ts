import {ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild} from "@angular/core"
import {LevelInfos} from "../dsp/level_measure";

export const MIN_DB_LEVEL=-60.0;
export const LINE_WIDTH=2;
export const LINE_DISTANCE=2;
export const OVERFLOW_INCR_FACTOR=0.3; // TODO

@Component({

    selector: 'audio-levelbar',
    template: `
        <canvas #levelbar></canvas>
    `,
    styles: [`:host {
       
        width: 100%;
        background: darkgray;
        box-sizing:border-box;
        height: 100%;
      position: relative;
    }`,`canvas {
      top: 0;
      left: 0;
      width: 100%;
      height: 50px;
      min-height: 50px;
      position: absolute;
    }`]

})
export class LevelBar {


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
        this.layout();
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
        this.liveLevelCanvas.width=this.liveLevelCanvas.offsetWidth;
       this.liveLevelCanvas.height=this.liveLevelCanvas.offsetHeight;

        console.log("Canvas style offsetWidth: "+this.liveLevelCanvas.offsetWidth+",  width: "+this.liveLevelCanvas.width)
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
    }




    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;
        this.dbValues=new Array<Array<number>>();
        this.drawAll();
    }

    private drawLevelLine(g:CanvasRenderingContext2D,x:number,h:number,dbVal:number){

      if(dbVal>=-0.3){
        g.strokeStyle = 'red';
        g.fillStyle='red';

      }else {
        g.strokeStyle = '#00c853';
        g.fillStyle='#00c853';
      }
      g.beginPath();
      g.moveTo(x, h);
      let pVal = ((dbVal-MIN_DB_LEVEL)/-MIN_DB_LEVEL) * h;

      //console.log("Draw lvl: "+dbVal+"dB: "+x+","+pVal+" on "+w+"x"+h);
      g.lineTo(x, h-pVal);
      g.closePath();
      g.stroke();

    }

    drawPushValue(x: number, dbVals: Array<number>) {

        // TODO test cahannel 0 only
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

                for(let i=0;i<this.dbValues.length;i++) {
                    let x=i*(LINE_DISTANCE+LINE_WIDTH);

                    this.drawLevelLine(g,x,h,this.dbValues[i][0]);

                }


            }
        }
    }

}
