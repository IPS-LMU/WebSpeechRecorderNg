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
  }

  private recFilesUrl(projectName: string, sessId: string | number):string{
    let encPrjName=encodeURIComponent(projectName);
    let encSessId=encodeURIComponent(sessId);
    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + encPrjName + '/' +
        SessionService.SESSION_API_CTX + '/' + encSessId + '/' + RecordingService.REC_API_CTX;
    return recFilesUrl;
  }

  private recFilesReqUrl(projectName: string, sessId: string | number):string{
    let recFilesUrl=this.recFilesUrl(projectName,sessId);
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recFilesUrl = recFilesUrl + '.json?requestUUID=' + UUID.generate();
    }
    return recFilesUrl;
  }

  recordingFileDescrList(projectName: string, sessId: string | number):Observable<Array<RecordingFileDescriptor>> {
    let recFilesReqUrl = this.recFilesReqUrl(projectName,sessId);
    let wobs = this.http.get<Array<RecordingFileDescriptor>>(recFilesReqUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  recordingFileList(projectName: string, sessId: string | number):Observable<Array<RecordingFile>> {
    let recFilesReqUrl = this.recFilesReqUrl(projectName,sessId);
    let wobs = this.http.get<Array<RecordingFile>>(recFilesReqUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  private fetchMediafile(projectName: string, sessId: string | number, itemcode: string,version:number,mimeType:MIMEType=null): Observable<HttpResponse<ArrayBuffer>> {
    let recFilesUrl=this.recFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrl = recFilesUrl + '/' + encItemcode +'/'+version;
    if (this.config && this.config.apiType === ApiType.FILES) {
      let ext:string='wav'
      if(mimeType){
        let mtExt=mimeType.extension;
        if(mtExt){
          ext=mtExt;
        }
      }
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.'+ext+'?requestUUID=' + UUID.generate();
    }

    let headers = new HttpHeaders();
    let acceptHeaderVal='audio/wav';
    if(mimeType){
      acceptHeaderVal=mimeType.toHeaderString();
    }
    headers = headers.set('Accept', acceptHeaderVal);
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
      let mt:MIMEType|null=null;
      if(recordingFile.rectype){
        mt=MIMEType.parse(recordingFile.rectype);
        if(mt){
          isVideo=mt.isVideo();
          ext=mt.extension;
        }
      }
      if(recordingFile.session) {
      let obs = this.fetchMediafile(projectName, recordingFile.session, recordingFile.itemCode,recordingFile.version,mt);
      obs.subscribe(resp => {
        //console.log("Fetched audio file. HTTP response status: "+resp.status+", type: "+resp.type+", byte length: "+ resp.body.byteLength);
        if (resp.body) {
          if (isVideo) {
            let ctHeader = resp.headers.get('Content-type');
            if (!ctHeader && mt) {
              ctHeader = mt.toHeaderString();
            }
            recordingFile.blob = new Blob([resp.body], {type: ctHeader});
          }
          // Do not use Promise version, which does not work with Safari 13 (13.0.5)
          aCtx.decodeAudioData(resp.body, ab => {
            recordingFile.audioBuffer = ab;
            if (this.debugDelay > 0) {
              window.setTimeout(() => {

                observer.next(recordingFile);
                observer.complete();
              }, this.debugDelay);
            } else {
              observer.next(recordingFile);
              observer.complete();
            }
          }, error => {
            observer.error(error);
            observer.complete();
          });
        } else {
          observer.error('Fetching audio file: response has no body');
        }
            },
            (error: HttpErrorResponse) => {
              if (error.status == 404) {
                // Interpret not as an error, the file ist not recorded yet
                observer.next(null);
                observer.complete()
              } else {
                // all other states are errors
                observer.error(error);
                observer.complete();
              }
            });
      }else{
        observer.error();
      }
    });

    return wobs;
  }

  fetchRecordingFile(aCtx: AudioContext, projectName: string, sessId: string | number, itemcode: string,version:number):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile | null>(observer=>{
      let obs = this.fetchMediafile(projectName, sessId, itemcode,version);


      obs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13
          if(resp.body) {
            aCtx.decodeAudioData(resp.body, ab => {
              let rf = new RecordingFile(sessId, itemcode, version, ab);
              if (this.debugDelay > 0) {
                window.setTimeout(() => {

                  observer.next(rf);
                  observer.complete();
                }, this.debugDelay);
              } else {
                observer.next(rf);
                observer.complete();
              }
            });
          }else{
            observer.error();
          }
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



