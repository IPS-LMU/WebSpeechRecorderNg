import {FitToPageComponent} from "./ui/fit_to_page_comp";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {UploaderStatus, UploaderStatusChangeEvent} from "./net/uploader";


export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent extends FitToPageComponent implements ReadyStateProvider{

    dataSaved: boolean = true;

    constructor(protected uploader:SpeechRecorderUploader) {
    }
    abstract ready():boolean;
}

