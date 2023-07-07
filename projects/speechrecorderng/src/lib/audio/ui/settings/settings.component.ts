import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog"
import {ProjectService} from "../../../speechrecorder/project/project.service";

@Component({
  selector: 'lib-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']

})
export class SettingsComponent implements OnInit ,AfterViewInit{

  agcOn=false;
  constructor(public dialogRef: MatDialogRef<SettingsComponent>,private projectService:ProjectService
  ) { }

  ngOnInit(): void {

  }

  ngAfterViewInit() {
    const agcCtrlCfgs=this.projectService.projectStandalone().autoGainControlConfigs;
    console.debug("AGC configs: "+agcCtrlCfgs?.length);
    this.agcOn=false;
    if(agcCtrlCfgs) {
      this.agcOn=agcCtrlCfgs.map((agcc) => (agcc.value)).reduce((prevVal,val)=>(prevVal || val));
    }
  }

  agcChange(ev: { checked: boolean; }){
      this.agcOn=ev.checked;
     const prj=this.projectService.projectStandalone();
      prj.autoGainControlConfigs=new Array();
     if(this.agcOn){
       prj.autoGainControlConfigs.push({platform:null,value:true});
     }
  }

}
