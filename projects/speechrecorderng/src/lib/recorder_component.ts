import {FitToPageComponent} from "./ui/fit_to_page_comp";
import {SpeechRecorderUploader} from "./speechrecorder/spruploader";
import {Injector} from "@angular/core";


export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent extends FitToPageComponent implements ReadyStateProvider{

    dataSaved: boolean = true;

    constructor(injector:Injector,protected uploader:SpeechRecorderUploader) {
        super(injector);
    }
    abstract ready():boolean;
    abstract get screenLocked():boolean;
}

