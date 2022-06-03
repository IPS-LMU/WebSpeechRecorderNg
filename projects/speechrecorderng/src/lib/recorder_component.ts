import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {UploaderStatus, UploaderStatusChangeEvent} from "./net/uploader";


export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent implements ReadyStateProvider{

    dataSaved: boolean = true;

    constructor(protected uploader:SpeechRecorderUploader) {
    }

    abstract ready():boolean;
    abstract get screenLocked():boolean;
}

