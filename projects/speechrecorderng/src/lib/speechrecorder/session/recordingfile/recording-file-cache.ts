import {RecordingFile} from "../../recording";


export class RecordingFileCache {
    private cache:Array<RecordingFile>=new Array();
    private cachedAudioBytes:number=0;
    limitBytes:number=null;

    push(recordingFile:RecordingFile){
        let asBytes=recordingFile.audioSizeInBytes;
        if(asBytes!=null && this.limitBytes!=null) {
            while( this.cachedAudioBytes+asBytes > this.limitBytes && this.cache.length>0){
                let expired=this.cache.shift();
                let expAudioBytes=expired.audioSizeInBytes;
                expired.audioBuffer=null;
                this.cachedAudioBytes-=expAudioBytes;
            }
        }
    }
}
