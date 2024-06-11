
    import { HttpClient, HttpErrorResponse } from "@angular/common/http";
    import { timeout } from 'rxjs/operators'

    // state of an upload
    export enum UploadStatus {IDLE = 1, UPLOADING = 2,  ABORT = 3, DONE = 0, ERR = -1}

    // state of the uploader
    // TRY_UPLOADING is uploading state after an error (for example if disconnected from server)
    export enum UploaderStatus { DONE = 0, UPLOADING = 1, TRY_UPLOADING = 2,NEXT = 3, ERR = -1}

    export class UploaderStatusChangeEvent {
        private readonly _sizeQueued:number;
        private readonly _sizeDone:number;
        private readonly _status: UploaderStatus;


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

        sizeInQueue(){
          return this._sizeQueued-this._sizeDone;
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

      get serverPersistable(): ServerPersistable | null {
        return this._serverPersistable;
      }

        private readonly _data:Blob|FormData;
        private readonly _url:string;

        status: UploadStatus;
        onDone:((upload:Upload)=>void) | null=null;

        constructor(blob:Blob|FormData, url:string,private _serverPersistable:ServerPersistable|null=null) {
            this._data = blob;
            this._url = url;
            this.status = UploadStatus.IDLE;
        }

        get url():string {
            return this._url;
        }

        get data():Blob|FormData {
            return this._data;
        }

        done(){
            this.status=UploadStatus.DONE;
            //console.debug("Single upload done.");
            if(this._serverPersistable) {
              this._serverPersistable.serverPersisted = true;
              //console.debug("Single upload set server persisted: "+this.serverPersistable);
            }else{
              //console.debug("Server persistable not set.");
            }
            if(this.onDone){
              this.onDone(this);
            }
        }



      public toString = () : string => {
        let s=`Upload: Status: ${this.status}, URL: ${this._url}`;
        if(this._data instanceof Blob){
            s=s+`, Size: ${this._data.size}`;
        }else if(this._data instanceof  FormData){
           // TODO (iterate through parts ??)
        }
        return s;
      }
    }

    export class UploadHolder{

      onUploadSet:((upload:Upload)=>void)|null=null;

      get upload(): Upload | null {
        return this._upload;
      }

      set upload(value: Upload | null) {
        this._upload = value;
        if(this._upload && this.onUploadSet){
          this.onUploadSet(this._upload);
        }
      }
      private _upload:Upload|null=null;
    }

    export class UploadSet{

      private uploads: Array<Upload|UploadHolder>=new Array<Upload|UploadHolder>();
      private _complete=false;

      private _onDone:((uploadSet:UploadSet)=>void)|null=null;

      add(upload:Upload|UploadHolder){
        if(this._complete) {
          throw new Error('Cannot add upload to upload set. Upload set already complete.')
        }
        if(upload instanceof UploadHolder){
          upload.onUploadSet=(upl)=>{
            upl.onDone=()=>{
              this.checkUploadStates();
            }
            this.checkUploadStates();
          }
        }
        this.uploads.push(upload);

      }

      complete(){
        // Mark set as complete
        this._complete=true;

        // add listeners to each upload
        for(let upl of this.uploads){
          if(upl instanceof Upload) {
            upl.onDone = (upl: Upload) => {
              this.checkUploadStates();
            }
          }else if(upl instanceof UploadHolder){
            if(upl.upload){
              upl.upload.onDone = (upl: Upload) => {
                this.checkUploadStates();
              }
            }
          }
        }

        // check immediately if already done
        this.checkUploadStates();
      }

      set onDone(value: ((uploadSet: UploadSet) => void) | null) {
        this._onDone = value;
        this.checkUploadStates();
      }

      private checkUploadStates(){
        //console.debug("Check upload state...")
        if(this._complete){

          if(this._onDone) {
            for(let upl of this.uploads){
              if(upl instanceof Upload) {
                if (UploadStatus.DONE !== upl.status) {
                  // At least this upload is not yet done
                  // Do nothing
                  //console.debug("Check upload state: Upload not done.")
                  return;
                }
              }else if(upl instanceof UploadHolder){
                if(upl.upload){
                  if (UploadStatus.DONE !== upl.upload.status) {
                    // At least this upload is not yet done
                    // Do nothing
                    //console.debug("Check upload state: Upload (holder) not done.")
                    return;
                  }
                }else{
                  // The actual upload is not yet set
                  //console.debug("Check upload state: Upload (holder): upload not yet set.")
                  return;
                }
              }
            }
            // set is complete and all upload parts are done, call done callback
            //console.debug("Check upload state: All done.")
            this._onDone(this);
          }
        }
      }
    }

    export interface ServerPersistable{
        serverPersisted:boolean;
    }

    export class Uploader {
        POST_MIN_TIMEOUT = 120000; // 2min plus ...
        POST_TIMEOUT_PER_KB = 1000;  // ... 1s per kB

        RETRY_DELAY: number = 30000; // retry every 30s
        DEBUG_DELAY: number = 0;
        //DEBUG_DELAY:number=0;
        private status: UploaderStatus = UploaderStatus.DONE;
        private readonly que: Array<Upload>;
        listener: ((ue: UploaderStatusChangeEvent) => void) | null = null;
        private _sizeQueued: number = 0;
        private _sizeDone: number = 0;

        private retryTimerRunning = false;
        private retryTimerId: number | null = null;

        private te:TextEncoder=new TextEncoder();

        constructor(private http: HttpClient, private withCredentials: boolean = false) {
            this.que = new Array<Upload>();
        }

        private dataSize(dt:Blob|FormData){
            let si=0;
            if(dt instanceof Blob){
                si=dt.size;
            }else if(dt instanceof  FormData){
                dt.forEach((v,k)=>{
                    if(v instanceof File){
                        si+=v.size;
                    }else if(typeof v ==='string'){
                        // encode to UTF-8 to get upload size
                        si+= this.te.encode().length;
                    }
                })
            }
            return si;
        }

        private  uploadDone(ul:Upload) {

            ul.done();

            // remove upload from queue
            for (let i = 0; i < this.que.length; i++) {
                if (this.que[i] === ul) {
                    // found, remove
                    this.que.splice(i, 1);
                    let ulSize = this.dataSize(ul.data);
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
            if (UploaderStatus.ERR === this.status) {
                this.status = UploaderStatus.TRY_UPLOADING;
            } else {
                this.status = UploaderStatus.UPLOADING;
            }

            let dSize=this.dataSize(ul.data);
            let timeoutForDataSize=dSize*this.POST_TIMEOUT_PER_KB/1000;
            let timeoVal:number=Math.round(this.POST_MIN_TIMEOUT+timeoutForDataSize)
            // pipe(timeout()) is not the same as xhr.timeout

          let uploadedUpload:Upload|null=null;
            //console.debug("Post upload: "+ul)
            this.http.post(ul.url,ul.data,{withCredentials:this.withCredentials}).pipe(timeout(timeoVal)).subscribe(
                {
                    next: (data)=>
                    {
                        uploadedUpload = ul;
                        //console.debug('Next method called for upload: '+uploadedUpload)
                    }
                    , error:(err: HttpErrorResponse) => {
                        if (err.error instanceof Error) {
                            // A client-side or network error occurred. Handle it accordingly.
                            console.error('Upload error occurred:', err.error.message);
                        } else {
                            // The backend returned an unsuccessful response code.
                            // The response body may contain clues as to what went wrong,
                            console.error(`Upload error: Server returned code ${err.status}`);
                        }
                        this.processError(ul)
                    }, complete: () => {
                        //console.debug('Upload complete method called')
                        if (uploadedUpload) {
                            if (this.DEBUG_DELAY > 0) {
                                window.setTimeout(() => {
                                    this.uploadDone(ul);
                                }, this.DEBUG_DELAY);
                            } else {
                                this.uploadDone(uploadedUpload)
                            }
                        } else {
                            console.error('Upload post complete, but upload not set in next method!')
                        }
                    }
                });
        }

        private processError(ul:Upload) {
            //console.debug("Process upload error...")
            ul.status=UploadStatus.ERR
            this.status = UploaderStatus.ERR;

            let ue = new UploaderStatusChangeEvent(this._sizeQueued, this._sizeDone, this.status);
            if (this.listener) {
                this.listener(ue);
            }

            // set retry timer
            this.retryTimerId=window.setTimeout(() => {
                this.retryTimerRunning=false;
                //console.debug("Upload retry timer expired. Continue processing...")
                this.process();
            }, this.RETRY_DELAY);

            this.retryTimerRunning=true;
            //console.debug("Started upload retry timer "+this.RETRY_DELAY+"ms ...")
        }

      private process() {
        // clear retry timer if set
        if(this.retryTimerRunning){
            if(this.retryTimerId) {
                window.clearTimeout(this.retryTimerId)
            }
          this.retryTimerRunning=false
          //console.debug("Cleared retry timer.")
        }

        let pul: Upload | null = null;

        //console.debug("Uploader status: "+this.status)

        let s = this.que.length;
        //console.debug(s+" uploads are in the queue.")

        if (s>0 && UploaderStatus.UPLOADING != this.status && UploaderStatus.TRY_UPLOADING != this.status) {

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
            //console.debug("No regular upload found. Looking for error state uploads.")
            for (let i = 0; i < s; i++) {
              let ul = this.que[i];
              //console.log("Upload "+ul+" status:"+ul.status)
              if (ul.status === UploadStatus.ERR) {
                //console.log("Upload (ERR) "+ul+" startUpload")
                //console.debug("Start error state upload "+ul)
                this.startUpload(ul);
                pul = ul;
                break;
              }
            }
          }
        }
        if(s==0){
          //console.debug("Upload done.")
          this.status=UploaderStatus.DONE
        }
        let ue = new UploaderStatusChangeEvent(this._sizeQueued, this._sizeDone, this.status);
        if (this.listener) {
          this.listener(ue);
        }
      }

        queueUpload(ul: Upload) {
            if (ul) {
                let ulSize = this.dataSize(ul.data);
                this.que.push(ul);
                this._sizeQueued += ulSize;
                this.process();
            }
        }
    }


