import { Component, OnInit } from '@angular/core';
import {Project} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project";
import {ProjectService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {



  private _projects:Array<Project>;

  constructor(private projectService:ProjectService) { }

  ngOnInit() {
    this.fetchProjects()
  }

  get projects(): Array<Project> {
    return this._projects;
  }

  fetchProjects():void{
      this.projectService.projectsObservable().subscribe(value => {
        this._projects=value;
      })
  }

  select(project:Project){
    // TODO
  }

}
