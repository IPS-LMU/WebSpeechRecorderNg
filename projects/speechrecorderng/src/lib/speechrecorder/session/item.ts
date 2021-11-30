import {RecordingFile} from "../recording";

export class Item {
    recs: Array<RecordingFile> | null;

    constructor(private _promptAsString: string, private _training: boolean,private _recording:boolean) {
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
