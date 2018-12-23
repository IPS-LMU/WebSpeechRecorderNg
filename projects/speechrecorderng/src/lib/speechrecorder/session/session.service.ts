import {Inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Session} from "./session";
import {UUID} from "../../utils/utils";
import {Observable} from "rxjs";
import {ProjectService} from "../project/project.service";



@Injectable()
export class SessionService {
  public static readonly SESSION_API_CTX='session';
  private sessionsUrl:string;
  private withCredentials:boolean=false;

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
    this.sessionsUrl = apiEndPoint + SessionService.SESSION_API_CTX;
  }

  sessionObserver(id: string): Observable<Session> {

    let sessUrl = this.sessionsUrl + '/' + id;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sessUrl = sessUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<Session>(sessUrl,{ withCredentials: this.withCredentials });

  }

  projectSessionsObserver(projectName: string): Observable<Array<Session>> {

    let sesssUrl = ProjectService.PROJECT_API_CTX +'/'+projectName+'/'+SessionService.SESSION_API_CTX
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      sesssUrl = sesssUrl + '_list.json?requestUUID='+UUID.generate();
    }
    return this.http.get<Array<Session>>(sesssUrl,{ withCredentials: this.withCredentials });

  }

}



