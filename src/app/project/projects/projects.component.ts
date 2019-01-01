import { Component, OnInit } from '@angular/core';
import {Project} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project";
import {ProjectService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {



  private _projects:Array<Project>;

  constructor(private projectService:ProjectService,private scriptService:ScriptService) { }

  ngOnInit() {
    this.fetchProjects()
  }

  get projects(): Array<Project> {
    return this._projects;
  }

  fetchProjects():void{
      this.projectService.projectsObservable().subscribe(prjs => {

        prjs.forEach((prj)=>{
          this.scriptService.projectScriptsObserver(prj.name).subscribe((v)=>{

          },(err)=>{
            this._projects=prjs
          },()=>{
            this._projects=prjs
          })
        })
      })
  }

  select(project:Project){
    // TODO get the scripts at this point?
  }

}
