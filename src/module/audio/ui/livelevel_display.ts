import {ChangeDetectorRef, Component, ElementRef, Input, ViewChild} from "@angular/core"
import {LevelInfo, LevelInfos, LevelListener} from "../dsp/level_measure";
import {LevelBar} from "./livelevel";


export const MIN_DB_LEVEL=-40.0;

@Component({

    selector: 'audio-levelbardisplay',
    template: `
      <audio-levelbar [displayLevelInfos]="_displayLevelInfos"></audio-levelbar> <span> Peak: {{peakDbLvl | number:'1.1-1'}} dB </span> <md-icon>zoom_out_map</md-icon>
    `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: darkgray;
        padding:4px;
        box-sizing:border-box;
      height: 100px;
      min-height: 100px;
        display: flex; /* flex container: left level bar, right decimal peak level value */
        flex-direction: row;
        flex-wrap: nowrap; /* wrap could completely destroy the layout */
    }`,`audio-levelbar{
       flex: 1;
        box-sizing:border-box;
    }`,`span{
       flex: 0;
       font-weight: bold;
        display: inline-block;
        white-space: nowrap;
        box-sizing:border-box;
    }`]

})
export class LevelBarDisplay implements LevelListener{

    ce:HTMLDivElement;
    @ViewChild(LevelBar) liveLevel: LevelBar;

    peakDbLevelStr="-___ dB";
    peakDbLvl=MIN_DB_LEVEL;

    _displayLevelInfos:LevelInfos| null;
    constructor(private ref: ElementRef,private changeDetectorRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {
        this.ce=this.ref.nativeElement;

    }

    @Input()
    set displayLevelInfos(levelInfos:LevelInfos| null){
        this._displayLevelInfos=levelInfos;
    }

    set channelCount(channelCount:number){
       this.reset();
       this.liveLevel.channelCount=channelCount;
    }

  update(levelInfo:LevelInfo,peakLevelInfo:LevelInfo){
    //let dbVals=levelInfo.powerLevelsDB();
    let peakDBVal=levelInfo.powerLevelDB();
    if(this.peakDbLvl<peakDBVal){
      this.peakDbLvl=peakDBVal;
      // the event comes from outside of an Angular zone
      this.changeDetectorRef.detectChanges();
    }
    this.liveLevel.update(levelInfo);
  }

  streamFinished(){
    this.liveLevel.streamFinished();

  }



    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;


    }



}
