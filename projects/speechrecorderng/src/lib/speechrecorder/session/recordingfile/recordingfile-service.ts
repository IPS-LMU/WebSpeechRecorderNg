import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from "@angular/common/http";


import {Observable} from "rxjs";


import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../../spr.config";
import {UUID} from "../../../utils/utils";
import {RecordingFile, RecordingFileUtils, SprRecordingFile} from "../../recording";
import {AudioBufferSource, AudioDataHolder} from "../../../audio/audio_data_holder";
import {BasicRecordingService} from "../../recordings/basic_recording.service";
import {AudioContextProvider} from "../../../audio/context";


@Injectable()
export class RecordingFileService extends BasicRecordingService{

  public static readonly RECOFILE_API_CTX = 'recordingfile'

  //private debugDelay:number=10000;
  private debugDelay:number=0;

  constructor(protected http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) protected config?: SpeechRecorderConfig) {
      super(http,config);
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

  fetchAndApplyRecordingFile(recordingFile:SprRecordingFile):Observable<SprRecordingFile|null> {

    let wobs = new Observable<SprRecordingFile|null>(observer=>{
      if(recordingFile.recordingFileId) {
        let obs = this.fetchAudiofile(recordingFile.recordingFileId);

        obs.subscribe(
            {next:resp => {
              if(resp.body) {
                AudioContextProvider.decodeAudioData(resp.body).then(ab => {
                  let as=new AudioBufferSource(ab);
                  RecordingFileUtils.setAudioData(recordingFile,new AudioDataHolder(as));
                  if (this.debugDelay > 0) {
                    window.setTimeout(() => {

                      observer.next(recordingFile);
                      observer.complete();
                    }, this.debugDelay);
                  } else {
                    observer.next(recordingFile);
                    observer.complete();
                  }
                }).catch(reason=>{observer.error(reason)});
              }else{
                observer.error('Received no audio data!');
              }
            },
            error:(error: HttpErrorResponse) => {
              if (error.status == 404) {
                // Interpret not as an error, the file ist not recorded yet
                observer.next(null);
                observer.complete()
              } else {
                // all other states are errors
                observer.error(error);
                observer.complete();
              }
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
      rfDescrObs.subscribe(
          {next:value => {
        rf = value;
      }, error:(error) => {
        observer.error(error);
      }, complete:() => {
        let rfAudioObs = this.fetchAudiofile(recordingFileId);
        rfAudioObs.subscribe({
          next: resp => {
            // Do not use Promise version, which does not work with Safari 13
            if (resp.body) {
              AudioContextProvider.decodeAudioData(resp.body).then( ab => {
                if (rf) {
                  let as = new AudioBufferSource(ab);
                  RecordingFileUtils.setAudioData(rf, new AudioDataHolder(as));
                } else {
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
              }).catch(reason => {observer.error(reason)});
            } else {
              observer.error('Received no audio data');
            }
          },
          error: (error: HttpErrorResponse) => {
            if (error.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(error);
              observer.complete();
            }
          }
        });
        }
      });
    });

    return wobs;
  }

  fetchSprRecordingFile( recordingFileId: string | number): Observable<SprRecordingFile | null> {

    let wobs = new Observable<SprRecordingFile | null>(observer => {
      let rf: SprRecordingFile|null = null;
      let rfDescrObs = this.sprRecordingFileDescrObserver(recordingFileId);
      rfDescrObs.subscribe({next:value => {
        rf = value;
      }
    , error:(error) => {
        observer.error(error);
      }, complete:() => {
        let sampleCnt: number | null = null;
        if (rf && rf.channels && rf.frames) {
          sampleCnt = rf.channels * rf.frames;
        }
        // TODO use download storage type depending on sample count of file
        if (rf && rf.samplerate && sampleCnt != null && sampleCnt > this._maxAutoNetMemStoreSamples) {
          const baseUrl = this.recoFileUrl(recordingFileId);
          const obNetAb = this.chunkAudioRequestToNetAudioBuffer(baseUrl, 0, rf?.samplerate, BasicRecordingService.DEFAULT_CHUNKED_DOWNLOAD_SECONDS, rf.frames);
          obNetAb.subscribe(
              {
                next: (nab) => {
                  let adh = new AudioDataHolder(nab);
                  if (rf) {
                    RecordingFileUtils.setAudioData(rf, adh);
                    observer.next(rf);
                  }
                },
                complete: () => {
                  observer.complete();
                },
                error: (error) => {
                  if (error.status == 404) {
                    // Interpret not as an error, the file ist not recorded yet
                    observer.next(null);
                    observer.complete()
                  } else {
                    // all other states are errors
                    observer.error(error);
                    observer.complete();
                  }
                }
              }
          );
        } else {

          let rfAudioObs = this.fetchAudiofile(recordingFileId);
          rfAudioObs.subscribe(
              {next:resp =>
          {
            // Do not use Promise version, which does not work with Safari 13
            if (resp.body) {
              AudioContextProvider.decodeAudioData(resp.body).then( ab => {
                if (rf) {
                  let as = new AudioBufferSource(ab);
                  let adh = new AudioDataHolder(as);
                  RecordingFileUtils.setAudioData(rf, adh);
                } else {
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
              }).catch(reason => {observer.error(reason)});
            } else {
              observer.error('Received no audio data');
            }
          }
        , error:(error: HttpErrorResponse) => {
            if (error.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(error);
              observer.complete();
            }
          }
        });
        }
      }
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
    //console.log("Path request URL: "+recUrl)
    return this.http.patch<SprRecordingFile>(recUrl,{editSampleRate:editSampleRate,editStartFrame:editStartFrame,editEndFrame:editEndFrame},{ withCredentials: this.withCredentials });
  }

  deleteRecordingFileObserver(recordingFileId: string | number):Observable<void> {
    let url = this.recoFileUrl(recordingFileId);
    return this.http.delete<void>(url,{withCredentials:this.withCredentials});
  }

}


