import {Component, Input} from "@angular/core";
import {Speaker} from "./speaker";

@Component({

    selector: 'spr-speakerinfo',

    template: `
    <div matTooltip="Speaker data info">
        <p>Speaker:</p>
    <p *ngIf="speaker?.code">Code: {{speaker?.code}}</p>
    </div>
  `,
    styles: [`:host {
    flex: 1;
  
  }`]

})

export class SpeakerInfo {
    @Input() speaker:Speaker|null;

}