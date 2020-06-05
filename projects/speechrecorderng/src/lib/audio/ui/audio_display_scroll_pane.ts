import {
  Component,
  ViewChild,
  HostListener, ElementRef, Output, Input,
} from '@angular/core'


import {AudioClipUIContainer} from '../ui/container'
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

  @Output() zoomInAction:Action<void>=new Action('+');
  @Output() zoomOutAction:Action<void>=new Action('-');
  @Output() zoomSelectedAction:Action<void>=new Action("Selected");
  @Output() zoomFitToPanelAction:Action<void>=new Action("Fit to panel");
  zoomFixFitToPanelAction:Action<void>=new Action("Fix fit to panel");


  @ViewChild(AudioClipUIContainer, { static: true })
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
      }

      this.zoomSelectedAction.onAction = (e) => {
          //alert("not implemented yet")

          let s = this.ac.selection
          if (s) {
             // this.ac.userAction = true;
              // reset auto fit to panel mode
              this.ac.fixFitToPanel = false

              // calculate selection length in seconds
              let selFrLen = s.endFrame - s.startFrame
              let selLenInSecs = selFrLen / this.ac.audioData.sampleRate
              // calculate corresponding xZoom value
              let newXZoom = this.spEl.clientWidth / selLenInSecs
              // apply xZoom
              this.ac.xZoom = newXZoom

              // Move viewport to show selection
              let x1 = this.ac.frameToXPixelPosition(s.startFrame)
              //console.debug("Set scroll left")
              this.spEl.scrollLeft = x1;
              //console.debug("Scroll left set.")
              this.updateClipBounds()
              this.zoomFitToPanelAction.disabled = false
             // this.ac.userAction = false;
          }
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
      audioClip.addSelectionObserver((clip)=>{
        this.zoomSelectedAction.disabled=(clip.selection==null)
      })
    }

    this.selectionChanged(sel)
    this.ac.audioClip=audioClip
    this.zoomOutAction.disabled=(!audioData)
    this.zoomInAction.disabled=(!audioData)
  }


  set playFramePosition(framePos:number){
    this.ac.playFramePosition=framePos;
  }


}

