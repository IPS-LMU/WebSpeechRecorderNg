import { Directive, ElementRef, Input } from '@angular/core';
import * as $ from 'jquery';

@Directive({ selector: '[bootstrapCollapse]' })
export class BootstrapCollapse {

  @Input() shownCb:any;
  @Input() hideCb:any;

  constructor(el: ElementRef) {

    el.nativeElement.addEventListener('shown.bs.collapse', (e) => {
      console.log("Shown bs coll event received");

      if(this.shownCb){
        this.shownCb
      }
    });

    document.addEventListener('shown.bs.collapse', function(event) {
      // if (event.target.id == 'my-id') {
      //   callback();
      // }
      console.log("Shown bs coll event (from document) received");
    });

    // el.nativeElement.on('hide.bs.collapse', (e) => {
    //   console.log("Hide bs coll event received");
    //   if(this.hideCb){
    //     this.hideCb
    //   }
    // });
  }
}
