/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Project} from "./project";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {PlatformLocation} from "@angular/common";



@Injectable()
export class ProjectService {
  public static readonly PROJECT_API_CTX='project'
  private projectCtxUrl:string;
  private withCredentials:boolean=false;

  constructor(private http:HttpClient,private platformLoaction:PlatformLocation,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

    console.log("Base Href: "+platformLoaction.getBaseHrefFromDOM());

    let apiEndPoint = ''

    if(config && config.apiEndPoint) {
      apiEndPoint=config.apiEndPoint;
    }
    if(apiEndPoint !== ''){
      apiEndPoint=apiEndPoint+'/'
    }
    if(config!=null && config.withCredentials!=null){
      this.withCredentials=config.withCredentials;
    }

    this.projectCtxUrl = apiEndPoint + ProjectService.PROJECT_API_CTX;

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
     return this.http.get<Project>(this.projectUrl(id),{withCredentials: this.withCredentials})
   }

}



