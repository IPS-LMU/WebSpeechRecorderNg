import {ChangeDetectorRef, Component, ElementRef,  ViewChild} from "@angular/core"
import {LevelInfos} from "../dsp/level_measure";
import {LevelBar} from "./livelevel";

export const MIN_DB_LEVEL=-40.0;

@Component({

    selector: 'audio-levelbardisplay',
    template: `
      <audio-levelbar></audio-levelbar> <span> Peak: {{peakDbLvl | number:'1.1-1'}} dB </span>
    `,
    styles: [`:host {
        flex: 0; /* only required vertical space */
        width: 100%;
        background: darkgray;
        padding:4px;
        box-sizing:border-box;
        height: 58px;
        min-height: 58px;
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
export class LevelBarDisplay {

    ce:HTMLDivElement;
    @ViewChild(LevelBar) liveLevel: LevelBar;
    peakDbLevelStr="-___ dB";
    peakDbLvl=MIN_DB_LEVEL;
    bla=false;

    constructor(private ref: ElementRef,private changeDetectorRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {
        this.ce=this.ref.nativeElement;

    }

    set channelCount(channelCount:number){
       this.reset();
       this.liveLevel.channelCount=channelCount;
    }

  update(levelInfos:LevelInfos){
    let dbVals=levelInfos.powerLevelsDB();
    let peakDBVals=levelInfos.powerLevelsDB();
    if(this.peakDbLvl<peakDBVals[0]){
      this.peakDbLvl=peakDBVals[0];
      // the event comes from outside of an Angular zone
      this.changeDetectorRef.detectChanges();
    }
    this.liveLevel.update(levelInfos);
  }



    reset(){
        this.peakDbLvl=MIN_DB_LEVEL;


    }



}
