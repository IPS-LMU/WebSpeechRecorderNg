/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";

import {UUID} from "../../utils/utils";
import {RecordingFile, RecordingFileDescriptor} from "../recording";
import {ProjectService} from "../project/project.service";
import {SessionService} from "../session/session.service";
import {Observable} from "rxjs";
import {MIMEType} from "../../net/mimetype";


export const REC_API_CTX='recfile'



@Injectable()
export class RecordingService {

  public static readonly REC_API_CTX = 'recfile'
  private apiEndPoint: string;
  private withCredentials: boolean = false;

  //private debugDelay:number=10000;
  private debugDelay:number=0;

  constructor(private http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) private config?: SpeechRecorderConfig) {

    this.apiEndPoint = ''

    if (config && config.apiEndPoint) {
      this.apiEndPoint = config.apiEndPoint;
    }
    if (this.apiEndPoint !== '') {
      this.apiEndPoint = this.apiEndPoint + '/'
    }
    if (config != null && config.withCredentials != null) {
      this.withCredentials = config.withCredentials;
    }

    //this.recordingCtxUrl = apiEndPoint + REC_API_CTX;

  }

  recordingFileDescrList(projectName: string, sessId: string | number):Observable<Array<RecordingFileDescriptor>> {

    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' +
      SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.REC_API_CTX;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recFilesUrl = recFilesUrl + '.json?requestUUID=' + UUID.generate();
    }
    let wobs = this.http.get<Array<RecordingFileDescriptor>>(recFilesUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  recordingFileList(projectName: string, sessId: string | number):Observable<Array<RecordingFile>> {

    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' +
        SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.REC_API_CTX;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recFilesUrl = recFilesUrl + '.json?requestUUID=' + UUID.generate();
    }
    let wobs = this.http.get<Array<RecordingFile>>(recFilesUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  private fetchMediafile(projectName: string, sessId: string | number, itemcode: string,version:number,ext:string='wav'): Observable<HttpResponse<ArrayBuffer>> {

    let recUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' +
      SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.REC_API_CTX + '/' + itemcode+'/'+version;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.'+ext+'?requestUUID=' + UUID.generate();
    }

    let headers = new HttpHeaders();
    headers = headers.set('Accept', 'audio/wav');
    return this.http.get(recUrl, {
      headers: headers,
      observe: 'response',
      responseType: 'arraybuffer',
      withCredentials: this.withCredentials
    });

  }

  fetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string,recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile>(observer=>{
      let ext='wav';
      let isVideo=false;
      let mt:MIMEType=null;
      if(recordingFile.rectype){
        mt=MIMEType.parse(recordingFile.rectype);
        if(mt){
          isVideo=mt.isVideo();
          ext=mt.extension;
        }
      }
      let obs = this.fetchMediafile(projectName, recordingFile.session, recordingFile.itemCode,recordingFile.version,ext);
      obs.subscribe(resp => {
          //console.log("Fetched audio file. HTTP response status: "+resp.status+", type: "+resp.type+", byte length: "+ resp.body.byteLength);
          if(isVideo){
            let ctHeader=resp.headers.get('Content-type');
            if(!ctHeader && mt){
              ctHeader=mt.toHeaderString();
            }
            recordingFile.blob=new Blob([resp.body],{type:ctHeader});
          }
          // Do not use Promise version, which does not work with Safari 13 (13.0.5)
          aCtx.decodeAudioData(resp.body,ab=>{
            recordingFile.audioBuffer=ab;
            if(this.debugDelay>0) {
              window.setTimeout(() => {

                observer.next(recordingFile);
                observer.complete();
              }, this.debugDelay);
            }else{
              observer.next(recordingFile);
              observer.complete();
            }
          },error => {
            observer.error(error);
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

  fetchRecordingFile(aCtx: AudioContext, projectName: string, sessId: string | number, itemcode: string,version:number):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile | null>(observer=>{
      let obs = this.fetchMediafile(projectName, sessId, itemcode,version);


      obs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13
          aCtx.decodeAudioData(resp.body,ab=>{
              let rf=new RecordingFile(sessId,itemcode,version,ab);
              if(this.debugDelay>0) {
                window.setTimeout(() => {

                  observer.next(rf);
                  observer.complete();
                }, this.debugDelay);
              }else{
                observer.next(rf);
                observer.complete();
              }
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



