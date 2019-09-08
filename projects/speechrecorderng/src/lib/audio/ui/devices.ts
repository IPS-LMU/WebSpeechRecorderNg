import {Component, EventEmitter, Input, Output} from "@angular/core";

@Component({
    selector: 'audio-devicechooser',
    template: `
        <mat-form-field style="width:100%">
            <mat-label>{{label}}</mat-label>
            <select  matNativeControl [(ngModel)]="selectedDeviceId" name="selectedDeviceId" [disabled]="disabled">
                <option   *ngFor="let mediaDeviceInfo of mediaDeviceInfos" [value]="mediaDeviceInfo.deviceId" >
                    {{mediaDeviceInfo.label}}
                </option>
            </select>
        </mat-form-field>
    `,
    styles: [`:host {
        flex: 1
  }`,`devSelect{
        max-width:1000px;
        width: 1000px;
        min-width: 1000px;
    }`]
})
export class DeviceChooser{
    @Input() mediaDeviceInfos:MediaDeviceInfo[]
    @Input() disabled=false
    @Input() label:string
    private   _selectedDeviceId:string=null
    @Output() selectedDeviceEventEmitter=new EventEmitter<string | null>()

    set selectedDeviceId(selDevId:string| null){
        this._selectedDeviceId=selDevId
        console.log("Set device ID: "+selDevId)
        this.selectedDeviceEventEmitter.emit(selDevId)
    }

    @Input() get selectedDeviceId():string| null{
        return this._selectedDeviceId
    }
}