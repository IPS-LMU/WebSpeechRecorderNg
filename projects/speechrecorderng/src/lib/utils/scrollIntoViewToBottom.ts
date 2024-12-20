

import {Directive, ElementRef, Input} from "@angular/core";
@Directive({
    selector: "[scrollIntoViewToBottom]",
    standalone: false
})
export class ScrollIntoViewDirective{

  constructor(private elRef:ElementRef){}
  @Input()
  set scrollIntoViewToBottom(siv:boolean){
      if(siv){
        this.elRef.nativeElement.scrollIntoView(false);
      }
  }

}
