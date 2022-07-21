/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";

import {UUID} from "../../utils/utils";
import {SprRecordingFile, RecordingFileDescriptorImpl, RecordingFile} from "../recording";
import {ProjectService} from "../project/project.service";
import {SessionService} from "../session/session.service";
import {Observable} from "rxjs";


export const REC_API_CTX='recfile'



@Injectable()
export class RecordingService {

  public static readonly REC_API_CTX = 'recfile'
  public static readonly RECORDING_API_CTX='recordingfile'
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

  private recordingFilesUrl():string{
    let recFilesUrl = this.apiEndPoint  + RecordingService.RECORDING_API_CTX;
    return recFilesUrl;
  }

  private sessionRecordingFilesUrl(projectName: string, sessId: string | number):string{
    let encPrjName=encodeURIComponent(projectName);
    let encSessId=encodeURIComponent(sessId);
    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + encPrjName + '/' +
      SessionService.SESSION_API_CTX + '/' + encSessId + '/' + RecordingService.RECORDING_API_CTX;
    return recFilesUrl;
  }

  private sessionRecFilesUrl(projectName: string, sessId: string | number):string{
    let encPrjName=encodeURIComponent(projectName);
    let encSessId=encodeURIComponent(sessId);
    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + encPrjName + '/' +
        SessionService.SESSION_API_CTX + '/' + encSessId + '/' + RecordingService.REC_API_CTX;
    return recFilesUrl;
  }

  private sessionRecFilesReqUrl(projectName: string, sessId: string | number):string{
    let recFilesUrl=this.sessionRecFilesUrl(projectName,sessId);
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recFilesUrl = recFilesUrl + '.json?requestUUID=' + UUID.generate();
    }
    return recFilesUrl;
  }

  recordingFileDescrList(projectName: string, sessId: string | number):Observable<Array<RecordingFileDescriptorImpl>> {
    let recFilesReqUrl = this.sessionRecFilesReqUrl(projectName,sessId);
    let wobs = this.http.get<Array<RecordingFileDescriptorImpl>>(recFilesReqUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  recordingFileList(projectName: string, sessId: string | number):Observable<Array<RecordingFile>> {
    let recFilesReqUrl = this.sessionRecFilesReqUrl(projectName,sessId);
    let wobs = this.http.get<Array<RecordingFile>>(recFilesReqUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  sprRecordingFileList(projectName: string, sessId: string | number):Observable<Array<SprRecordingFile>> {
    let recFilesReqUrl = this.sessionRecFilesReqUrl(projectName,sessId);
    let wobs = this.http.get<Array<SprRecordingFile>>(recFilesReqUrl,{withCredentials:this.withCredentials});
    return wobs;
  }

  private audioRequest(audioUrl:string): Observable<HttpResponse<ArrayBuffer>> {
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
    }
    let headers = new HttpHeaders();
    headers = headers.set('Accept', 'audio/wav');
    return this.http.get(audioUrl, {
      headers: headers,
      observe: 'response',
      responseType: 'arraybuffer',
      withCredentials: this.withCredentials
    });

  }

  private fetchAudiofile(projectName: string, sessId: string | number, recFileId: string|number): Observable<HttpResponse<ArrayBuffer>> {
    let recFilesUrl=this.sessionRecordingFilesUrl(projectName,sessId);
    let encRecFileId=encodeURIComponent(recFileId);
    let recUrl = recFilesUrl + '/' + encRecFileId;
    return this.audioRequest(recUrl);
  }

  private fetchSprAudiofile(projectName: string, sessId: string | number, itemcode: string,version:number): Observable<HttpResponse<ArrayBuffer>> {
    let recFilesUrl=this.sessionRecFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrl = recFilesUrl + '/' + encItemcode +'/'+version;
    return this.audioRequest(recUrl);
  }

  fetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string, recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile|null>(observer=>{
      if(recordingFile.session && recordingFile.recordingFileId) {
        let obs = this.fetchAudiofile(projectName, recordingFile.session, recordingFile.recordingFileId);
        obs.subscribe(resp => {
            //console.log("Fetched audio file. HTTP response status: "+resp.status+", type: "+resp.type+", byte length: "+ resp.body.byteLength);

            // Do not use Promise version, which does not work with Safari 13 (13.0.5)
            if (resp.body) {
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
              })
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

  fetchAndApplySprRecordingFile(aCtx: AudioContext, projectName: string, recordingFile:SprRecordingFile):Observable<SprRecordingFile|null> {

    let wobs = new Observable<SprRecordingFile|null>(observer=>{
      if(recordingFile.session) {
        let obs = this.fetchSprAudiofile(projectName, recordingFile.session, recordingFile.itemCode, recordingFile.version);
        obs.subscribe(resp => {
              //console.log("Fetched audio file. HTTP response status: "+resp.status+", type: "+resp.type+", byte length: "+ resp.body.byteLength);

              // Do not use Promise version, which does not work with Safari 13 (13.0.5)
              if (resp.body) {
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
                })
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

  fetchRecordingFile(aCtx: AudioContext, projectName: string, sessId: string | number, itemcode: string,version:number):Observable<SprRecordingFile|null> {

    let wobs = new Observable<SprRecordingFile | null>(observer=>{
      let obs = this.fetchSprAudiofile(projectName, sessId, itemcode,version);


      obs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13
          if(resp.body) {
            aCtx.decodeAudioData(resp.body, ab => {
              let rf = new SprRecordingFile(sessId, itemcode, version, ab);
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



