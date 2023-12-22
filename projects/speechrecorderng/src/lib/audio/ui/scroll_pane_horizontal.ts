import {Component} from "@angular/core";

@Component({

  selector: 'scroll-pane-horizontal',
  template: '',
  styles: [
    `:host {
           width: 100%;
           background: darkgray;
           box-sizing: border-box;
           height: 100%;
           position: relative;
           overflow-x: scroll;
           overflow-y: auto;
         }`]

})
export class ScrollPaneHorizontal{

}
