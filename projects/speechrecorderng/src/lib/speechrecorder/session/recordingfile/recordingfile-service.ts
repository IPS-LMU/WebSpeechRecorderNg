import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse} from "@angular/common/http";


import {Observable} from "rxjs";

import {RecordingFile} from "./recording-file";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../../spr.config";
import {UUID} from "../../../utils/utils";


@Injectable()
export class RecordingFileService {

  public static readonly RECOFILE_API_CTX = 'recordingfile'
  private apiEndPoint: string;
  private withCredentials: boolean = false;
  private httpParams: HttpParams;
  //private debugDelay:number=10000;
  private debugDelay:number=0;

  constructor(private http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) private config?: SpeechRecorderConfig) {
    //constructor(private http: HttpClient) {
      // TODO test only
    this.apiEndPoint = ''
     // this.apiEndPoint =  '/wikispeech/api/v1'

    if (config && config.apiEndPoint) {
      this.apiEndPoint = config.apiEndPoint;
    }
    if (this.apiEndPoint !== '') {
      this.apiEndPoint = this.apiEndPoint + '/'
    }
    if (config != null && config.withCredentials != null) {
      this.withCredentials = config.withCredentials;
    }
  //this.withCredentials=true

    //this.recordingCtxUrl = apiEndPoint + REC_API_CTX;
    //this.httpParams = new HttpParams();
    //this.httpParams.set('cache', 'false');

  }


  private fetchAudiofile(recordingFileId: string | number): Observable<HttpResponse<ArrayBuffer>> {

    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + recordingFileId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.wav';
    }
    let headers = new HttpHeaders({
      'Accept': 'audio/wav'
    });

    return this.http.get(recUrl, {
      observe: 'response',
      headers: headers,
      responseType: 'arraybuffer',
      params: this.httpParams,
      withCredentials: this.withCredentials
    });
  }

  private recordingFileDescrObserver(recordingFileId: string | number): Observable<RecordingFile> {

    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + recordingFileId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<RecordingFile>(recUrl,{ withCredentials: this.withCredentials });
  }


  private fetchSessionAudiofileById(projectName: string, sessId: string | number, recordingFileId: string | number): Observable<HttpResponse<ArrayBuffer>> {

    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + recordingFileId;
    // if (this.config && this.config.apiType === ApiType.FILES) {
    //   // for development and demo
    //   // append UUID to make request URL unique to avoid localhost server caching
    //   recUrl = recUrl + '.wav?requestUUID=' + UUID.generate();
    // }
    return this.http.get(recUrl, {
      observe: 'response',
      responseType: 'arraybuffer',
      params: this.httpParams,
      withCredentials: this.withCredentials
    });
  }


  // TODO test

  fetchAndApplyRecordingFile(aCtx: AudioContext, recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile>(observer=>{

      let obs = this.fetchAudiofile(recordingFile.recordingFileId);


      obs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13
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

  fetchRecordingFile(aCtx: AudioContext, recordingFileId: string | number): Observable<RecordingFile | null> {

    let wobs = new Observable<RecordingFile | null>(observer => {
      let rf: RecordingFile = null;
      let rfDescrObs = this.recordingFileDescrObserver(recordingFileId);
      rfDescrObs.subscribe(value => {
        rf = value;
      }, (error) => {
        observer.error(error);
      }, () => {
        let rfAudioObs = this.fetchAudiofile(recordingFileId);
        rfAudioObs.subscribe(resp => {
              // Do not use Promise version, which does not work with Safari 13
            aCtx.decodeAudioData(resp.body,ab => {
              rf.audioBuffer = ab
              if (this.debugDelay > 0) {
                window.setTimeout(() => {

                  observer.next(rf);
                  observer.complete();
                }, this.debugDelay);
              } else {
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
            } else {
              // all other states are errors
              observer.error(error);
              observer.complete();
            }
          });
      });
    });

    return wobs;
  }

  saveEditSelection(recordingFileId: string | number,editStartFrame:number,editEndFrame:number): Observable<RecordingFile | null> {
    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + recordingFileId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID='+UUID.generate();
    }
    console.log("Path request URL: "+recUrl)
    return this.http.patch<RecordingFile>(recUrl,{editStartFrame:editStartFrame,editEndFrame:editEndFrame},{ withCredentials: this.withCredentials });
  }

}


