import {RecordingFile} from "../recording";

export class Item {
    promptAsString: string;
    training: boolean;
    recs: Array<RecordingFile> | null;

    constructor(promptAsString: string, training: boolean) {
        this.promptAsString = promptAsString;
        this.training = training;
        this.recs = null;
    }

}
