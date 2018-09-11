

import {Directive, ElementRef, Input} from "@angular/core";
@Directive({
  selector: "[scrollIntoView]"
})
export class ScrollIntoViewDirective{

  constructor(private elRef:ElementRef){}
  @Input()
  set scrollIntoView(siv:boolean){
      if(siv){
        this.elRef.nativeElement.scrollIntoView(false);
      }
  }
}
