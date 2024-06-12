import {AfterViewInit, Component, OnInit} from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog"
import {ProjectService} from "../../../speechrecorder/project/project.service";
import {BehaviorSubject, Subscription} from "rxjs";
import {
  AudioConfig,
  AudioStorageFormatEncoding,
  AutoGainControlConfig,
  EchoCancellationConfig,
  NoiseSuppressionConfig,
  Project
} from "../../../speechrecorder/project/project";
import {FormControl} from "@angular/forms";
import {SampleSize} from "../../impl/wavwriter";

import {Session} from "../../../speechrecorder/session/session";
import {SessionService} from "../../../speechrecorder/session/session.service";

@Component({
  selector: 'lib-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']

})
export class SettingsComponent implements OnInit ,AfterViewInit{

  private _bsProject:BehaviorSubject<Project>;
  private _bsPrjSubscription:Subscription|null=null;
  private _bsSession:BehaviorSubject<Session>;
  mediaTrackSupportedConstraints:MediaTrackSupportedConstraints;
  agcOn:AudioConfig|undefined=undefined;
  noiseSuppressionOn:AudioConfig|undefined=undefined;
  echoCancellationOn:AudioConfig|undefined=undefined;
  captureDeviceInfos:Array<MediaDeviceInfo>|null=null;
  selCaptureDeviceId:string|null=null;
  selCaptureDeviceCtl=new FormControl('selCaptureDeviceId');
  selChannelCountCtl=new FormControl('selChannelCount')
  ginaDb=0;
  selGainDbCtl=new FormControl('selGainDb');
  protected float:boolean=false;
  protected readonly sampleSize = SampleSize;
  selStorageTypeCtl=new FormControl('selStorageSampleSize');

  constructor(public dialogRef: MatDialogRef<SettingsComponent>,private projectService:ProjectService,private sessionService:SessionService
  ) {
    this._bsProject=ProjectService.behaviourSubjectProject();
    console.debug("Settings: Get session behavior subject for session");
    this._bsSession=SessionService.behaviourSubjectSession();
    console.debug("Settings: Got session behavior subject.")
    this.mediaTrackSupportedConstraints=navigator.mediaDevices.getSupportedConstraints();

    console.info("Supported sampleSize setting: "+this.mediaTrackSupportedConstraints.sampleSize);
  }

  ngOnInit(): void {
    this.selCaptureDeviceCtl.valueChanges.subscribe((selCdId)=>{
      console.debug("Sel.: dev id: "+selCdId);
      this.selCaptureDeviceId=null;
      if(selCdId!==null && selCdId!==''){
        this.selCaptureDeviceId=selCdId;
      }

      const prj=this._bsProject.value;
      prj.audioCaptureDeviceId=undefined;
      if(this.selCaptureDeviceId){
        console.debug("Sel.: dev id: "+selCdId);
        prj.audioCaptureDeviceId=this.selCaptureDeviceId;
        console.debug("Sel prj.: dev id: "+prj.audioCaptureDeviceId);
      }

      this._bsProject.next(prj);
    });

    this.selChannelCountCtl.valueChanges.subscribe(selChCntStr=>{
      const prj=this._bsProject.value;
      let selChCnt=1;
      if(selChCntStr) {
        selChCnt = Number.parseInt(selChCntStr);
      }
      let mcf=prj.mediaCaptureFormat;
      if(mcf){
        mcf.audioChannelCount=selChCnt;

      }else{
        mcf={audioChannelCount:selChCnt};
        prj.mediaCaptureFormat=mcf;
      }
      this._bsProject.next(prj);
    })

    this.selStorageTypeCtl.valueChanges.subscribe((selStorageTypeStr)=>{
      const prj=this._bsProject.value;
      prj.mediaStorageFormat=undefined;
      if(selStorageTypeStr!==null && selStorageTypeStr!==''){
        if(selStorageTypeStr==='FLOAT'){
          console.debug("Sel.: storage sample type float.");
          prj.mediaStorageFormat={audioEncoding:AudioStorageFormatEncoding.PCM_FLOAT};
        }else {
          const selStorageSampleSize = parseInt(selStorageTypeStr);
          console.debug("Sel.: storage sample size: " + selStorageSampleSize);
          prj.mediaStorageFormat = {audioPCMsampleSizeInBits: selStorageSampleSize};
        }
      }
      //this._bsProject.unsubscribe();
      this._bsProject.next(prj);
    });

    this.selGainDbCtl.valueChanges.subscribe((selGainDbStr)=>{
      const sess=this._bsSession.value;
      console.debug("Gain dB changed: "+selGainDbStr);
      sess.audioCaptureGainDb=undefined;
      sess.audioCaptureGain=undefined;

      if(selGainDbStr!==null && selGainDbStr!==''){
        const newGainDb=Number.parseFloat(selGainDbStr);
        sess.audioCaptureGainDb=newGainDb;
        sess.audioCaptureGain=Math.pow(10, (newGainDb/10));
        console.debug("Gain changed: "+sess.audioCaptureGainDb+" dB");
      }
      //this._bsProject.unsubscribe();
      this._bsSession.next(sess);
      console.debug("Session update");
    });
  }

