import {AfterContentInit, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl} from "@angular/forms";
import {AudioConfig, ConstraintType} from "../../../../speechrecorder/project/project";

@Component({
  selector: 'audio-config-switch',
  templateUrl: './audio-config-switch.component.html',
  styleUrls: ['./audio-config-switch.component.css']
})
export class AudioConfigSwitchComponent implements OnInit,AfterContentInit {

  audioCfgCtl=new FormControl('audioCfg');

  constructor() {
    this.audioCfgCtl.valueChanges.subscribe((valStr: string|null) => {
      let aCfg: AudioConfig|undefined=undefined;
      console.debug("valStr: "+valStr);
      if(valStr===null){
        aCfg=undefined;
      }else if (valStr === '') {
        aCfg=undefined;
      }else if (valStr === 'true_ideal') {
        aCfg = {value: true, constraintType: ConstraintType.Ideal, platform: null};
      } else if (valStr === 'false_ideal') {
        aCfg = {value: false, constraintType: ConstraintType.Ideal, platform: null};
      } else if (valStr === 'true_exact') {
        aCfg = {value: true, constraintType: ConstraintType.Exact, platform: null};
      } else if (valStr === 'false_exact') {
        aCfg = {value: false, constraintType: ConstraintType.Exact, platform: null};
      } else if (valStr === 'true') {
        aCfg = {value: true, constraintType: undefined, platform: null};
      } else if (valStr === 'false') {
        aCfg = {value: false, constraintType: undefined, platform: null};
      }
      this.change.emit(aCfg);
    });
  }

  ngAfterContentInit() {

  }

  ngOnInit(): void {
  }

  @Input()
  set audioCfg(audioCfg:AudioConfig|undefined){
    let valStr='';
    if(audioCfg){
      if(audioCfg.constraintType==='IDEAL'){
        if(audioCfg.value){
          valStr='true_ideal';
        }else{
          valStr='false_ideal';
        }
      }else if(audioCfg.constraintType==='EXACT'){
        if(audioCfg.value){
          valStr='true_exact';
        }else{
          valStr='false_exact';
        }
      }else{
        if(audioCfg.value){
          valStr='true';
        }else{
          valStr='false';
        }
      }
    }else{
      valStr='';
    }

    this.audioCfgCtl.setValue(valStr,{emitEvent:false});
  }

  @Output() change: EventEmitter<AudioConfig> = new EventEmitter<AudioConfig>();

}
