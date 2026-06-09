import {Component, ChangeDetectionStrategy} from "@angular/core";

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
         }`
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ScrollPaneHorizontal{

}
