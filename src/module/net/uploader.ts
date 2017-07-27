

    // state of an upload
    import {Injectable} from "@angular/core";
    import {Http} from "@angular/http";

    export enum UploadStatus {IDLE = 1, UPLOADING = 2, ABORT = 3, DONE = 0, ERR = -1}

    // state of the uploader
    // TRY_UPLOADING is uploading state after an error (for example if disconnected from server)
    export enum UploaderStatus { DONE = 0, UPLOADING = 1, TRY_UPLOADING = 2, ERR = -1}

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
            return percent;
        }

    }

    export class Upload {

        private _data:any;
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
    }

@Injectable()
    export class Uploader {
        RETRY_DELAY: number = 30000;
        DEBUG_DELAY: number = 0;
        //DEBUG_DELAY:number=0;
        private status: UploaderStatus = UploaderStatus.DONE;
        private que:Array<Upload>;
        listener: (ue: UploaderStatusChangeEvent) => void;
        private _sizeQueued: number = 0;
        private _sizeDone: number = 0;

        constructor(private http: Http) {
            this.que = new Array<Upload>();
        }


        private  uploadDone(ul:Upload) {

            ul.status = UploadStatus.DONE;

            // remove upload rom queue
            for (let i = 0; i < this.que.length; i++) {
                if (this.que[i] == ul) {
                    // found, remove
                    this.que.splice(i, 1);
                    let ulSize = ul.data.size;
                    this._sizeDone += ulSize;
                    break;
                }
            }
            // set to done for now...
            this.status = UploaderStatus.DONE;
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

            this.http.post(ul.url,ul.data,{withCredentials:true}).toPromise()
              .then(response => {
                console.log("Upload ret val:" + response.status + " " + response.statusText);
                if (response.status >= 200 && response.status < 300) {
                  if (this.DEBUG_DELAY) {
                    window.setTimeout(() => {
                      this.uploadDone(ul);
                    }, this.DEBUG_DELAY);
                  } else {
                    this.uploadDone(ul);

                  }
                } else {
                  ul.status = UploadStatus.ERR;
                  this.processError();
                }
              })
              .catch((e)=>{

                // abort not supported by Angular HTTP ?
                console.log("Upload error");

                ul.status = UploadStatus.ERR;
                this.processError();
              });
        }

        private processError() {

            this.status = UploaderStatus.ERR;
            let ue = new UploaderStatusChangeEvent(this._sizeQueued, this._sizeDone, this.status);
            if (this.listener) {
                this.listener(ue);
            }

            window.setTimeout(() => {
                this.process();
            }, this.RETRY_DELAY);

        }

        private process() {

            let pul: Upload | null = null;

            // only serial uploads for now
            if (UploaderStatus.UPLOADING != this.status && UploaderStatus.TRY_UPLOADING != this.status) {

                let s = this.que.length;
                for (let i = 0; i < s; i++) {
                let ul = this.que[i];
                    if (ul.status === UploadStatus.IDLE) {
                        this.startUpload(ul);
                        pul = ul;
                        break;
                }
                }
                if (!pul) {
                // now failed uploads
                for (let i = 0; i < s; i++) {
                    let ul = this.que[i];
                    if (ul.status === UploadStatus.ERR) {
                        this.startUpload(ul);
                        pul = ul;
                        break;
                    }
                }
                }
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


