/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Project} from "./project";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {GenericSprService} from "../generic_sync_service";
import {SprDb} from "../../db/inddb";



@Injectable()
export class ProjectService extends GenericSprService<Project>{
  public static readonly PROJECT_API_CTX='project'
  private projectCtxUrl:string;
  //private withCredentials:boolean=false;
  private httpParams:HttpParams;

  selectedProject:Project=null;

  constructor(protected sprDb:SprDb,protected http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(ProjectService.PROJECT_API_CTX,sprDb,http,config)

    this.projectCtxUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX;
    this.httpParams=new HttpParams();
    this.httpParams.set('cache','false');
  }

  projectsObservable():Observable<Array<Project>>{

    if(this.config.apiType === ApiType.STANDALONE){


    }else {
      let projectUrl = this.projectCtxUrl + '/';
      if (this.config && this.config.apiType === ApiType.FILES) {
        // for development and demo
        // append UUID to make request URL unique to avoid localhost server caching
        projectUrl = projectUrl + '_list.json?requestUUID=' + UUID.generate();

      }
      //return this.http.get<Array<Project>>(projectUrl,{ params:this.httpParams,withCredentials: this.withCredentials})
      let httpParams = new HttpParams();
      httpParams.set('cache', 'false');
      return this.getAndCacheEntities(projectUrl, httpParams)
    }
  }

  projectObservable(id:string):Observable<Project>{

    let projectUrl = this.projectCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '.json?requestUUID='+UUID.generate();

    }
     //return this.http.get<Project>(projectUrl,{ params:this.httpParams,withCredentials: this.withCredentials})

    return this.getAndCacheEntity(id,projectUrl,this.httpParams)

   }

  projectExists(id: string): Observable<boolean> {
    let projectUrl = this.projectCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '.json?requestUUID=' + UUID.generate();

    }
    return this.entityExists(id, projectUrl, this.httpParams)
  }

  projectAddObservable(newProject:Project):Observable<Project>{

    let projectUrl = this.projectCtxUrl + '/' + newProject.name;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '.json?requestUUID='+UUID.generate();

    }
    return this.addEntityObserver(newProject,newProject.name,projectUrl);
  }

}



