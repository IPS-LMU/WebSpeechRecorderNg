/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams, HttpResponse} from "@angular/common/http";
import 'rxjs/add/operator/toPromise';
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";

import {UUID} from "../../utils/utils";
import {RecordingFile} from "../recording";
import {ProjectService} from "../project/project.service";
import {SessionService} from "../session/session.service";
import {reject} from "q";
import {Observable} from "rxjs";


export const REC_API_CTX='recfile'



@Injectable()
export class RecordingService {

  public static readonly REC_API_CTX = 'recfile'
  private recordingCtxUrl: string;
  private withCredentials: boolean = false;
  private httpParams: HttpParams;

  constructor(private http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) private config?: SpeechRecorderConfig) {

    let apiEndPoint = ''

    if (config && config.apiEndPoint) {
      apiEndPoint = config.apiEndPoint;
    }
    if (apiEndPoint !== '') {
      apiEndPoint = apiEndPoint + '/'
    }
    if (config != null && config.withCredentials != null) {
      this.withCredentials = config.withCredentials;
    }

    this.recordingCtxUrl = apiEndPoint + REC_API_CTX;
    this.httpParams = new HttpParams();
    this.httpParams.set('cache', 'false');

  }

  private fetchAudiofile(projectName: string, sessId: string | number, itemcode: string): Observable<HttpResponse<ArrayBuffer>> {

    let recUrl = this.recordingCtxUrl + '/' + ProjectService.PROJECT_API_CTX;
    if(projectName) {
        recUrl = recUrl + '/' + projectName;
    }
    recUrl=recUrl+ '/' +SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.REC_API_CTX + '/' + itemcode;

    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID=' + UUID.generate();
    }


    return this.http.get(recUrl, {
      observe: 'response',
      responseType: 'arraybuffer',
      params: this.httpParams,
      withCredentials: this.withCredentials
    });

  }

  // TODO test
  fetchRecordingFile(aCtx: AudioContext, projectName: string| null, sessId: string | number, itemcode: string):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile | null>(observer=>{
      let obs = this.fetchAudiofile(projectName, sessId, itemcode);
      obs.subscribe(resp => {
          let dec=aCtx.decodeAudioData(resp.body);
          dec.then(ab=>{
              let rf=new RecordingFile(sessId,itemcode,ab);
              observer.next(rf);
              observer.complete();
          })
        },
        (error: HttpErrorResponse) => {
          if (error.status == 404) {
            // Interpret not as an error, the file ist not recorded yet
            observer.next(null);
            observer.complete()
          }else{
            // all other states are errors
            observer.error(error);
            observer.complete();
          }
        });
    });

    return wobs;
  }
}



