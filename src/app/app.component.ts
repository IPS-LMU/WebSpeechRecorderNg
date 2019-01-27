import {AfterViewInit, Component, Inject} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import * as ts from "typescript/lib/tsserverlibrary";
import ProjectService = ts.server.ProjectService;
import {ActivatedRoute, Params, Route} from "@angular/router";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit{
  sprVersion=VERSION;
  title='SpeechRecorder Angular PWA Demo'
  shortTitle='SpeechRecorder'
  projectName:string;
  constructor(private route:ActivatedRoute) {
  }

  ngAfterViewInit(){
    // TODO How to get the name of the currently selected project?
    let pObs=this.route.params.subscribe((params)=>{

    },(err)=>{

    },()=>{

    })
  }
}
