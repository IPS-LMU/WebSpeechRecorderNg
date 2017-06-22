import { Directive, ElementRef, Input } from '@angular/core';
import * as $ from 'jquery';

@Directive({ selector: '[bootstrapCollapse]' })
export class BootstrapCollapse {

  @Input() shownCb:any;
  @Input() hideCb:any;

  constructor(el: ElementRef) {

    let asCollapseJqEl=$(el.nativeElement);
    asCollapseJqEl.on('shown.bs.collapse', (e) => {
      console.log("Shown bs coll event received");

      if(this.shownCb){
        this.shownCb
      }
    });

    asCollapseJqEl.on('hide.bs.collapse', (e) => {

      if(this.hideCb){
        this.hideCb
      }
    });
  }
}
