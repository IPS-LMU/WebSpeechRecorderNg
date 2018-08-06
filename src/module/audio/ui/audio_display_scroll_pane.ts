import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit, HostListener, ElementRef, Output,
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
export class AudioDisplayScrollPane{

  private spEl:HTMLElement;

  @Output() zoomInAction:Action=new Action('+');
  @Output() zoomOutAction:Action=new Action('-');
  zoomFitToPanelAction:Action;
  zoomFixFitToPanelAction:Action;


  @ViewChild(AudioClipUIContainer)
  private ac: AudioClipUIContainer;



  constructor( private ref: ElementRef) {
  this.spEl=this.ref.nativeElement;

    this.zoomInAction.onAction=(e)=>{
      this.ac.fixFitToPanel=false
      let oldXZoom=this.ac.xZoom
      let newXzoom=oldXZoom*2;
      this.ac.xZoom=newXzoom;
    }
    this.zoomOutAction.onAction=(e)=>{
      this.ac.fixFitToPanel=false
      let oldXZoom=this.ac.xZoom
      let newXzoom=oldXZoom/2;
      this.ac.xZoom=newXzoom;
    }
  }

  @HostListener('scroll', ['$event'])
  onScroll(se: Event) {
    setTimeout(()=>{
      let cbr=new Rectangle(new Position(this.spEl.scrollLeft,this.spEl.scrollTop), new Dimension(this.spEl.clientWidth,this.spEl.clientHeight));
      this.ac.clipBounds(cbr);
    });
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

