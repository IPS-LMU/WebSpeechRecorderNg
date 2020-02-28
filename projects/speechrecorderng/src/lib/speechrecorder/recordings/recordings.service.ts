/**
 * Created by klausj on 17.06.2017.
 */
import {Inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams, HttpResponse} from "@angular/common/http";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";

import {UUID} from "../../utils/utils";
import {RecordingFile, RecordingFileDescriptor, RecordingFileDTO} from "../recording";
import {ProjectService} from "../project/project.service";
import {SessionService} from "../session/session.service";
import {Observable} from "rxjs";
import {SprDb, Sync} from "../../db/inddb";
import {Session} from "../session/session";
import {PromptItem} from "../../../public_api";


export const REC_API_CTX='recfile'



@Injectable()
export class RecordingService {

  public static readonly KEYNAME = 'recfile'
  private apiEndPoint: string;
  private withCredentials: boolean = false;
  //private debugDelay:number=10000;
  private debugDelay:number=0;

  constructor(private sprDb:SprDb,private http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) private config?: SpeechRecorderConfig) {

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

  recordingFileDescrList(projectName: string, sessId: string | number):Observable<Array<RecordingFileDescriptor>> {

    let recFilesUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' +
      SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.KEYNAME;
    let httpParams=new HttpParams()
    httpParams.set('cache', 'false');
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recFilesUrl = recFilesUrl + '.json'
      httpParams.set('requestUUID',UUID.generate())
    }
    let obs=new Observable<Array<RecordingFileDescriptor>>(subscriber => {
      let httpObs = this.http.get<Array<RecordingFileDescriptor>>(recFilesUrl,{params:httpParams,withCredentials:this.withCredentials});
      httpObs.subscribe(value=>{
        subscriber.next(value);
      },err=>{
        let rfDescrs=new Array<RecordingFileDescriptor>()
        let idbObs = this.sprDb.prepare();
        idbObs.subscribe(value => {

          let sessStoreName=RecordingService.KEYNAME
          if(value.objectStoreNames.contains(sessStoreName)){
            let rfTr = value.transaction(sessStoreName)
            let rfSto = rfTr.objectStore(RecordingService.KEYNAME);
            //let sessIdx=rfSto.index('sessIdItemcodeIdx')
            let sessIdx=rfSto.index('sessIdIdx')
            console.debug("Get all recording from sessionId: "+sessId)
            let allS=sessIdx.getAll(IDBKeyRange.only([sessId]));

            allS.onsuccess = (ev) => {
              console.info("Found " + allS.result.length + " recFiles")
              let allRfDtos:Array<RecordingFileDTO>=allS.result;
              rfDescrs=allRfDtos.map(value=>{
                let rfDescr=new RecordingFileDescriptor()
                let pi={itemcode:value.itemCode}
                rfDescr.recording=pi
                rfDescr.version=value.version
                return rfDescr
              })

              subscriber.next(<Array<RecordingFileDescriptor>>rfDescrs);
              subscriber.complete()
            }
            allS.onerror= (ev)=>{
              subscriber.error()
            }
          }else{
            subscriber.next(rfDescrs);
            subscriber.complete()
          }
        },(err)=>{
          subscriber.error(err)
        })
      },()=>{
          subscriber.complete()
      })
    })
    return obs;

  }

  private fetchAudiofile(projectName: string, sessId: string | number, itemcode: string,version:number): Observable<HttpResponse<ArrayBuffer>> {
    let httpParams=new HttpParams()
    httpParams.set('cache', 'false');
    let recUrl = this.apiEndPoint + ProjectService.PROJECT_API_CTX + '/' + projectName + '/' +
      SessionService.SESSION_API_CTX + '/' + sessId + '/' + RecordingService.KEYNAME + '/' + itemcode+'/'+version;
    if (this.config && this.config.apiType === ApiType.FILES) {
      // for development and demo
      // append UUID to make request URL unique to avoid localhost server caching
      recUrl = recUrl + '.wav'
      httpParams.append('requestUUID=',UUID.generate())
    }


    return this.http.get(recUrl, {
      observe: 'response',
      responseType: 'arraybuffer',
      params: httpParams,
      withCredentials: this.withCredentials
    });

  }

  // TODO test

  fetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string,recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile>(observer=>{

      let obs = this.fetchAudiofile(projectName, recordingFile.sessionId, recordingFile.itemCode,recordingFile.version);
      obs.subscribe(resp => {
          let dec=aCtx.decodeAudioData(resp.body);
          dec.then(ab=>{
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
            // Does not work correctly when development server is used, which does not store the recordings
            observer.next(null);
            observer.complete()
          }else{
            // all other states are errors
            //observer.error(error);
            //observer.complete();

            // Likely offline try indexed db cache
            this.sprDb.prepare().subscribe(value => {

              let rfTr = value.transaction(RecordingService.KEYNAME)
              let rfSto = rfTr.objectStore(RecordingService.KEYNAME);
              let sessIdx=rfSto.index('sessIdItemcodeIdx')

              console.debug("Get all recordings for sessionId and itemcode: " + recordingFile.sessionId+ " "+recordingFile.itemCode)
              let allS = sessIdx.getAll(IDBKeyRange.only([recordingFile.sessionId,recordingFile.itemCode]));

              allS.onsuccess = (ev) => {
                console.info("Found " + allS.result.length + " recFiles")
                let allRfDtos: Array<RecordingFileDTO> = allS.result;
                let hVers = -1;
                let hVersRfDto: RecordingFileDTO;
                for (let i = 0; i < allRfDtos.length; i++) {
                  let rfDto = allRfDtos[i]
                  if (rfDto.version > hVers) {
                    hVers = rfDto.version
                    hVersRfDto = rfDto
                  }
                }
                console.info("Selected itemcode: " + hVersRfDto.itemCode+ ' version: ' +hVersRfDto.version)
                let fileReader = new FileReader();
                fileReader.onload = (ev) => {
                  console.info("File (Blob) reader onload...")
                  let arrBuf: ArrayBuffer = <ArrayBuffer>fileReader.result
                  console.info("Arr buffer byte len: "+arrBuf.byteLength)
                  let dec = aCtx.decodeAudioData(arrBuf);
                  dec.then(ab => {
                    console.info("Audio file decoded.")
                    if(!ab){
                      console.error("Audio buffer is null!!")
                    }
                    //let rf = new RecordingFile(hVersRfDto.sessionId, hVersRfDto.itemCode, hVersRfDto.version, ab);
                    recordingFile.audioBuffer=ab
                    //rf.uuid=hVersRfDto.uuid
                    observer.next(recordingFile);
                    observer.complete();

                  });
                  dec.catch((reason)=>{
                    console.error("Audio decoding failed! "+reason)
                    observer.error(reason)
                  })
                }
                fileReader.readAsArrayBuffer(hVersRfDto.audioBlob);
              }
              allS.onerror = (ev) => {
                observer.error()
              }
            }, (err) => {
              observer.error(err)
            })

          }
        });
    });

    return wobs;
  }


  getCachedOrFetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string,recordingFile:RecordingFile):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile>(observer=> {
      // Try indexed db cache
      this.sprDb.prepare().subscribe(value => {

        let rfTr = value.transaction(RecordingService.KEYNAME)
        let rfSto = rfTr.objectStore(RecordingService.KEYNAME);
        let sessIdx = rfSto.index('sessIdItemcodeIdx')

        //console.log("Get all recordings for sessionId and itemcode: " + recordingFile.sessionId + " " + recordingFile.itemCode)
        let allS = sessIdx.getAll(IDBKeyRange.only([recordingFile.sessionId, recordingFile.itemCode]));

        allS.onsuccess = (ev) => {
          let allRfDtos: Array<RecordingFileDTO> = allS.result;
          if (allRfDtos.length > 0) {

            let rfDtoToFetch:RecordingFileDTO=null;

            let vers:number;

            if(recordingFile.version!=null) {
              vers=recordingFile.version
              //console.info("Requested version: "+vers)
            }else{

              // version not given, return latest
              let hVers = -1;
              for (let i = 0; i < allRfDtos.length; i++) {
                let rfDto = allRfDtos[i]
                //console.info("RfDTO idx "+i+" version: "+rfDto.version+", currently highest version: "+hVers)
                if (rfDto.version > hVers) {
                  hVers = rfDto.version
                }
              }
              vers=hVers;
            }
            for (let i = 0; i < allRfDtos.length; i++) {
              let rfDto = allRfDtos[i]
              if(rfDto.version==vers){
                rfDtoToFetch=rfDto;
                break;
              }
            }
            if(rfDtoToFetch) {
              let fileReader = new FileReader();
              fileReader.onload = (ev) => {
                let arrBuf: ArrayBuffer = <ArrayBuffer>fileReader.result
                let dec = aCtx.decodeAudioData(arrBuf);
                dec.then(ab => {
                  if (!ab) {
                    console.error("Audio buffer is null!!")
                  }
                  recordingFile.audioBuffer = ab
                  observer.next(recordingFile);
                  observer.complete();

                });
                dec.catch((reason) => {
                  console.error("Audio decoding failed! " + reason)
                  observer.error(reason)
                })
              }
              fileReader.readAsArrayBuffer(rfDtoToFetch.audioBlob);
            }else{
              console.error("Recording file: session: "+recordingFile.sessionId+", itemcode: "+recordingFile.itemCode+", version: "+vers+" not found!")
            }
          } else {
            let obs = this.fetchAudiofile(projectName, recordingFile.sessionId, recordingFile.itemCode, recordingFile.version);
            obs.subscribe(resp => {
                  let dec = aCtx.decodeAudioData(resp.body);
                  dec.then(ab => {
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
                  })
                },
                (error: HttpErrorResponse) => {

                  if (error.status == 404) {
                    // Interpret not as an error, the file ist not recorded yet
                    // Does not work correctly when development server is used, which does not store the recordings
                    observer.next(null);
                    observer.complete()
                  } else {
                    // all other states are errors
                    //observer.error(error);
                    //observer.complete();


                  }
                });

          }
        }
        allS.onerror = (ev) => {
          observer.error()
        }
      }, (err) => {
        observer.error(err)
      })
    });

    return wobs;
  }


  // getCachedOrFetchAndApplyRecordingFile(aCtx: AudioContext, projectName: string,sessionId:string,rfDescrs:Array<RecordingFileDescriptor>):Observable<RecordingFile|null> {
  //
  //
  //   let obss=new Array<Observable<RecordingFile>>();
  //   rfDescrs.forEach((rfDescr)=>{
  //
  //     let ic = rfDescr.recording.itemcode
  //     let ve = rfDescr.version
  //     let rf = new RecordingFile(sessionId, ic, ve, null);
  //
  //
  //   })
  //   let wobs = new Observable<RecordingFile>(observer=> {
  //     // Try indexed db cache
  //     this.sprDb.prepare().subscribe(value => {
  //
  //       let rfTr = value.transaction(RecordingService.KEYNAME)
  //       let rfSto = rfTr.objectStore(RecordingService.KEYNAME);
  //       let sessIdx = rfSto.index('sessIdItemcodeIdx')
  //
  //       console.log("Get all recordings for sessionId and itemcode: " + recordingFile.sessionId + " " + recordingFile.itemCode)
  //       let allS = sessIdx.getAll(IDBKeyRange.only([recordingFile.sessionId, recordingFile.itemCode]));
  //
  //       allS.onsuccess = (ev) => {
  //         console.info("Found " + allS.result.length + " recFiles")
  //         let allRfDtos: Array<RecordingFileDTO> = allS.result;
  //         if (allRfDtos.length > 0) {
  //
  //
  //           let hVers = -1;
  //           let hVersRfDto: RecordingFileDTO;
  //           for (let i = 0; i < allRfDtos.length; i++) {
  //             let rfDto = allRfDtos[i]
  //             if (rfDto.version > hVers) {
  //               hVers = rfDto.version
  //               hVersRfDto = rfDto
  //             }
  //           }
  //           console.info("Selected itemcode: " + hVersRfDto.itemCode + ' version: ' + hVersRfDto.version)
  //           let fileReader = new FileReader();
  //           fileReader.onload = (ev) => {
  //             console.info("File (Blob) reader onload...")
  //             let arrBuf: ArrayBuffer = <ArrayBuffer>fileReader.result
  //             console.info("Arr buffer byte len: " + arrBuf.byteLength)
  //             let dec = aCtx.decodeAudioData(arrBuf);
  //             dec.then(ab => {
  //               console.info("Audio file decoded.")
  //               if (!ab) {
  //                 console.error("Audio buffer is null!!")
  //               }
  //               //let rf = new RecordingFile(hVersRfDto.sessionId, hVersRfDto.itemCode, hVersRfDto.version, ab);
  //               recordingFile.audioBuffer = ab
  //               //rf.uuid=hVersRfDto.uuid
  //               observer.next(recordingFile);
  //               observer.complete();
  //
  //             });
  //             dec.catch((reason) => {
  //               console.error("Audio decoding failed! " + reason)
  //               observer.error(reason)
  //             })
  //           }
  //           fileReader.readAsArrayBuffer(hVersRfDto.audioBlob);
  //         } else {
  //           let obs = this.fetchAudiofile(projectName, recordingFile.sessionId, recordingFile.itemCode, recordingFile.version);
  //           obs.subscribe(resp => {
  //                 let dec = aCtx.decodeAudioData(resp.body);
  //                 dec.then(ab => {
  //                   recordingFile.audioBuffer = ab;
  //                   if (this.debugDelay > 0) {
  //                     window.setTimeout(() => {
  //
  //                       observer.next(recordingFile);
  //                       observer.complete();
  //                     }, this.debugDelay);
  //                   } else {
  //                     observer.next(recordingFile);
  //                     observer.complete();
  //                   }
  //                 })
  //               },
  //               (error: HttpErrorResponse) => {
  //
  //                 if (error.status == 404) {
  //                   // Interpret not as an error, the file ist not recorded yet
  //                   // Does not work correctly when development server is used, which does not store the recordings
  //                   observer.next(null);
  //                   observer.complete()
  //                 } else {
  //                   // all other states are errors
  //                   //observer.error(error);
  //                   //observer.complete();
  //
  //
  //                 }
  //               });
  //
  //         }
  //       }
  //       allS.onerror = (ev) => {
  //         observer.error()
  //       }
  //     }, (err) => {
  //       observer.error(err)
  //     })
  //   });
  //
  //   return wobs;
  // }

  fetchRecordingFile(aCtx: AudioContext, projectName: string, sessId: string | number, itemcode: string,version:number):Observable<RecordingFile|null> {

    let wobs = new Observable<RecordingFile | null>(observer=>{
      let obs = this.fetchAudiofile(projectName, sessId, itemcode,version);


      obs.subscribe(resp => {
          let dec=aCtx.decodeAudioData(resp.body);
          dec.then(ab=>{
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


  postRecordingFileObserver(recFile:RecordingFileDTO,restUrl:string): Observable<RecordingFileDTO> {
    //return this.http.post<RecordingFile>(restUrl, recFile,{withCredentials: this.withCredentials});
    //TODO
    return new Observable<RecordingFileDTO>(subscriber => {
      subscriber.error(new Error('RecordingFile upload not implemented yet.'))
    })
  }

  addRecordingFileObserver(recFile:RecordingFileDTO,restUrl:string,upload:boolean): Observable<RecordingFileDTO> {

    let obs=new Observable<RecordingFileDTO>(subscriber => {

      let obs = this.sprDb.prepare();
      obs.subscribe(value => {
        let sessStoNm=RecordingService.KEYNAME;

        let rfTr = value.transaction(sessStoNm,'readwrite')
        let rfSto = rfTr.objectStore(sessStoNm);
        rfSto.add(recFile)
        rfTr.oncomplete = () => {
          if(upload) {
            this.postRecordingFileObserver(recFile, restUrl).subscribe((value) => {
              // stored to db and to server
              subscriber.next(value)
            }, (err) => {
              // Offline or other HTTP error
              // mark for delayed synchronisation
              let syncTr = value.transaction('_sync','readwrite')
              let syncSto = rfTr.objectStore('_sync');
              let sync = new Sync(sessStoNm, recFile.uuid)
              syncSto.add(sync)
              syncTr.oncomplete = () => {
                // OK: stored to db and marked for sync
                subscriber.next(recFile)
                subscriber.complete()
              }
              syncTr.onerror = () => {
                subscriber.error(err)
              }
            }, () => {
              // OK stored to db and to server complete
              subscriber.complete()
            })
          }else{
            subscriber.next(recFile)
            subscriber.complete()
          }
        }
      },(err)=>{
        subscriber.error(err)
      })
    });
    return obs;
  }



}



