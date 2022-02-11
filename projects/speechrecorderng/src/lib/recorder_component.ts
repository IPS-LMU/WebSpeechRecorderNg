import {FitToPageComponent} from "./ui/fit_to_page_comp";
import {Directive, Injector, OnInit} from "@angular/core";

@Directive()
export abstract class RecorderComponent extends FitToPageComponent implements OnInit {

  constructor(protected injector: Injector) {
    super(injector);
  }

  ngOnInit() {
    super.ngOnInit();
  }

  abstract ready():boolean;

}