  ngAfterViewInit() {

    //this._bsPrjSubscription=this._bsProject.subscribe((prj)=>{
    const prj=this._bsProject.value;
    const sess=this._bsSession.value;

    let audioChCnt=1;
    const mcf=prj.mediaCaptureFormat;
    if(mcf && mcf.audioChannelCount!==null){
      audioChCnt=mcf.audioChannelCount;
    }
      const agcCtrlCfgs=this.projectService.projectStandalone().autoGainControlConfigs;
      const nsCtrlCfgs=this.projectService.projectStandalone().noiseSuppressionConfigs;
      const ecCtrlCfgs=this.projectService.projectStandalone().echoCancellationConfigs;
      console.debug("AGC configs: "+agcCtrlCfgs?.length);
      this.agcOn=undefined;
      if(agcCtrlCfgs) {
        //this.agcOn=agcCtrlCfgs.map((agcc) => (agcc)).reduce((prevVal,val)=>(prevVal || val),false);
        for(let agcCtrlCfg of agcCtrlCfgs){
            if(agcCtrlCfg.platform){
              // TODO match ?
            }else{
              this.agcOn=agcCtrlCfg;
              break;
            }
        }
      }
      this.noiseSuppressionOn=undefined;
      if(nsCtrlCfgs) {
        //this.noiseSuppressionOn=nsCtrlCfgs.map((nsc) => (nsc.value)).reduce((prevVal,val)=>(prevVal || val),false);
        if(nsCtrlCfgs){
          for(let nsCtrlCfg of nsCtrlCfgs){
            if(nsCtrlCfg.platform){
              // TODO
            }else{
              this.noiseSuppressionOn=nsCtrlCfg;
            }
          }
        }
      }
      this.echoCancellationOn=undefined;
      if(ecCtrlCfgs) {
        //this.echoCancellationOn=ecCtrlCfgs.map((esc) => (esc.value)).reduce((prevVal,val)=>(prevVal || val),false);
        for(let ecCtrlCfg of ecCtrlCfgs){
          if(ecCtrlCfg.platform){
            // TODO match ?
          }else{
            this.echoCancellationOn=ecCtrlCfg;
            break;
          }
        }
      }

      this.selCaptureDeviceId=null;
      let selCaptureDevIdStr='';
      if(prj.audioCaptureDeviceId){
        this.selCaptureDeviceId=prj.audioCaptureDeviceId;
        selCaptureDevIdStr=this.selCaptureDeviceId;
      }
      this.selCaptureDeviceCtl.setValue(selCaptureDevIdStr,{emitEvent:false});

      this.selChannelCountCtl.setValue(audioChCnt.toString(),{emitEvent:false});

      const gainDb=sess.audioCaptureGainDb;
      if(gainDb!==undefined){
        this.selGainDbCtl.setValue(gainDb.toString());
      }else{
        this.selGainDbCtl.setValue("0");
      }

      let selAfSs='';
      const pAf=prj.mediaStorageFormat;
      if(pAf){
        if(AudioStorageFormatEncoding.PCM_FLOAT===pAf.audioEncoding){
          selAfSs='FLOAT';
        }else {
          const pAfSs = pAf.audioPCMsampleSizeInBits;
          if (pAfSs) {
            selAfSs = pAfSs.valueOf().toString();
          }
        }
      }
      this.selStorageTypeCtl.setValue(selAfSs,{emitEvent:false});

      navigator.mediaDevices.enumerateDevices().then((l: MediaDeviceInfo[]) => {
        this.captureDeviceInfos=l.filter((d)=>(d.kind==='audioinput'));
        console.debug("Set capture device infos:");
        for(let cdi of this.captureDeviceInfos){
          console.debug(cdi.deviceId+' '+cdi.label+' '+cdi.kind+' '+cdi.groupId);
        }
        let selCaptureDevIdStr='';
        if(this.selCaptureDeviceId){
          selCaptureDevIdStr=this.selCaptureDeviceId;
        }
        this.selCaptureDeviceCtl.setValue(selCaptureDevIdStr,{emitEvent:false});

      });
    //})
  }

  mediaDeviceInfoToStr(cdi:MediaDeviceInfo):string{
    return cdi.label?cdi.label:'<Device name>';
  }

  agcChange(aCfg:AudioConfig){
      this.agcOn=aCfg;
     const prj=this._bsProject.value;

      prj.autoGainControlConfigs=new Array<AutoGainControlConfig>();
     if(this.agcOn){
       //prj.autoGainControlConfigs.push({platform:null,value:this.agcOn.value,constraintType:this.agcOn.constraintType});
       prj.autoGainControlConfigs.push(this.agcOn);
     }
     this._bsProject.next(prj);
  }

  noiseSuppressionChange(aCfg:AudioConfig){
    this.noiseSuppressionOn=aCfg;
    const prj=this._bsProject.value;

    prj.noiseSuppressionConfigs=new Array<NoiseSuppressionConfig>();
    if(this.noiseSuppressionOn){
      prj.noiseSuppressionConfigs.push(this.noiseSuppressionOn);
    }
    this._bsProject.next(prj);
  }

  echoCancellationChange(aCfg:AudioConfig){
    this.echoCancellationOn=aCfg;
    const prj=this._bsProject.value;

    prj.echoCancellationConfigs=new Array<EchoCancellationConfig>();
    if(this.echoCancellationOn){
      //prj.echoCancellationConfigs.push({platform:null,value:this.echoCancellationOn.value,constraintType:this.echoCancellationOn.constraintType});
      prj.echoCancellationConfigs.push(this.echoCancellationOn);
    }
    this._bsProject.next(prj);
  }

  // selectCaptureDevice(event:Event){
  //   this.selCaptureDeviceId=(event.target as HTMLSelectElement).value;
  //   const prj=this._bsProject.value;
  //   prj.audioCaptureDeviceId=this.selCaptureDeviceId;
  //   this._bsProject.next(prj);
  // }


}
