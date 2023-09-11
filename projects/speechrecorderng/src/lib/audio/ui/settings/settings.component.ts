import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog"
import {ProjectService} from "../../../speechrecorder/project/project.service";
import {BehaviorSubject} from "rxjs";
import {AutoGainControlConfig, NoiseSuppressionConfig, Project} from "../../../speechrecorder/project/project";
import {SelectionChange} from "@angular/cdk/collections";
import {FormControl} from "@angular/forms";
import {SampleSize} from "../../impl/wavwriter";

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
  selCaptureDeviceId:string|null=null;
  selCaptureDeviceCtl=new FormControl('selCaptureDeviceId');
  selStorageSampleSizeCtl=new FormControl('selStorageSampleSize');
  constructor(public dialogRef: MatDialogRef<SettingsComponent>,private projectService:ProjectService
  ) {
    this._bsProject=this.projectService.behaviourSubjectProject();
    this.mediaTrackSupportedConstraints=navigator.mediaDevices.getSupportedConstraints();
  }

  ngOnInit(): void {
    this.selCaptureDeviceCtl.valueChanges.subscribe((selCdId)=>{
      console.debug("Sel.: dev id: "+selCdId);
      this.selCaptureDeviceId=selCdId;
      const prj=this._bsProject.value;
      prj.audioCaptureDeviceId=undefined;
      if(this.selCaptureDeviceId){
        console.debug("Sel.: dev id: "+selCdId);
        prj.audioCaptureDeviceId=this.selCaptureDeviceId;
        console.debug("Sel prj.: dev id: "+prj.audioCaptureDeviceId);
      }

      this._bsProject.next(prj);
    });
    this.selStorageSampleSizeCtl.valueChanges.subscribe((selStorageSampleSizeStr)=>{
      const prj=this._bsProject.value;
      prj.clientAudioStorageFormat=undefined;
      if(selStorageSampleSizeStr){
        const selStorageSampleSize=parseInt(selStorageSampleSizeStr);
        console.debug("Sel.: storage sample size: "+selStorageSampleSize);
        prj.clientAudioStorageFormat={sampleSizeInBits:selStorageSampleSize};
      }
      this._bsProject.next(prj);
    });
  }

  ngAfterViewInit() {

    this._bsProject.subscribe((prj)=>{
      const agcCtrlCfgs=this.projectService.projectStandalone().autoGainControlConfigs;
      console.debug("AGC configs: "+agcCtrlCfgs?.length);
      this.agcOn=false;
      if(agcCtrlCfgs) {
        this.agcOn=agcCtrlCfgs.map((agcc) => (agcc.value)).reduce((prevVal,val)=>(prevVal || val),false);
      }
      this.selCaptureDeviceId=null;
      if(prj.audioCaptureDeviceId){
        this.selCaptureDeviceId=prj.audioCaptureDeviceId;
      }
      this.selCaptureDeviceCtl.setValue(this.selCaptureDeviceId,{emitEvent:false});


      const pAf=prj.clientAudioStorageFormat;
      if(pAf){
        const pAfSs=pAf.sampleSizeInBits;
        if(pAfSs) {
          this.selStorageSampleSizeCtl.setValue(pAfSs.valueOf().toString(),{emitEvent:false});
        }
      }
      this.selCaptureDeviceCtl.setValue(this.selCaptureDeviceId,{emitEvent:false});

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

  // selectCaptureDevice(event:Event){
  //   this.selCaptureDeviceId=(event.target as HTMLSelectElement).value;
  //   const prj=this._bsProject.value;
  //   prj.audioCaptureDeviceId=this.selCaptureDeviceId;
  //   this._bsProject.next(prj);
  // }
  protected readonly SampleSize = SampleSize;
}
