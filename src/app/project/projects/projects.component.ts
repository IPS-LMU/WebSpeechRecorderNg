import { Component, OnInit } from '@angular/core';
import {Project} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project";
import {ProjectService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {

  private _projects:Array<Project>;
  selectedProject:Project|null=null;

  constructor(private router:Router,private projectService:ProjectService,private scriptService:ScriptService) { }

  ngOnInit() {
    this.fetchProjects()
  }

  get projects(): Array<Project> {
    return this._projects;
  }

  fetchProjects():void{
      this.projectService.projectsObservable().subscribe(prjs => {

        prjs.forEach((prj)=>{
          // prefetch scripts
          this.scriptService.projectScriptsObserver(prj.name).subscribe((v)=>{

          },(err)=>{
            this._projects=prjs
          },()=>{
            this._projects=prjs
            // auto select project if only one associated
            if(!this.selectedProject && this._projects.length==1){
              this.selectedProject=this._projects[0]
            }
          })
        })
      })
  }

  select(project:Project){
    this.selectedProject=project;
    this.router.navigate(['/wsp','project',this.selectedProject.name,'session'])
  }

}
