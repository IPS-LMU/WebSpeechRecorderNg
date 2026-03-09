/**
 * Created by klausj on 17.06.2017.
 */
import {Injectable} from '@angular/core';
import {Project} from "./project";
import {Observable} from "rxjs";
import {BasicService} from "../../net/basic_service";



@Injectable()
export class ProjectService extends BasicService<Project>{

  public static readonly PROJECT_API_CTX='project';
  private readonly projectCtxUrl:string;

  constructor() {
    super();
    this.projectCtxUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX;
  }

  projectUrl(id:string):string{
    let encPrjId=encodeURIComponent(id);
    return this.appendRequestUUIDForDevelopmentServer(this.projectCtxUrl + '/' + encPrjId);
  }

  projectResourceUrl(projectId: string,relResourcePath:string):string{
    let encPrjId=encodeURIComponent(projectId);
    // Use encodeURI here since the relatice resource path from recording scripts is already a URI
    // encodeURIComponent function would encode the slashes and fetching the resource would fail
    let encRelResPath=encodeURI(relResourcePath);
    return this.projectCtxUrl + '/' + encPrjId +'/'+encRelResPath;
  }

  projectObservable(id:string):Observable<Project>{
    let prjUrl=this.projectUrl(id);
     return this.http.get<Project>(prjUrl,{withCredentials: this.withCredentials})
   }

}


