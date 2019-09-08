import {Component, Input} from "@angular/core";
import {Speaker} from "./speaker";

@Component({

    selector: 'spr-speakerinfo',

    template: `
    <div matTooltip="Speaker data info">
        Speaker: <span *ngIf="speaker?.code"> {{speaker?.code}}</span> <span *ngIf="speaker?.name"> {{speaker?.name}}</span> <span *ngIf="speaker?.forename"> {{speaker?.forename}}</span> <span *ngIf="speaker?.dateOfBirth"> {{speaker?.dateOfBirth | date}}</span>
    </div>
  `,
    styles: [`:host {
    flex: 1;
        padding: 10pt;
        background-color: white;
  }`,`div {
        border: 1px;
        background-color: lightgrey;
        font-weight: bolder;
    }`]

})

export class SpeakerInfo {
    @Input() speaker:Speaker|null;

}