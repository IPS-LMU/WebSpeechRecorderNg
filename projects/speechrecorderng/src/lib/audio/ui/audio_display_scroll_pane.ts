import {
  Component,
  ViewChild,
  HostListener, ElementRef, Output, Input,
} from '@angular/core'


import {AudioClipUIContainer} from './container'
import {Action} from "../../action/action";
import {Position,Dimension, Rectangle} from "../../math/2d/geometry";
import {AudioClip, Selection} from "../persistor";
import {AudioDataHolder} from "../audio_data_holder";
import {SprBundleService} from "../../i18n/spr.bundle.service";

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
       }`
    ],
    standalone: false
})
export class AudioDisplayScrollPane {

  private spEl!:HTMLElement;

  @Output() zoomInAction:Action<void>=new Action('+');
  @Output() zoomOutAction:Action<void>=new Action('-');
  @Output() zoomSelectedAction:Action<void>=new Action(this.bs.m('c','zoom.selected'));
  @Output() zoomFitToPanelAction:Action<void>=new Action(this.bs.m('c','zoom.fit_to_panel'));
  zoomFixFitToPanelAction:Action<void>=new Action(this.bs.m('c','zoom.fix_fit_to_panel'));


  @ViewChild(AudioClipUIContainer, { static: true })
  private ac!: AudioClipUIContainer;



  constructor(
    private ref: ElementRef,
    protected bs:SprBundleService
    ) {
      this.spEl = this.ref.nativeElement;

      this.zoomInAction.onAction = (e) => {
          this.ac.fixFitToPanel = false
          const oldXZoom = this.ac.currentXZoom()
          if(oldXZoom === null){
              return;
          }

          this.ac.xZoom = oldXZoom * 2;
          let cbr = new Rectangle(new Position(this.spEl.scrollLeft, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr);
          this.zoomFitToPanelAction.disabled=false
      }
      this.zoomOutAction.onAction = (e) => {
          this.ac.fixFitToPanel = false
          const cbr1 = new Rectangle(new Position((this.spEl.scrollLeft / 2) - this.spEl.clientWidth, this.spEl.scrollTop), new Dimension(this.spEl.clientWidth, this.spEl.clientHeight));
          this.ac.clipBounds(cbr1);
          let oldXZoom = this.ac.currentXZoom()
          if(oldXZoom === null){
              return;
          }
          this.ac.xZoom = oldXZoom / 2;

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
              // reset auto fit to panel mode
              this.ac.fixFitToPanel = false

              // calculate selection length in seconds
              if(this.ac.audioData) {
                  let sr = this.ac.audioData.sampleRate;
                  let selFrLen = s.endFrame - s.startFrame;
                  let selLenInSecs = selFrLen / sr;
                  // calculate corresponding xZoom value and apply
                  this.ac.xZoom = this.spEl.clientWidth / selLenInSecs;

                  // Move viewport to show selection
                  let x1 = this.ac.frameToXPixelPosition(s.startFrame);
                  if (x1 !== null) {
                      this.spEl.scrollLeft = x1;
                  }
              }
              this.updateClipBounds()
              this.zoomFitToPanelAction.disabled = false
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

  set audioData(audioData: AudioDataHolder | null) {
    this.ac.audioData=audioData;
      this.zoomOutAction.disabled=(!audioData)
      this.zoomInAction.disabled=(!audioData)
    }


  @Input()
  set audioClip(audioClip: AudioClip | null) {

    let audioData:AudioDataHolder|null=null;
    let sel:Selection|null=null;
    if(audioClip){
      audioData=audioClip.audioDataHolder;
      sel=audioClip.selection;
      audioClip.addSelectionObserver((clip)=>{
        this.zoomSelectedAction.disabled=(clip.selection==null)
      })
    }

    this.selectionChanged(sel)
    this.ac.audioClip=audioClip
    this.zoomOutAction.disabled=(!audioData)
    this.zoomInAction.disabled=(!audioData)
      window.setTimeout(()=>{
          this.layout();
      })
  }


  set playFramePosition(framePos:number){
    this.ac.playFramePosition=framePos;
  }


}

