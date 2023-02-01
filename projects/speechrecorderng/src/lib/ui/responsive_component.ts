import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";

export class ResponsiveComponent {

  screenXs = false;

  constructor(protected breakpointObserver: BreakpointObserver) {
    breakpointObserver
      .observe([
        Breakpoints.XSmall
      ])
      .subscribe(result => {
        this.screenXs = (result.matches);
        //console.debug("Screen XS: "+this.screenXs);
      });
  }

}
