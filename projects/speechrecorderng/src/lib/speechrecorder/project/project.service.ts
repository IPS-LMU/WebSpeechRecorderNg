/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import 'rxjs/add/operator/toPromise';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Project} from "./project";
import {UUID} from "../../utils/utils";



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

  getProject(id:string):Promise<Project>{

    let projectUrl = this.projectCtxUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      projectUrl = projectUrl + '.json?requestUUID='+UUID.generate();

    }

    let projectProms = this.http.get(projectUrl,{ params:this.httpParams,withCredentials: this.withCredentials}).toPromise()
      .then(response => {
        return response;
      })
      .catch(this.handleError);

    return projectProms;
   }

    private handleError(error: any): Promise<any> {

        let errMsg='Could not load project '+error.message;
        console.error(errMsg, error);
        return Promise.reject(errMsg);
    }
}


