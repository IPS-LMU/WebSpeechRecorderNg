import {RecordingFile} from "../recording";

export class Item {
    recs: Array<RecordingFile> | null;

    constructor(promptAsString: string, training: boolean) {
        this.promptAsString = promptAsString;
        this.training = training;
        this.recs = null;
    }

    get promptAsString():string{
        return this._promptAsString;
    }

    get training():boolean{
        return this._training;
    }

    get recording():boolean{
        return this._recording;
    }

}
