import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog"
import {ProjectService} from "../../../speechrecorder/project/project.service";
import {BehaviorSubject} from "rxjs";
import {Project} from "../../../speechrecorder/project/project";

@Component({
  selector: 'lib-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']

})
export class SettingsComponent implements OnInit ,AfterViewInit{

  private _bsProject:BehaviorSubject<Project>;
  agcOn=false;
  constructor(public dialogRef: MatDialogRef<SettingsComponent>,private projectService:ProjectService
  ) {
    this._bsProject=this.projectService.behaviourSubjectProject();
  }

  ngOnInit(): void {

  }

  ngAfterViewInit() {

    this._bsProject.subscribe((prj)=>{
      const agcCtrlCfgs=this.projectService.projectStandalone().autoGainControlConfigs;
      console.debug("AGC configs: "+agcCtrlCfgs?.length);
      this.agcOn=false;
      if(agcCtrlCfgs) {
        this.agcOn=agcCtrlCfgs.map((agcc) => (agcc.value)).reduce((prevVal,val)=>(prevVal || val));
      }
    })

  }

  agcChange(ev: { checked: boolean; }){
      this.agcOn=ev.checked;
     const prj=this._bsProject.value;

      prj.autoGainControlConfigs=new Array();
     if(this.agcOn){
       prj.autoGainControlConfigs.push({platform:null,value:true});
     }
     this._bsProject.next(prj);
  }

}
