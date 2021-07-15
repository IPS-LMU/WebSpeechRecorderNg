import {Component, Input} from "@angular/core";
import {SessionService} from "./session.service";

@Component({

  selector: 'app-warningbar',
  providers: [SessionService],
  template: `
    <div [class]="displayClass">{{warningText}}</div>

  `,
  styles: [`:host {

    flex: 0 0 content;
    background: orange;

  }`,`
    .off {
      display: none;
    }
  `,`
    .on {
      padding: 2px;
      display: inline-block;
      width: 100%;
      font-weight: bold;
      font-size: larger;
      text-align: center;
    }
  ` ]
})
export class WarningBar {
  @Input() warningText!:string;
  @Input() set show(show:boolean){
    if(show){
      this.displayClass='on'
    }else{
      this.displayClass='off'
    }
  }
  displayClass:string='off';
}
