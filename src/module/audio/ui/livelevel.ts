import {ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild} from "@angular/core"
import {LevelInfos} from "../dsp/level_measure";

export const MIN_DB_LEVEL=-40.0;

@Component({

    selector: 'audio-livelevel',
    template: `
        <canvas #liveLevel></canvas> <span> Peak: {{peakDbLvl | number:'1.1-1'}} dB </span>
    `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        /*height: 44px;
        min-height: 44px; */
        
        background: darkgray;
        padding:4px;
        box-sizing:border-box;
        /* margin: 10px; */  /* causes scroll bar */
        height: 54px;
        min-height: 54px;
        max-height: 54px;
        display: flex; /* flex container: left traffic light, right prompter (container) */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`,`canvas {
        flex:1;
        top: 0px;
        left: 0px;
        width: 100%;
        
        /*height: 40px;
        max-height: 40px; */
        position: relative;
        box-sizing:border-box;
    }`,`span{
       flex: 0;
       font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing:border-box;
    }`]

})
export class LiveLevelDisplay {


    @ViewChild('liveLevel') liveLevelCanvasRef: ElementRef;
    liveLevelCanvas: HTMLCanvasElement;
    ce:HTMLDivElement;
    dbValues: Array<Array<number>>;
    peakDbLevelStr="-___ dB";
    peakDbLvl=MIN_DB_LEVEL;
    bla=false;

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
    onResize(event) {

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
        let x=i*2;
        this.drawPushValue(x,dbVals);
    }




    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;
        this.dbValues=new Array<Array<number>>();
        this.drawAll();
    }

    drawPushValue(x: number, dbVals: Array<number>) {

        // TODO test cahannel 0 only
        let dbVal=dbVals[0];
        if (this.liveLevelCanvas) {
            let w = this.liveLevelCanvas.width;
            let h = this.liveLevelCanvas.height;
            let g = this.liveLevelCanvas.getContext("2d");
            if (g) {
                //g.lineWidth=1;
                //g.fillStyle = 'green';
                if(dbVal>=-0.3){
                    g.strokeStyle = 'red';
                }else {
                    g.strokeStyle = '#00c853';
                }
                g.beginPath();
                g.moveTo(x, h);
                let pVal = ((dbVal-MIN_DB_LEVEL)/-MIN_DB_LEVEL) * h;
                //console.log("Draw lvl: "+dbVal+"dB: "+x+","+pVal+" on "+w+"x"+h);
                g.lineTo(x, h-pVal);
                g.closePath();

                g.stroke();
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
                //g.fillStyle = 'green';
                g.strokeStyle = '#00c853';
                for(let i=0;i<this.dbValues.length;i++) {
                    let x=i*2;
                    g.beginPath();
                    g.moveTo(x,h);
                    // TODO test channel 0 only
                    let dbVal=this.dbValues[i][0];
                    let pVal = ((dbVal-MIN_DB_LEVEL)/-MIN_DB_LEVEL) * h;
                    g.lineTo(x,h-pVal );
                    g.closePath();
                    g.stroke();
                }
            }
        }
    }

}
