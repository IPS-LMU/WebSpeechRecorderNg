import {Directive, ElementRef, Input} from '@angular/core';

export interface ElementIntersection{
    observer:IntersectionObserver,
    observe:boolean
}

@Directive({
  selector: '[updateObservation]',
  standalone: true,
})
export class IntersectionObserverDirective {

  //private intersectionObserver:IntersectionObserver|null=null;
  constructor(private elRef: ElementRef) {
    const ne=this.elRef.nativeElement;
    //ne.style.backgroundColor = 'yellow';

  }

  @Input()
  set updateObservation(elIntersection:ElementIntersection){
    //console.debug("visi: "+elIntersection.selected);
    if(elIntersection.observe){
      //this.elRef.nativeElement.scrollIntoView(false);
      elIntersection.observer.observe(this.elRef.nativeElement);
    }else{
      elIntersection.observer.unobserve(this.elRef.nativeElement);
    }
  }

}
