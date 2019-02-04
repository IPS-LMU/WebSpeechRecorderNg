import {AfterViewInit, Component, Inject} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import * as ts from "typescript/lib/tsserverlibrary";

import {ActivatedRoute, Params, Route} from "@angular/router";
import {ProjectService} from "../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit{
  sprVersion=VERSION;
  title='SpeechRecorder Angular PWA Demo'
  shortTitle='SpeechRecorder'

  constructor(private projectService:ProjectService) {
  }

  ngAfterViewInit(){

  }

  get projectName():string|null{
    let selPrj=this.projectService.selectedProject
    if(selPrj){
      return selPrj.name;
    }else{
      return null;
    }
  }
}
