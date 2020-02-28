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
import {PlatformLocation} from "@angular/common";


@Injectable()
export class ProjectService extends GenericSprService<Project>{
  public static readonly PROJECT_API_CTX='project'
  private projectCtxUrl:string;
  //private withCredentials:boolean=false;
  private httpParams:HttpParams;

  selectedProject:Project=null;

  constructor(protected sprDb:SprDb,protected http:HttpClient,private platformLoaction:PlatformLocation,@Inject(SPEECHRECORDER_CONFIG) protected config?:SpeechRecorderConfig) {
    super(ProjectService.PROJECT_API_CTX,sprDb,http,config)
    console.log("Base Href: "+platformLoaction.getBaseHrefFromDOM());
    this.projectCtxUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX;
    this.httpParams=new HttpParams();
    this.httpParams.set('cache','false');
  }

  projectsObservable(): Observable<Array<Project>> {

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

  private appendRequestUUIDForDevelopmentServer(url:string):string{
    let resUrl=url;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      resUrl = resUrl + '.json?requestUUID='+UUID.generate();

    }
    return resUrl
  }

  projectUrl(id:string):string{
    return this.appendRequestUUIDForDevelopmentServer(this.projectCtxUrl + '/' + id)
  }

  projectResourceUrl(projectId: string,relResourcePath:string):string{
    return this.projectCtxUrl + '/' + projectId +'/'+relResourcePath
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



