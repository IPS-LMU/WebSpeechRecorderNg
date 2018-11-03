import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, HostListener, ElementRef, Output, OnInit,
} from '@angular/core'



import {AudioClipUIContainer} from '../ui/container'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../../action/action";
import {Position,Dimension, Rectangle} from "../../math/2d/geometry";

@Component({

  selector: 'audio-display-scroll-pane',

  template: `
   
    <app-audio #audioSignalContainer></app-audio>
    
  `,
  styles: [
    `:host {
      flex: 2;
      width: 100%;
      background: darkgray;
      box-sizing: border-box;
      height: 100%;
      position: relative;
      overflow-x: scroll;
      overflow-y: auto;
    }`,
    `app-audio {

    margin: 0; 
    padding: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    /*position: absolute;*/
    box-sizing: border-box;
  }`]

})
export class AudioDisplayScrollPane {

  private spEl:HTMLElement;

  @Output() zoomInAction:Action=new Action('+');
  @Output() zoomOutAction:Action=new Action('-');
  @Output() zoomFitToPanelAction:Action=new Action("Fit to panel");
  zoomFixFitToPanelAction:Action=new Action("Fix fit to panel");


  @ViewChild(AudioClipUIContainer)
  private ac: AudioClipUIContainer;



  constructor( private ref: ElementRef) {
      this.spEl = this.ref.nativeElement;

      this.zoomInAction.onAction = (e) => {
          this.ac.fixFitToPanel = false
          let oldXZoom = this.ac.xZoom
          let newXzoom = oldXZoom * 2;
          this.ac.xZoom = newXzoom;

          let cbr = new Rectangle(new Position(this.spEl.scrollLeft, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr);
          this.zoomFitToPanelAction.disabled=false
      }
      this.zoomOutAction.onAction = (e) => {
          this.ac.fixFitToPanel = false
          let cbr1 = new Rectangle(new Position((this.spEl.scrollLeft / 2) - this.spEl.clientWidth, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr1);
          let oldXZoom = this.ac.xZoom
          let newXzoom = oldXZoom / 2;
          this.ac.xZoom = newXzoom;

          let cbr = new Rectangle(new Position(this.spEl.scrollLeft, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr);
          this.zoomFitToPanelAction.disabled=false
      }

      this.zoomFitToPanelAction.onAction = (e) => {
            //set temporary to fit fit to panel TODO should not be avoided
          this.ac.fixFitToPanel=true;
          // set container div width to this (viewport) width
          this.ac.ce.style.width=this.spEl.offsetWidth+'px';
          // we don't need  clip bounds
          this.ac.clipBounds(null);
          // reset xzom which trigegrs relayout and repaint
          this.ac.xZoom = null;
          // reset temporyr fix fit to panel
          this.ac.fixFitToPanel=false;
          this.zoomFitToPanelAction.disabled=true
      }

  }

  @HostListener('scroll', ['$event'])
  onScroll(se: Event) {
    setTimeout(()=>{
      let cbr=new Rectangle(new Position(this.spEl.scrollLeft,this.spEl.scrollTop), new Dimension(this.spEl.clientWidth,this.spEl.clientHeight));
      this.ac.clipBounds(cbr);
    });
  }

  layout(){
          this.ac.layout();
    }

  set audioData(audioData: AudioBuffer | null) {
    this.ac.audioData=audioData;
    if(audioData){
      this.zoomOutAction.disabled=false
      this.zoomInAction.disabled=false
    }
  }

  set playFramePosition(framePos:number){
    this.ac.playFramePosition=framePos;
  }


}

