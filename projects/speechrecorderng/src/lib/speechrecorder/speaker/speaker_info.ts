import {Component, Input} from "@angular/core";
import {Speaker} from "./speaker";

@Component({

    selector: 'spr-speakerinfo',

    template: `
    <table matTooltip="Speaker data info">
        <tr><td>Speaker:</td><td style="text-align: right"><span *ngIf="speaker?.code"> {{speaker?.code}}</span> <span *ngIf="speaker?.name"> {{speaker?.name}}</span> <span *ngIf="speaker?.forename"> {{speaker?.forename}}</span> <span *ngIf="speaker?.dateOfBirth"> {{speaker?.dateOfBirth | date}}</span></td></tr>
    </table>
  `,
    styles: [`:host {
    flex: 1;
       
        background-color: white;
  }`,`table {
        width: 100%;
        border: 1px;
        background-color: lightgrey;
        font-weight: bold;
    }`]

})

export class SpeakerInfo {
    @Input() speaker:Speaker|null=null;

}
