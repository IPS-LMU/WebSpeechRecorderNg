import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit, HostListener, ElementRef,
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
    width: 1000px;
    height: 400px;

    /*position: absolute;*/
    box-sizing: border-box;
  }`]

})
export class AudioDisplayScrollPane{

  private spEl:HTMLElement;
  playStartAction: Action;
  playStopAction: Action;


  @ViewChild(AudioClipUIContainer)
  private ac: AudioClipUIContainer;



  constructor( private ref: ElementRef) {
  this.spEl=this.ref.nativeElement;
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
  }

  set playFramePosition(framePos:number){
    this.ac.playFramePosition=framePos;
  }


}

