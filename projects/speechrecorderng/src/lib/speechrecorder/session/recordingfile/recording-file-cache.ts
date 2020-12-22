import {RecordingFile} from "../../recording";


export class RecordingFileCache {
    private cache:Array<RecordingFile>=new Array();
    private cachedAudioBytes:number=0;
    limitBytes:number=null;

    push(recordingFile:RecordingFile){
        let asBytes=recordingFile.audioSizeInBytes;
        if(asBytes>0 && this.limitBytes!=null) {
            while( this.cachedAudioBytes+asBytes > this.limitBytes && this.cache.length>0){
                let expAudioBytes=0;
                for(let ci=0;ci<this.cache.length;ci++) {
                    let expireCandidate = this.cache[ci];
                    if(expireCandidate.isPersisted()) {
                        this.cache.splice(ci,1);
                        expAudioBytes = expireCandidate.audioSizeInBytes;
                        expireCandidate.audioBuffer = null;
                        this.cachedAudioBytes -= expAudioBytes;
                        console.debug("Recording file cache expired bytes: " + expAudioBytes);
                        break;
                    }
                }
                if(expAudioBytes===0){
                    // break if no files to expire
                    console.debug("Could not found recording file to expire!");
                    break;
                }
            }
        }
        this.cache.push(recordingFile);
        console.debug("Recording file cache pushed bytes: "+asBytes);
        this.cachedAudioBytes+=asBytes;
        console.log("Recording file number of cached files: "+this.cache.length+ ", cached bytes: "+this.cachedAudioBytes);
    }
}
