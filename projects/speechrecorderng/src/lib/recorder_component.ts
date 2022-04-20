import {FitToPageComponent} from "./ui/fit_to_page_comp";

export interface ReadyStateProvider {
    ready():boolean;
}


export abstract class RecorderComponent extends FitToPageComponent implements ReadyStateProvider{
    abstract ready():boolean;
}

