/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";

import {UUID} from "../../utils/utils";
import {SprRecordingFile, RecordingFileDescriptorImpl, RecordingFile, RecordingFileUtils} from "../recording";
import {ProjectService} from "../project/project.service";
import {SessionService} from "../session/session.service";
import {EMPTY, expand, map, Observable} from "rxjs";
import {AudioDataHolder} from "../../audio/audio_data_holder";
import {ArrayAudioBuffer} from "../../audio/array_audio_buffer";
import {IndexedDbAudioBuffer, PersistentAudioStorageTarget} from "../../audio/inddb_audio_buffer";
import {NetAudioBuffer} from "../../audio/net_audio_buffer";
import {AudioCapture} from "../../audio/capture/capture";

// iPad Out of memory RangeError
//export const DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH = 5000000;
export const DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH = 500000;

// Test debug
//export const DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH = 250000;
// TEST only !!
//export const DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH = 123456;


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

  // private sessionRecordingFilesUrl(projectName: string, sessId: string | number):URL{
  //   let encPrjName=encodeURIComponent(projectName);
  //   let encSessId=encodeURIComponent(sessId);
  //
  //   let recFilesUrlStr = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + encPrjName + '/' +
  //     SessionService.SESSION_API_CTX + '/' + encSessId + '/' + RecordingService.RECORDING_API_CTX;
  //   let recFilesUrl=new URL(recFilesUrlStr);
  //   return recFilesUrl;
  // }

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

  private audioRequestByURL(audioBaseUrl:string,audioURLSearchParams:URLSearchParams): Observable<HttpResponse<ArrayBuffer>> {
    let audioUrl=audioBaseUrl;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      audioUrl=audioUrl+'.wav';
      // append UUID to make request URL unique to avoid localhost server caching
      audioURLSearchParams.set('requestUUID',UUID.generate());
      //audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
    }

    audioUrl=audioUrl+'?'+audioURLSearchParams.toString();

    let headers = new HttpHeaders();
    headers = headers.set('Accept', 'audio/wav');
    return this.http.get(audioUrl, {
      headers: headers,
      observe: 'response',
      responseType: 'arraybuffer',
      withCredentials: this.withCredentials
    });

  }


  public chunkAudioRequest(aCtx:AudioContext,baseAudioUrl:string,startFrame:number=0,frameLength:number): Observable<AudioBuffer|null> {
    let ausps=new URLSearchParams();
    ausps.set('startFrame',startFrame.toString());
    ausps.set('frameLength',frameLength.toString());
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      //audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
      ausps.set('requestUUID',UUID.generate());
    }

    let obs=new Observable<AudioBuffer|null>(observer=> {
      this.audioRequestByURL(baseAudioUrl,ausps).subscribe(resp => {
          // Do not use Promise version, which does not work with Safari 13 (13.0.5)
          if (resp.body) {
            //console.debug("chunkAudioRequest: observer.closed: "+observer.closed);
            //console.debug("Audio file bytes: "+resp.body.byteLength);
            aCtx.decodeAudioData(resp.body, ab => {
                //console.debug("Decoded audio chunk frames: "+ab.length);
                observer.next(ab);
                observer.complete();
              }
              , error => {
                //if(error instanceof HttpErrorResponse) {
                  // if (error.status == 404) {
                  //   // Interpret not as an error, the file ist not recorded yet
                  //   observer.next(null);
                  //   observer.complete()
                  // } else {
                  //   // all other states are errors
                  observer.error(error);
                  // }
               // }
              })
          } else {
            observer.error('Fetching audio file: response has no body');
          }
        },
        (error) => {
          // all other states are errors
          observer.error(error);
          observer.complete();

        });
    });
    return obs;
  }

  private chunkAudioRequestToIndDb(aCtx:AudioContext,persistentAudioStorageTarget:PersistentAudioStorageTarget,inddbAudioBuffer:IndexedDbAudioBuffer|null,baseAudioUrl:string,startFrame:number=0,frameLength:number): Observable<IndexedDbAudioBuffer|null> {
    //let audioUrl=baseAudioUrl+'?startFrame='+startFrame+'&frameLength='+frameLength;
    //let audioUrl=new URL(baseAudioUrl);
    let ausps=new URLSearchParams();
    ausps.set('startFrame',startFrame.toString());
    ausps.set('frameLength',frameLength.toString());
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      //audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
      ausps.set('requestUUID',UUID.generate());
    }
    let obs=new Observable<IndexedDbAudioBuffer|null>(subscriber=> {
      this.audioRequestByURL(baseAudioUrl,ausps).subscribe({next:(resp) => {
          // Do not use Promise version, which does not work with Safari 13 (13.0.5)
          if (resp.body) {
            //console.debug("chunkAudioRequestToIndDb: subscriber.closed: "+subscriber.closed);
            //console.debug("chunkAudioRequestToIndDb: Audio file bytes: "+resp.body.byteLength);
            aCtx.decodeAudioData(resp.body, ab => {
                //console.debug("chunkAudioRequestToIndDb: Decoded audio chunk frames for inddb: "+ab.length);

                if(!inddbAudioBuffer){
                  //console.debug("chunkAudioRequestToIndDb: Create inddb ab from chunk ab...");
                 IndexedDbAudioBuffer.fromChunkAudioBuffer(persistentAudioStorageTarget,ab).subscribe({
                    next:(iab)=>{
                      //console.debug("chunkAudioRequestToIndDb: Built inddb ab from chunk ab: "+iab);
                      inddbAudioBuffer=iab;
                      if(inddbAudioBuffer.frameLen<frameLength){
                        //console.debug("chunkAudioRequestToIndDb: Built inddb ab from chunk ab: First chunk shorter tha frameLength ("+inddbAudioBuffer.frameLen+"<"+frameLength+"), assuming end of data, sealing inddb ab.");
                        inddbAudioBuffer.seal();
                      }
                      subscriber.next(iab);
                    },
                   complete:()=>{
                     //console.debug("chunkAudioRequestToIndDb: Built inddb ab from chunk ab complete.");
                     subscriber.complete();
                   },
                   error:(err)=>{
                      // iPad may throw QuotaExceededError here
                     console.error("chunkAudioRequestToIndDb: Built inddb ab from chunk ab error: "+err);
                      subscriber.error(err);
                   }
                  })
                }else {
                  //console.debug("chunkAudioRequestToIndDb: Append audio chunk to inddb ab...");
                  inddbAudioBuffer.appendChunkAudioBuffer(ab).subscribe({
                    next:(iab)=>{
                      // if(inddbAudioBuffer) {
                      //   console.debug("chunkAudioRequestToIndDb: Appended audio chunk to inddb audio buffer: "+inddbAudioBuffer);
                      // }else{
                      //   console.debug("chunkAudioRequestToIndDb: Append audio chunk returned null");
                      // }
                      subscriber.next(inddbAudioBuffer);
                    },
                    complete:()=>{
                      subscriber.complete();
                    },
                    error:(err)=>{
                      subscriber.error(err);
                    }
                  })
                }
              }
              , error => {
                console.error('chunkAudioRequestToIndDb: error: '+error);
                //if(error instanceof HttpErrorResponse) {
                  subscriber.error(error);
                //}
              })
          } else {
            console.error('chunkAudioRequestToIndDb: Fetching audio file: response has no body');
            subscriber.error('chunkAudioRequestToIndDb: Fetching audio file: response has no body');
          }
        },
        error:(error) => {
          console.error('chunkAudioRequestToIndDb: error: '+error);
          subscriber.error(error);
          //subscriber.complete();
        }
      });
    });
    return obs;
  }

  private chunkAudioRequestToNetAudioBuffer(aCtx: AudioContext, baseAudioUrl: string, startFrame: number = 0, frameLength: number, sampleRate: number | null, frames: number | null): Observable<NetAudioBuffer | null> {
    //let audioUrl=baseAudioUrl+'?startFrame='+startFrame+'&frameLength='+frameLength;
    //let audioUrl=new URL(baseAudioUrl);
    let ausps=new URLSearchParams();
    ausps.set('startFrame',startFrame.toString());
    ausps.set('frameLength',frameLength.toString());
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      //audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
      ausps.set('requestUUID',UUID.generate());
    }
    let obs=new Observable<NetAudioBuffer|null>(subscriber=> {
      this.audioRequestByURL(baseAudioUrl,ausps).subscribe({next:(resp) => {
          // Do not use Promise version, which does not work with Safari 13 (13.0.5)
          if (resp.body) {
            //console.debug("chunkAudioRequestTonetAb: subscriber.closed: "+subscriber.closed);
            //console.debug("chunkAudioRequestTonetAb: Audio file bytes: "+resp.body.byteLength);
            aCtx.decodeAudioData(resp.body, ab => {
                  //console.debug("chunkAudioRequestTonetAb: Decoded audio chunk frames for netAb: "+ab.length);
                  //console.debug("chunkAudioRequestTonetAb: Create netAb ab from chunk ab...");
                  if(frames===null){
                    subscriber.error(new Error('Could not get frame length from recording file object'));
                  }else {
                    let fl = frames;
                    if (ab.sampleRate !== sampleRate) {
                      if (sampleRate && frames) {
                        fl = Math.round(ab.sampleRate * frames / sampleRate);
                      }
                    }
                    let nab = NetAudioBuffer.fromChunkAudioBuffer(aCtx, this, ab, fl);
                    if (nab.frameLen < frameLength) {
                      //console.debug("chunkAudioRequestTonetAb: Built netAb ab from chunk ab: First chunk shorter tha frameLength ("+netAbAudioBuffer.frameLen+"<"+frameLength+"), assuming end of data, sealing netAb ab.");
                      nab.seal();
                    }
                    subscriber.next(nab);

                    subscriber.complete();
                  }
                }
                , error => {
                  console.error('chunkAudioRequestToNetAb: error: '+error);
                  //if(error instanceof HttpErrorResponse) {
                  subscriber.error(error);
                  //}
                })
          } else {
            console.error('chunkAudioRequestToNetAb: Fetching audio file: response has no body');
            subscriber.error('chunkAudioRequestToNetAb: Fetching audio file: response has no body');
          }
        },
        error:(error) => {
          console.error('chunkAudioRequestToNetAb: error: '+error);
          subscriber.error(error);
          //subscriber.complete();
        }
      });
    });
    return obs;
  }


  private chunkedAudioRequest(aCtx:AudioContext,baseAudioUrl:string): Observable<ArrayAudioBuffer|null> {
    let obs=new Observable<ArrayAudioBuffer|null>(subscriber => {
      let arrayAudioBuffer: ArrayAudioBuffer | null = null;
      let startFrame=0;
      let frameLength = DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH;

      //console.debug("Chunk audio request startFrame 0");
      let subscr=this.chunkAudioRequest(aCtx, baseAudioUrl, startFrame, frameLength).pipe(

        expand(value => {
          if(subscriber.closed){
            subscr.unsubscribe();
          }
            if (value) {
              if (arrayAudioBuffer) {
                if (arrayAudioBuffer?.sealed()) {
                  return EMPTY;
                } else {
                  //let nextStartFrame=arrayAudioBuffer.frameLen + 1;
                  // We cannot use the frame length of the array audio buffer to determine the next start frame because
                  // AudioContext.decodeAudioData might change the sample rate of the original file. (E.g. Recordings from Mac/iOS with SR 44100 and listen to the on Windows platform will resmaple the audio data to 48000.)
                  // Frame count then differs on client and server

                  // Simply proceed in steps of frameLength
                  // More advanced method would be to parse the WAV header to find out the rela frame length of the chunk audio file
                  startFrame+=frameLength;
                  //console.debug("Next start frame: "+startFrame);
                  //console.debug("chunkedAudioRequest: expand() subscriber.closed: "+subscriber.closed);
                  return this.chunkAudioRequest(aCtx, baseAudioUrl, startFrame, frameLength);
                }
              } else {
                return EMPTY;
              }
            }else{
              return EMPTY;
            }
          }
        ),
      map(ab => {
        if(ab===null){
          return null;
        }
        if (arrayAudioBuffer) {
          arrayAudioBuffer.appendAudioBuffer(ab);
        } else {
          arrayAudioBuffer = ArrayAudioBuffer.fromAudioBuffer(ab,ab.length);
        }
        if (ab.length < frameLength) {
          arrayAudioBuffer.seal();
        }
        return arrayAudioBuffer;
      })
      ).subscribe({
        next: (aab)=>{
          //console.debug("chunkedAudioRequest: subscriber.closed: "+subscriber.closed);
          subscriber.next(aab)
        },
        complete: ()=>{
          subscriber.complete()
        },
        error: (err)=>{
          if(err instanceof HttpErrorResponse){
            if (err.status == 404) {
              if(arrayAudioBuffer){
                arrayAudioBuffer.seal();
                subscriber.next(arrayAudioBuffer);
                subscriber.complete();
              }else {
                // Interpret not as an error, the file ist not recorded yet
                subscriber.next(null);
                subscriber.complete();
              }
            //   observer.complete()
             } else {
              // all other states are errors
              subscriber.error(err);
             }
          }else{
            subscriber.error(err);
          }
        }
      });
    });
    return obs;
  }

  private chunkedInddbAudioRequest(aCtx:AudioContext,persistentAudioStorageTarget:PersistentAudioStorageTarget,baseAudioUrl:string): Observable<IndexedDbAudioBuffer|null> {
    let obs=new Observable<IndexedDbAudioBuffer|null>(subscriber => {
      let inddbAudioBuffer: IndexedDbAudioBuffer | null = null;
      let startFrame=0;
      let frameLength = DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH;
      //console.debug("chunkedInddbAudioRequest: Chunk audio request for inddb. startFrame: "+startFrame);
      let subscr=this.chunkAudioRequestToIndDb(aCtx,persistentAudioStorageTarget,null, baseAudioUrl, startFrame, frameLength).pipe(

        expand(iab => {
         // console.debug("chunkedInddbAudioRequest (pipe/expand): Got inddb ab: "+iab);
            if(subscriber.closed){
              subscr.unsubscribe();
            }
            if (iab) {
              inddbAudioBuffer=iab;
              //if (inddbAudioBuffer) {
                if (inddbAudioBuffer?.sealed()) {
                  return EMPTY;
                } else {
                  //let nextStartFrame=inddbAudioBuffer.frameLen + 1;
                  // We cannot use the frame length of the array audio buffer to determine the next start frame because
                  // AudioContext.decodeAudioData might change the sample rate of the original file. (E.g. Recordings from Mac/iOS with SR 44100 and listen to the on Windows platform will resmaple the audio data to 48000.)
                  // Frame count then differs on client and server

                  // Simply proceed in steps of frameLength
                  // More advanced method would be to parse the WAV header to find out the rela frame length of the chunk audio file
                  startFrame+=frameLength;
                  //console.debug("Next start frame: "+startFrame);
                  //console.debug("chunkedInddbAudioRequest: expand() subscriber.closed: "+subscriber.closed);
                  return this.chunkAudioRequestToIndDb(aCtx,persistentAudioStorageTarget,inddbAudioBuffer, baseAudioUrl, startFrame, frameLength);
                }
              // } else {
              //   return EMPTY;
              // }
            }else{
              return EMPTY;
            }
          }
        )
      ).subscribe({
        next: (aab)=>{
          //console.debug("chunkedInddbAudioRequest: subscriber.closed: "+subscriber.closed);
          subscriber.next(aab)
        },
        complete: ()=>{
          subscriber.complete()
        },
        error: (err)=>{
          if(err instanceof HttpErrorResponse){
            if (err.status == 404) {
              //console.debug("chunkedInddbAudioRequest: Received HTTP 404 not found.");
              if(inddbAudioBuffer){
                inddbAudioBuffer.seal();
                //console.debug("chunkedInddbAudioRequest: Sealed inddb audio buffer.");
                subscriber.next(inddbAudioBuffer);
                subscriber.complete();
              }else {
                // Interpret not as an error, the file ist not recorded yet
                //console.debug("chunkedInddbAudioRequest: Interpret HTTP 404 as not recorded yet.");
                subscriber.next(null);
                subscriber.complete();
              }
              //   observer.complete()
            } else {
              // all other states are (real) errors
              console.error("chunkedInddbAudioRequest: Error: "+err.message);
              subscriber.error(err);
            }
          }else {
            // all other errors are (real) errors
            console.error("chunkedInddbAudioRequest: Error: "+err);
            subscriber.error(err);
          }
        }
      });
    });
    return obs;
  }


  // private chunkedNetAudioRequest(aCtx:AudioContext,baseAudioUrl:string): Observable<NetAudioBuffer|null> {
  //   let obs=new Observable<NetAudioBuffer|null>(subscriber => {
  //     let inddbAudioBuffer: NetAudioBuffer | null = null;
  //     let startFrame=0;
  //     let frameLength = DEFAULT_CHUNKED_DOWNLOAD_FRAMELENGTH;
  //     //console.debug("chunkedInddbAudioRequest: Chunk audio request for inddb. startFrame: "+startFrame);
  //     let subscr=this.chunkAudioRequestToIndDb(aCtx,persistentAudioStorageTarget,null, baseAudioUrl, startFrame, frameLength).pipe(
  //
  //         expand(iab => {
  //               // console.debug("chunkedInddbAudioRequest (pipe/expand): Got inddb ab: "+iab);
  //               if(subscriber.closed){
  //                 subscr.unsubscribe();
  //               }
  //               if (iab) {
  //                 inddbAudioBuffer=iab;
  //                 //if (inddbAudioBuffer) {
  //                 if (inddbAudioBuffer?.sealed()) {
  //                   return EMPTY;
  //                 } else {
  //                   //let nextStartFrame=inddbAudioBuffer.frameLen + 1;
  //                   // We cannot use the frame length of the array audio buffer to determine the next start frame because
  //                   // AudioContext.decodeAudioData might change the sample rate of the original file. (E.g. Recordings from Mac/iOS with SR 44100 and listen to the on Windows platform will resmaple the audio data to 48000.)
  //                   // Frame count then differs on client and server
  //
  //                   // Simply proceed in steps of frameLength
  //                   // More advanced method would be to parse the WAV header to find out the rela frame length of the chunk audio file
  //                   startFrame+=frameLength;
  //                   //console.debug("Next start frame: "+startFrame);
  //                   //console.debug("chunkedInddbAudioRequest: expand() subscriber.closed: "+subscriber.closed);
  //                   return this.chunkAudioRequestToIndDb(aCtx,persistentAudioStorageTarget,inddbAudioBuffer, baseAudioUrl, startFrame, frameLength);
  //                 }
  //                 // } else {
  //                 //   return EMPTY;
  //                 // }
  //               }else{
  //                 return EMPTY;
  //               }
  //             }
  //         )
  //     ).subscribe({
  //       next: (aab)=>{
  //         //console.debug("chunkedInddbAudioRequest: subscriber.closed: "+subscriber.closed);
  //         subscriber.next(aab)
  //       },
  //       complete: ()=>{
  //         subscriber.complete()
  //       },
  //       error: (err)=>{
  //         if(err instanceof HttpErrorResponse){
  //           if (err.status == 404) {
  //             //console.debug("chunkedInddbAudioRequest: Received HTTP 404 not found.");
  //             if(inddbAudioBuffer){
  //               inddbAudioBuffer.seal();
  //               //console.debug("chunkedInddbAudioRequest: Sealed inddb audio buffer.");
  //               subscriber.next(inddbAudioBuffer);
  //               subscriber.complete();
  //             }else {
  //               // Interpret not as an error, the file ist not recorded yet
  //               //console.debug("chunkedInddbAudioRequest: Interpret HTTP 404 as not recorded yet.");
  //               subscriber.next(null);
  //               subscriber.complete();
  //             }
  //             //   observer.complete()
  //           } else {
  //             // all other states are (real) errors
  //             console.error("chunkedInddbAudioRequest: Error: "+err.message);
  //             subscriber.error(err);
  //           }
  //         }else {
  //           // all other errors are (real) errors
  //           console.error("chunkedInddbAudioRequest: Error: "+err);
  //           subscriber.error(err);
  //         }
  //       }
  //     });
  //   });
  //   return obs;
  // }

  audioFileUrlById(projectName: string, sessId: string | number, recFileId: string|number){
    let recFilesUrl=this.sessionRecordingFilesUrl(projectName,sessId);
    let encRecFileId=encodeURIComponent(recFileId);
    return recFilesUrl + '/' + encRecFileId;
  }

  private fetchAudiofile(projectName: string, sessId: string | number, recFileId: string|number): Observable<HttpResponse<ArrayBuffer>> {
    let recUrl = this.audioFileUrlById(projectName,sessId,recFileId);
    return this.audioRequest(recUrl);
  }

  audioFileUrl(projectName: string, recordingFile:RecordingFile):string|null {
    let url:string|null = null;
    let recFileId = recordingFile.recordingFileId;
    if (!recFileId) {
      recFileId = recordingFile.uuid;
    }
    if (recordingFile.session && recFileId) {
      url = this.audioFileUrlById(projectName, recordingFile.session, recFileId);
    }
    return url;
  }

  private fetchSprAudiofile(projectName: string, sessId: string | number, itemcode: string,version:number): Observable<HttpResponse<ArrayBuffer>> {
    let recFilesUrl=this.sessionRecFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrl = recFilesUrl + '/' + encItemcode +'/'+version;
    return this.audioRequest(recUrl);
  }

  public sprAudioFileUrlByItemcode(projectName: string, sessId: string | number, itemcode: string,version:number){
    let recFilesUrl=this.sessionRecFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrl = recFilesUrl + '/' + encItemcode +'/'+version;
    return recUrl;
  }

  sprAudioFileUrl(projectName: string, recordingFile:SprRecordingFile):string|null{
    let url=null;
    if(recordingFile.session) {
      url = this.sprAudioFileUrlByItemcode(projectName, recordingFile.session, recordingFile.itemCode, recordingFile.version);
    }
    return url;
  }



  private fetchSprAudiofileArrayBuffer(aCtx:AudioContext,projectName: string, sessId: string | number, itemcode: string,version:number): Observable<ArrayAudioBuffer|null>{
    let recFilesUrl=this.sessionRecFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrl = recFilesUrl + '/' + encItemcode +'/'+version;
    return this.chunkedAudioRequest(aCtx,recUrl);
  }

  private fetchSprAudiofileInddbBuffer(aCtx:AudioContext, persistentAudioStorageTarget:PersistentAudioStorageTarget,projectName: string, sessId: string | number, itemcode: string,version:number): Observable<IndexedDbAudioBuffer|null>{
    let recFilesUrlStr=this.sessionRecFilesUrl(projectName,sessId);
    let encItemcode=encodeURIComponent(itemcode);
    let recUrlStr = recFilesUrlStr + '/' + encItemcode +'/'+version;
    //let recUrl=new URL(recUrlStr);
    return this.chunkedInddbAudioRequest(aCtx,persistentAudioStorageTarget,recUrlStr);
  }

  // private sprNetAudiofileBuffer(aCtx:AudioContext,projectName: string, sessId: string | number, itemcode: string,version:number): Observable<IndexedDbAudioBuffer|null>{
  //   let recFilesUrlStr=this.sessionRecFilesUrl(projectName,sessId);
  //   let encItemcode=encodeURIComponent(itemcode);
  //   let recUrlStr = recFilesUrlStr + '/' + encItemcode +'/'+version;
  //   //let recUrl=new URL(recUrlStr);
  //   return this.chunkedInddbAudioRequest(aCtx,recUrlStr);
  // }

  fetchRecordingFileAudioBuffer(aCtx: AudioContext, projectName: string, recordingFile:RecordingFile):Observable<AudioBuffer|null> {

    let wobs = new Observable<AudioBuffer|null>(observer=>{
      let recFileId=recordingFile.recordingFileId;
      if(!recFileId){
        recFileId=recordingFile.uuid;
      }
      if(recordingFile.session && recFileId) {

        let obs = this.fetchAudiofile(projectName, recordingFile.session, recFileId);
        obs.subscribe(resp => {
            // Do not use Promise version, which does not work with Safari 13 (13.0.5)
            if (resp.body) {
              aCtx.decodeAudioData(resp.body, ab => {
                  observer.next(ab);
                  observer.complete();
              }, error => {
                observer.error(error);
                observer.complete();
              })
            } else {
              observer.error('Fetching audio file: response has no body');
            }
          }, (err) => {
          if(err instanceof HttpErrorResponse) {
            if (err.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(err);
              observer.complete();
            }
          }else{
            observer.error(err);
          }
          });
      }else{
        observer.error();
      }
    });

    return wobs;
  }

  fetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string, recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile|null>(observer=>{
      let recFileId=recordingFile.recordingFileId;
      if(!recFileId){
        recFileId=recordingFile.uuid;
      }
      if(recordingFile.session && recFileId) {

        let obs = this.fetchAudiofile(projectName, recordingFile.session, recFileId);
        obs.subscribe(resp => {
            //console.log("Fetched audio file. HTTP response status: "+resp.status+", type: "+resp.type+", byte length: "+ resp.body.byteLength);

            // Do not use Promise version, which does not work with Safari 13 (13.0.5)
            if (resp.body) {
              aCtx.decodeAudioData(resp.body, ab => {
                let adh=new AudioDataHolder(ab,null);
                RecordingFileUtils.setAudioData(recordingFile,adh);
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
          (err) => {
          if(err instanceof HttpErrorResponse) {
            if (err.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(err);
              observer.complete();
            }
          }else{
            observer.error(err);
          }
          });
      }else{
        observer.error();
      }
    });

    return wobs;
  }

  fetchSprRecordingFileAudioBuffer(aCtx: AudioContext, projectName: string, recordingFile:SprRecordingFile):Observable<AudioBuffer|null> {

    let wobs = new Observable<AudioBuffer|null>(observer=>{
      if(recordingFile.session) {
        let obs = this.fetchSprAudiofile(projectName, recordingFile.session, recordingFile.itemCode, recordingFile.version);
        obs.subscribe({
          next: resp => {
            // Do not use Promise version, which does not work with Safari 13 (13.0.5)
            if (resp.body) {
              aCtx.decodeAudioData(resp.body, ab => {
                //RecordingFileUtils.setAudioData(recordingFile,new AudioDataHolder(ab,null));
                observer.next(ab);
                observer.complete();

              }, error => {
                observer.error(error);
                observer.complete();
              })
            } else {
              observer.error('Fetching audio file: response has no body');
            }
          },
          error: (err) => {
            if (err instanceof HttpErrorResponse && err.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(err);
            }
          }});
      }else{
        observer.error();
      }
    });

    return wobs;
  }


  fetchSprRecordingFileArrayAudioBuffer(aCtx: AudioContext, projectName: string, recordingFile:SprRecordingFile):Observable<ArrayAudioBuffer|null> {
    let wobs = new Observable<ArrayAudioBuffer|null>(observer=>{
      if(recordingFile.session) {
        let obs = this.fetchSprAudiofileArrayBuffer(aCtx,projectName, recordingFile.session, recordingFile.itemCode, recordingFile.version);
        let subscr=obs.subscribe({
          next: aab => {
            //console.debug("fetchSprRecordingFileArrayAudioBuffer: observer.closed: "+observer.closed);
            if(observer.closed){
              subscr.unsubscribe()
            }
            observer.next(aab)
          },
          complete: ()=> {observer.complete();},
          error: (err) => {
            if (err instanceof  HttpErrorResponse && err.status == 404) {
              // Interpret not as an error, the file ist not recorded yet
              observer.next(null);
              observer.complete()
            } else {
              // all other states are errors
              observer.error(err);
            }
          }});
      }else{
        observer.error(new Error('Could not get session ID of recording file'));
      }
    });

    return wobs;
  }

  fetchSprRecordingFileIndDbAudioBuffer(aCtx: AudioContext,persistentAudioStorageTarget:PersistentAudioStorageTarget, projectName: string, recordingFile:SprRecordingFile):Observable<IndexedDbAudioBuffer|null> {
    let wobs = new Observable<IndexedDbAudioBuffer|null>(observer=>{
      if(recordingFile.session) {
        let obs = this.fetchSprAudiofileInddbBuffer(aCtx,persistentAudioStorageTarget,projectName, recordingFile.session, recordingFile.itemCode, recordingFile.version);
        let subscr=obs.subscribe({
          next: aab => {
            //console.debug("fetchSprRecordingFileIndDbAudioBuffer: observer.closed: "+observer.closed);
            if(observer.closed){
              subscr.unsubscribe()
            }
            observer.next(aab)
          },
          complete: ()=> {observer.complete();},
          error: (err) => {
            if(err instanceof HttpErrorResponse && err.status == 404) {
                // Interpret not as an error, the file ist not recorded yet
                observer.next(null);
                observer.complete()
              } else {
                // all other errors are real errors
                observer.error(err);
              }
          }});
      }else{
        observer.error();
      }
    });

    return wobs;
  }


  fetchSprRecordingFileNetAudioBuffer(aCtx: AudioContext,projectName: string, recordingFile:SprRecordingFile):Observable<NetAudioBuffer|null> {
    let wobs = new Observable<NetAudioBuffer|null>(observer=>{
      if(recordingFile.session) {
        let baseUrl=this.sprAudioFileUrl(projectName,recordingFile);
        //let obs = this.fetchSprNetAudiofileBuffer(aCtx,baseUrl,recordingFile.sampleRate,recordingFile.frames);
        if(baseUrl) {
          let obs = this.chunkAudioRequestToNetAudioBuffer(aCtx, baseUrl, 0, AudioCapture.BUFFER_SIZE,recordingFile.sampleRate,recordingFile.frames);
          let subscr = obs.subscribe({
            next: aab => {
              //console.debug("fetchSprRecordingFileIndDbAudioBuffer: observer.closed: "+observer.closed);
              if (observer.closed) {
                subscr.unsubscribe()
              }
              observer.next(aab)
            },
            complete: () => {
              observer.complete();
            },
            error: (err) => {
              if (err instanceof HttpErrorResponse && err.status == 404) {
                // Interpret not as an error, the file ist not recorded yet
                observer.next(null);
                observer.complete()
              } else {
                // all other errors are real errors
                observer.error(err);
              }
            }
          });
        }else{
          observer.error();
        }
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
                  RecordingFileUtils.setAudioData(recordingFile,new AudioDataHolder(ab,null));
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
            (err) => {
              if (err instanceof HttpErrorResponse && err.status == 404) {
                // Interpret not as an error, the file ist not recorded yet
                observer.next(null);
                observer.complete()
              } else {
                // all other states are errors
                observer.error(err);
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
              let adh=new AudioDataHolder(ab,null);
              let rf = new SprRecordingFile(sessId, itemcode, version, adh);
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
        (err) => {
          if (err instanceof HttpErrorResponse && err.status == 404) {
            // Interpret not as an error, the file ist not recorded yet
            observer.next(null);
            observer.complete()
          }else{
            // all other errors are real errors
            observer.error(err);
          }
        });
    });

    return wobs;
  }
}



