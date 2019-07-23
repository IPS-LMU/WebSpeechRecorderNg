
    import {HttpClient, HttpErrorResponse} from "@angular/common/http";
    import { timeout } from 'rxjs/operators'

    // state of an upload
    export enum UploadStatus {IDLE = 1, UPLOADING = 2,  ABORT = 3, DONE = 0, ERR = -1}

    // state of the uploader
    // TRY_UPLOADING is uploading state after an error (for example if disconnected from server)
    export enum UploaderStatus { DONE = 0, UPLOADING = 1, TRY_UPLOADING = 2,NEXT = 3, ERR = -1}

    export class UploaderStatusChangeEvent {
        private _sizeQueued:number;
        private _sizeDone:number;
        private _status: UploaderStatus;


        constructor(sizeQueued: number, sizeDone: number, status: UploaderStatus) {
            this._sizeQueued = sizeQueued;
            this._sizeDone = sizeDone;
            this._status = status;
        }

        get sizeQueued():number {
            return this._sizeQueued;
        }

        get sizeDone():number {
            return this._sizeDone;
        }

        get status(): UploaderStatus {
            return this._status;
        }

        uploadDone(): boolean {
            return (this._sizeDone >= this._sizeQueued);
        }

        percentDone(): number {
            if (this._sizeQueued == 0) {
                // no data queued, we are "done"
                return 100;
            }
            let percent = Math.floor(this._sizeDone * 100 / this._sizeQueued);
            //console.log("Upload status: queued: "+this._sizeQueued+", done: "+this._sizeDone+", "+percent+"%")
            return percent;
        }

    }

    export class Upload {

        private _data:Blob;
        private _url:string;
        status: UploadStatus;

        constructor(blob:Blob, url:string) {
            this._data = blob;
            this._url = url;
            this.status = UploadStatus.IDLE;
        }

        get url():string {
            return this._url;
        }

        get data():Blob {
            return this._data;
        }

      public toString = () : string => {

        return `Upload: Status: ${this.status}, URL: ${this._url}, Size: ${this._data.size}`;
      }
    }

    export class Uploader {
        POST_MIN_TIMEOUT=120000; // 2min plus ...
        POST_TIMEOUT_PER_KB=1000;  // ... 1s per kB

        RETRY_DELAY: number = 30000; // retry every 30s
        DEBUG_DELAY: number = 0;
        //DEBUG_DELAY:number=0;
        private status: UploaderStatus = UploaderStatus.DONE;
        private que:Array<Upload>;
        listener: (ue: UploaderStatusChangeEvent) => void;
        private _sizeQueued: number = 0;
        private _sizeDone: number = 0;

        private retryTimerRunning=false;
        private retryTimerId: number;

        constructor(private http: HttpClient,private withCredentials:boolean=false) {
            this.que = new Array<Upload>();
        }


        private  uploadDone(ul:Upload) {

            ul.status = UploadStatus.DONE;

            // remove upload from queue
            for (let i = 0; i < this.que.length; i++) {
                if (this.que[i] === ul) {
                    // found, remove
                    this.que.splice(i, 1);
                    let ulSize = ul.data.size;
                    this._sizeDone += ulSize;
                    break;
                }
            }
            // set to done for now...
            this.status = UploaderStatus.NEXT;
            // continue
            this.process();
        }

        private startUpload(ul:Upload) {

            ul.status = UploadStatus.UPLOADING;
            if (UploaderStatus.ERR == this.status) {
                this.status = UploaderStatus.TRY_UPLOADING;
            } else {
                this.status = UploaderStatus.UPLOADING;
            }

            let dSize=ul.data.size
            let timeoutForDataSize=dSize*this.POST_TIMEOUT_PER_KB/1000;
            let timeoVal:number=Math.round(this.POST_MIN_TIMEOUT+timeoutForDataSize)
            // pipe(timeout()) is not the same as xhr.timeout
            this.http.post(ul.url,ul.data,{withCredentials:this.withCredentials}).pipe(timeout(timeoVal)).subscribe(
              data => {

                if (this.DEBUG_DELAY) {
                window.setTimeout(() => {
                  this.uploadDone(ul);
                }, this.DEBUG_DELAY);
              } else {
                this.uploadDone(ul);

              }},
              (err: HttpErrorResponse) => {
                if (err.error instanceof Error) {
                  // A client-side or network error occurred. Handle it accordingly.
                  console.log('Upload error occurred:', err.error.message);
                } else {
                  // The backend returned an unsuccessful response code.
                  // The response body may contain clues as to what went wrong,
                  console.log(`Upload error: Server returned code ${err.status}`);
                }
                this.processError(ul)
              });
        }

        private processError(ul:Upload) {
            ul.status=UploadStatus.ERR
            this.status = UploaderStatus.ERR;



            let ue = new UploaderStatusChangeEvent(this._sizeQueued, this._sizeDone, this.status);
            if (this.listener) {
                this.listener(ue);
            }

            // set retry timer
            this.retryTimerId=window.setTimeout(() => {
                this.retryTimerRunning=false;
                this.process();
            }, this.RETRY_DELAY);
            this.retryTimerRunning=true;
        }

      private process() {
        // clear retry timer if set
        if(this.retryTimerRunning){
          window.clearTimeout(this.retryTimerId)
          this.retryTimerRunning=false
        }

        let pul: Upload | null = null;

        //console.log("Upload process, status: "+this.status)
        // only serial uploads for now
        if (UploaderStatus.UPLOADING != this.status && UploaderStatus.TRY_UPLOADING != this.status) {
          //console.log("Check IDLE uploads...")
          let s = this.que.length;
          for (let i = 0; i < s; i++) {
            let ul = this.que[i];
            //console.log("Upload "+ul+" status:"+ul.status)
            if (ul.status === UploadStatus.IDLE) {
              //console.log("Upload "+ul+" startUpload")
              this.startUpload(ul);
              pul = ul;
              break;
            }
          }
          if (!pul) {
            //console.log("Check ERR uploads...")
            // now failed uploads
            for (let i = 0; i < s; i++) {
              let ul = this.que[i];
              //console.log("Upload "+ul+" status:"+ul.status)
              if (ul.status === UploadStatus.ERR) {
                //console.log("Upload (ERR) "+ul+" startUpload")
                this.startUpload(ul);
                pul = ul;
                break;
              }
            }
          }
        }
        if(!pul){
          this.status=UploaderStatus.DONE
        }
        let ue = new UploaderStatusChangeEvent(this._sizeQueued, this._sizeDone, this.status);
        if (this.listener) {
          this.listener(ue);
        }


      }

        queueUpload(ul: Upload) {
            if (ul) {
                let ulSize = ul.data.size;
                this.que.push(ul);
                this._sizeQueued += ulSize;
                this.process();
            }
        }
    }


