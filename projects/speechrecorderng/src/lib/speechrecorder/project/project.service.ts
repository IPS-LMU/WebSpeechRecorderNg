/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Project} from "./project";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";



@Injectable()
export class ProjectService {
  public static readonly PROJECT_API_CTX='project'
  private projectCtxUrl:string;
  private withCredentials:boolean=false;
  private httpParams:HttpParams;
  constructor(private http:HttpClient,@Inject(SPEECHRECORDER_CONFIG) private config?:SpeechRecorderConfig) {

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
    this.httpParams=new HttpParams();
    this.httpParams.set('cache','false');
  }

  projectsObservable():Observable<Array<Project>>{

    let projectUrl = this.projectCtxUrl + '/';
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '_list.json?requestUUID='+UUID.generate();

    }
    return this.http.get<Array<Project>>(projectUrl,{ params:this.httpParams,withCredentials: this.withCredentials})

  }

  projectObservable(id:string):Observable<Project>{

    let projectUrl = this.projectCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '.json?requestUUID='+UUID.generate();

    }
     return this.http.get<Project>(projectUrl,{ params:this.httpParams,withCredentials: this.withCredentials})

   }

}



