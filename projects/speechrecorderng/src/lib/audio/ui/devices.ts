import {Component, Input} from "@angular/core";

@Component({
    selector: 'audio-devicechooser',
    template: `
        <mat-form-field>
            <mat-label></mat-label>
            <mat-select>
                <mat-option *ngFor="let info of mediaDeviceInfos" [value]="info.deviceId">
                    {{info.label}}
                </mat-option>
            </mat-select>
        </mat-form-field>
    `,
    styles: [`:host {
  }`]
})
export class DeviceChooser{
    @Input() mediaDeviceInfos:MediaDeviceInfo[]
}