import {Component, Input} from "@angular/core";
import {Speaker} from "./speaker";
import {SpeakerService} from "./speaker.service";

@Component({

    selector: 'spr-speakerinfo',

    template: `
    <table matTooltip="Speakers data info">
        <tr *ngFor="let spk of speakers"><td>Speaker:</td><td style="text-align: right"><span *ngIf="spk.code"> {{spk?.code}}</span> <span *ngIf="spk.name"> {{spk.name}}</span> <span *ngIf="spk.forename"> {{spk.forename}}</span> <span *ngIf="spk.dateOfBirth"> {{spk.dateOfBirth | date}}</span></td></tr>
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
    constructor(private speakerService:SpeakerService) {

    }
    speakers:Array<Speaker>=new Array();
    private _speakerIds:Array<string|number>|undefined;

    @Input() set speakerIds(speakerIds:Array<string|number>|undefined){
        this._speakerIds=speakerIds;
        this.speakers=new Array<Speaker>();
        if(this._speakerIds) {
            this._speakerIds.forEach((spkId)=>{
                this.speakerService.speakerObservable(spkId).subscribe((spk) => {
                    this.speakers.push(spk);
                }, (err) => {
                    //
                })
            })

        }
    }

}
