import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog"
import {ProjectService} from "../../../speechrecorder/project/project.service";
import {BehaviorSubject} from "rxjs";
import {AutoGainControlConfig, NoiseSuppressionConfig, Project} from "../../../speechrecorder/project/project";

@Component({
  selector: 'lib-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']

})
export class SettingsComponent implements OnInit ,AfterViewInit{

  private _bsProject:BehaviorSubject<Project>;
  mediaTrackSupportedConstraints:MediaTrackSupportedConstraints;
  agcOn=false;
  noiseSuppressionOn=false;
  captureDeviceInfos:Array<MediaDeviceInfo>|null=null;
  constructor(public dialogRef: MatDialogRef<SettingsComponent>,private projectService:ProjectService
  ) {
    this._bsProject=this.projectService.behaviourSubjectProject();
    this.mediaTrackSupportedConstraints=navigator.mediaDevices.getSupportedConstraints();
  }

  ngOnInit(): void {

  }

  ngAfterViewInit() {

    this._bsProject.subscribe((prj)=>{
      const agcCtrlCfgs=this.projectService.projectStandalone().autoGainControlConfigs;
      console.debug("AGC configs: "+agcCtrlCfgs?.length);
      this.agcOn=false;
      if(agcCtrlCfgs) {
        this.agcOn=agcCtrlCfgs.map((agcc) => (agcc.value)).reduce((prevVal,val)=>(prevVal || val),false);
      }

      navigator.mediaDevices.enumerateDevices().then((l: MediaDeviceInfo[]) => {
        this.captureDeviceInfos=l.filter((d)=>(d.kind==='audioinput'));
      });
    })
  }

  mediaDeviceInfoToStr(cdi:MediaDeviceInfo):string{
    return cdi.label?cdi.label:'<Device name>';
  }

  agcChange(ev: { checked: boolean; }){
      this.agcOn=ev.checked;
     const prj=this._bsProject.value;

      prj.autoGainControlConfigs=new Array<AutoGainControlConfig>();
     if(this.agcOn){
       prj.autoGainControlConfigs.push({platform:null,value:true});
     }
     this._bsProject.next(prj);
  }

  noiseSuppressionChange(ev: { checked: boolean; }){
    this.noiseSuppressionOn=ev.checked;
    const prj=this._bsProject.value;

    prj.noiseSuppressionConfigs=new Array<NoiseSuppressionConfig>();
    if(this.noiseSuppressionOn){
      prj.noiseSuppressionConfigs.push({platform:null,value:true});
    }
    this._bsProject.next(prj);
  }
}
