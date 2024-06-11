import { HttpClient, HttpHeaders, HttpResponse } from "@angular/common/http";
import {Inject} from "@angular/core";
import {ApiType, SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../../spr.config";
import {Observable} from "rxjs";
import {NetAudioBuffer} from "../../audio/net_audio_buffer";
import {UUID} from "../../utils/utils";
import {WavReader} from "../../audio/impl/wavreader";
import {PCMAudioFormat} from "../../audio/format";
import {AudioContextProvider} from "../../audio/context";

export class ChunkDownload{
  get orgPCMAudioFormat(): PCMAudioFormat {
    return this._orgPCMAudioFormat;
  }

  get orgFrameLength(): number {
    return this._orgFrameLength;
  }

  get decodedAudioBuffer(): AudioBuffer {
    return this._decodedAudioBuffer;
  }
  constructor(private _orgPCMAudioFormat:PCMAudioFormat,private _orgFrameLength:number,private _decodedAudioBuffer:AudioBuffer){}
}

export class BasicRecordingService{
  // iPad 9th generation, iOS 15.7.1, sometimes:
  // Failed to load resource: WebKit hat einen internen Fehler festgestellt
  // Firefox on Windows crashes
  public static readonly DEFAULT_CHUNKED_DOWNLOAD_SECONDS:number=10;
  public static readonly DEFAULT_MAX_NET_AUTO_MEM_STORE_SAMPLES:number=2880000*5; // Default 5 minutes one channel at 48kHz
  protected _maxAutoNetMemStoreSamples:number=Number.MAX_SAFE_INTEGER;
    protected apiEndPoint: string;
    protected withCredentials: boolean = false;

    constructor(protected http: HttpClient, @Inject(SPEECHRECORDER_CONFIG) protected config?: SpeechRecorderConfig) {
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
        if(config && config.apiVersion>1){
          this._maxAutoNetMemStoreSamples=BasicRecordingService.DEFAULT_MAX_NET_AUTO_MEM_STORE_SAMPLES;
        }
    }

    protected audioRequestByURL(audioBaseUrl:string,audioURLSearchParams:URLSearchParams): Observable<HttpResponse<ArrayBuffer>> {
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

    public chunkAudioRequest(baseAudioUrl:string,startFrame:number=0,frameLength:number): Observable<ChunkDownload|null> {

        let ausps=new URLSearchParams();
        ausps.set('startFrame',startFrame.toString());
        ausps.set('frameLength',frameLength.toString());
        if (this.config && this.config.apiType === ApiType.FILES) {
            // for development and demo
            // append UUID to make request URL unique to avoid localhost server caching
            //audioUrl = audioUrl + '.wav?requestUUID=' + UUID.generate();
            ausps.set('requestUUID',UUID.generate());
        }

        let obs=new Observable<ChunkDownload|null>(observer=> {
            this.audioRequestByURL(baseAudioUrl,ausps).subscribe(
                {
                    next: resp => {
                        // Do not use Promise version, which does not work with Safari 13 (13.0.5)
                        if (resp.body) {
                            //console.debug("chunkAudioRequest: observer.closed: "+observer.closed);
                            //console.debug("Audio file bytes: "+resp.body.byteLength);

                            // Check original audio format
                            let wr = new WavReader(resp.body);
                            const pcmFmt = wr.readFormat();
                            const orgFl = wr.frameLength();
                            // if(pcmFmt){
                            //   console.debug("Original WAVE format of download chunk: "+pcmFmt);
                            // }else{
                            //   console.error("Could not read WAVE format of original download chunk!");
                            // }
                            // if(orgFl){
                            //   console.debug("Original frame length of download chunk: "+orgFl);
                            // }else{
                            //   console.error("Could not read WAVE format of original download chunk!");
                            // }

                            if (pcmFmt && orgFl) {
                              AudioContextProvider.decodeAudioData(resp.body).then((ab)=>{
                                      //console.debug("Decoded audio chunk frames: "+ab.length);
                                      let chDl = new ChunkDownload(pcmFmt, orgFl, ab);
                                      observer.next(chDl);
                                      observer.complete();
                                    }).catch(error => {
                                      //if(error instanceof HttpErrorResponse) {
                                      // if (error.status == 404) {
                                      //   // Interpret not as an error, the file ist not recorded yet
                                      //   observer.next(null);
                                      //   observer.complete()
                                      // } else {
                                      //   // all other states are errors
                                      console.error("Recordings service chunkAudioRequest error decoding audio data: " + error.name + ": " + error.message);
                                      observer.error(error);
                                      // }
                                      // }
                                    });
                            } else {
                                const errMsg = 'Could not parse audio header for format and/or frame length of download.';
                                console.error(errMsg);
                                observer.error(errMsg);
                            }
                        } else {
                            const errMsg = 'Fetching audio file: response has no body';
                            console.error(errMsg);
                            observer.error(errMsg);
                        }
                    }, error:
                        (error) => {
                            // all other states are errors
                            //const errMsg='Fetching audio file HTTP error: '+error;
                            //console.error(errMsg);
                            observer.error(error);
                            //observer.complete();

                        }
                });
        });
        return obs;
    }


    protected chunkAudioRequestToNetAudioBuffer(baseAudioUrl: string, startFrame: number = 0, orgSampleRate: number, seconds:number,frames: number | null): Observable<NetAudioBuffer | null> {
        //let audioUrl=baseAudioUrl+'?startFrame='+startFrame+'&frameLength='+frameLength;
        //let audioUrl=new URL(baseAudioUrl);
        // if(orgSampleRate!=null && frameLength%orgSampleRate>0){
        //   const errMsg='frameLength must be equal or multiple of original samplerate.';
        //   console.error(errMsg+' ('+frameLength+'%'+orgSampleRate+'=='+(frameLength%orgSampleRate)+')');
        //   throw Error(errMsg)
        // }
        let frameLength:number=orgSampleRate*Math.round(seconds);
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
                        AudioContextProvider.decodeAudioData(resp.body).then(ab => {
                                //console.debug("chunkAudioRequestTonetAb: Decoded audio chunk frames for netAb: "+ab.length);
                                //console.debug("chunkAudioRequestTonetAb: Create netAb ab from chunk ab...");
                                if(frames===null){
                                    subscriber.error(new Error('Could not get frame length from recording file object'));
                                }else {
                                    let fl = frames;
                                    if (ab.sampleRate !== orgSampleRate) {
                                        if (orgSampleRate && frames) {
                                            fl = Math.round(ab.sampleRate * frames / orgSampleRate);
                                            //console.debug("Platform sr: "+ab.sampleRate+", file sr: "+orgSampleRate+", decoded/org frame length: "+fl+"/"+frames+", ab.length: "+ab.length);
                                        }
                                    }

                                    let nab = NetAudioBuffer.fromChunkAudioBuffer(this,baseAudioUrl, ab, fl,frameLength);
                                    //let rp=new ReadyProvider();
                                    //nab.readyProvider=rp;
                                    //rp.ready();
                                    nab.ready();
                                    if (nab.frameLen < frameLength) {
                                        //console.debug("chunkAudioRequestTonetAb: Built netAb ab from chunk ab: First chunk shorter tha frameLength ("+netAbAudioBuffer.frameLen+"<"+frameLength+"), assuming end of data, sealing netAb ab.");
                                        nab.seal();
                                    }
                                    subscriber.next(nab);

                                    subscriber.complete();
                                }
                            }).catch(error => {
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

}
