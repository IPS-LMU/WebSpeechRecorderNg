import {
  Component,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit, HostListener, ElementRef, Output, OnInit, Input,
} from '@angular/core'



import {AudioClipUIContainer} from '../ui/container'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../../action/action";
import {Position,Dimension, Rectangle} from "../../math/2d/geometry";
import {AudioClip, Selection} from "../persistor";

@Component({

  selector: 'audio-display-scroll-pane',

  template: `
   
    <app-audio #audioSignalContainer (selectionEventEmitter)="selectionChanged($event)"></app-audio>
    
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
  @Output() zoomSelectedAction:Action=new Action("Selected");
  @Output() zoomFitToPanelAction:Action=new Action("Fit to panel");
  zoomFixFitToPanelAction:Action=new Action("Fix fit to panel");


  @ViewChild(AudioClipUIContainer)
  private ac: AudioClipUIContainer;



  constructor( private ref: ElementRef) {
      this.spEl = this.ref.nativeElement;

      this.zoomInAction.onAction = (e) => {
          this.ac.fixFitToPanel = false
          let oldXZoom = this.ac.currentXZoom()
          if(oldXZoom === null){
              return;
          }
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
          let oldXZoom = this.ac.currentXZoom()
          if(oldXZoom === null){
              return;
          }
          let newXzoom = oldXZoom / 2;
          this.ac.xZoom = newXzoom;

          let cbr = new Rectangle(new Position(this.spEl.scrollLeft, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr);
          this.zoomFitToPanelAction.disabled=false
      }

      this.zoomFitToPanelAction.onAction = (e) => {

          this.zoomFitToPanelAction.disabled=true

          // set container div width to this (viewport) width
          this.ac.ce.style.width=this.spEl.offsetWidth+'px';

          this.ac.fixFitToPanel=true;

          //this.ac.clipBounds(null);
          // reset xzom which trigegrs relayout and repaint
          //this.ac.xZoom = null;
          // // reset temporary fix fit to panel
          // this.ac.fixFitToPanel=false;

      }

      this.zoomSelectedAction.onAction=(e)=>{
        alert("not implemented yet")
        this.zoomFitToPanelAction.disabled=false
      }

      }


  updateClipBounds(){
    let cbr=new Rectangle(new Position(this.spEl.scrollLeft,this.spEl.scrollTop), new Dimension(this.spEl.clientWidth,this.spEl.clientHeight));
    this.ac.clipBounds(cbr);
  }

  @HostListener('scroll', ['$event'])
  onScroll(se: Event) {
     this.updateClipBounds()
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.updateClipBounds()
  }

  layout(){
          this.ac.layout();
    }

    selectionChanged(s:Selection| null){
      this.zoomSelectedAction.disabled=(s==null)
    }

  set audioData(audioData: AudioBuffer | null) {

    this.ac.audioData=audioData;
      this.zoomOutAction.disabled=(!audioData)
      this.zoomInAction.disabled=(!audioData)
  }

  @Input()
  set audioClip(audioClip: AudioClip | null) {

    let audioData:AudioBuffer=null;
    let sel:Selection=null;
    if(audioClip){
      audioData=audioClip.buffer;
      sel=audioClip.selection;
    }

    this.ac.audioClip=audioClip
    this.zoomOutAction.disabled=(!audioData)
    this.zoomInAction.disabled=(!audioData)
  }


  set playFramePosition(framePos:number){
    this.ac.playFramePosition=framePos;
  }


}

