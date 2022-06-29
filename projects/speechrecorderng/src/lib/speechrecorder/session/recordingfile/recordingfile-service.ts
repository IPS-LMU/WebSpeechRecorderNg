import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from "@angular/common/http";


import {Observable} from "rxjs";


import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../../spr.config";
import {UUID} from "../../../utils/utils";
import {RecordingFile, RecordingFileUtils, SprRecordingFile} from "../../recording";
import {AudioDataHolder} from "../../../audio/audio_data_holder";


@Injectable()
export class RecordingFileService {

  public static readonly RECOFILE_API_CTX = 'recordingfile'
  private apiEndPoint: string;
  private withCredentials: boolean = false;

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


  }

  private recoFileUrl(recordingFileId: string | number):string{
    let encRecfileId=encodeURIComponent(recordingFileId);
    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + encRecfileId;

    return recUrl;
  }

  private fetchAudiofile(recordingFileId: string | number): Observable<HttpResponse<ArrayBuffer>> {
    let recUrl = this.recoFileUrl(recordingFileId);
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
      withCredentials: this.withCredentials
    });
  }

  private recordingFileDescrObserver(recordingFileId: string | number): Observable<RecordingFile> {

    let recUrl = this.recoFileUrl(recordingFileId);
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<RecordingFile>(recUrl,{ withCredentials: this.withCredentials });
  }

  private sprRecordingFileDescrObserver(recordingFileId: string | number): Observable<SprRecordingFile> {

    let recUrl = this.recoFileUrl(recordingFileId);
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID='+UUID.generate();
    }
    return this.http.get<SprRecordingFile>(recUrl,{ withCredentials: this.withCredentials });
  }


  private fetchSessionAudiofileById(projectName: string, sessId: string | number, recordingFileId: string | number): Observable<HttpResponse<ArrayBuffer>> {

    let recUrl = this.recoFileUrl(recordingFileId);
    // if (this.config && this.config.apiType === ApiType.FILES) {
    //   // for development and demo
    //   // append UUID to make request URL unique to avoid localhost server caching
    //   recUrl = recUrl + '.wav?requestUUID=' + UUID.generate();
    // }
    return this.http.get(recUrl, {
      observe: 'response',
      responseType: 'arraybuffer',
      withCredentials: this.withCredentials
    });
  }


  // TODO test

  fetchAndApplyRecordingFile(aCtx: AudioContext, recordingFile:SprRecordingFile):Observable<SprRecordingFile|null> {

    let wobs = new Observable<SprRecordingFile|null>(observer=>{
      if(recordingFile.recordingFileId) {
        let obs = this.fetchAudiofile(recordingFile.recordingFileId);

        obs.subscribe(resp => {
              // Do not use Promise version, which does not work with Safari 13
              if(resp.body) {
                aCtx.decodeAudioData(resp.body, ab => {
                  RecordingFileUtils.setAudioData(recordingFile,new AudioDataHolder(ab));
                  if (this.debugDelay > 0) {
                    window.setTimeout(() => {

                      observer.next(recordingFile);
                      observer.complete();
                    }, this.debugDelay);
                  } else {
                    observer.next(recordingFile);
                    observer.complete();
                  }
                })
              }else{
                observer.error('Received no audio data!');
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

  fetchRecordingFile(aCtx: AudioContext, recordingFileId: string | number): Observable<RecordingFile | null> {

    let wobs = new Observable<RecordingFile | null>(observer => {
      let rf: RecordingFile|null = null;
      let rfDescrObs = this.recordingFileDescrObserver(recordingFileId);
      rfDescrObs.subscribe(value => {
        rf = value;
      }, (error) => {
        observer.error(error);
      }, () => {
        let rfAudioObs = this.fetchAudiofile(recordingFileId);
        rfAudioObs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13
            if(resp.body) {
              aCtx.decodeAudioData(resp.body, ab => {
                if(rf) {
                  RecordingFileUtils.setAudioData(rf,new AudioDataHolder(ab));
                }else{
                  observer.error('Recording file object null');
                }
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
            }else{
              observer.error('Received no audio data');
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

      });
    });

    return wobs;
  }

  fetchSprRecordingFile(aCtx: AudioContext, recordingFileId: string | number): Observable<SprRecordingFile | null> {

    let wobs = new Observable<SprRecordingFile | null>(observer => {
      let rf: SprRecordingFile|null = null;
      let rfDescrObs = this.sprRecordingFileDescrObserver(recordingFileId);
      rfDescrObs.subscribe(value => {
        rf = value;
      }, (error) => {
        observer.error(error);
      }, () => {
        let rfAudioObs = this.fetchAudiofile(recordingFileId);
        rfAudioObs.subscribe(resp => {
              // Do not use Promise version, which does not work with Safari 13
          if(resp.body) {
            aCtx.decodeAudioData(resp.body, ab => {
              if(rf) {
                let adh=new AudioDataHolder(ab);
                RecordingFileUtils.setAudioData(rf,adh);
              }else{
                observer.error('Recording file object null');
              }
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
          }else{
            observer.error('Received no audio data');
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

      });
    });

    return wobs;
  }

  saveEditSelection(recordingFileId: string | number,editSampleRate:number|null,editStartFrame:number|null,editEndFrame:number|null): Observable<SprRecordingFile | null> {
    let recUrl = this.apiEndPoint + RecordingFileService.RECOFILE_API_CTX + '/' + recordingFileId;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.json?requestUUID='+UUID.generate();
    }
    console.log("Path request URL: "+recUrl)
    return this.http.patch<SprRecordingFile>(recUrl,{editSampleRate:editSampleRate,editStartFrame:editStartFrame,editEndFrame:editEndFrame},{ withCredentials: this.withCredentials });
  }

}


