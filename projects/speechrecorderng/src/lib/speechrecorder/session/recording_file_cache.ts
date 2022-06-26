import {RecordingFile, SprRecordingFile} from "../recording";
import {Item} from "./item";

export class SprItemsCache {

    public static readonly DEFAULT_MAX_SAMPLES=20*60*48000;  // 20 Minutes mono 48kHz
    private _items:Array<Item>=new Array<Item>();
    private _sampleCount:number=0;
    maxSampleCount:number=SprItemsCache.DEFAULT_MAX_SAMPLES;

    get items(): Array<Item> {
        return this._items;
    }

    addItem(item:Item){
        this._items.push(item);
    }

    getItem(index:number){
        return this._items[index];
    }

    length():number{
       return this._items.length;
    }

    private expire() {
        // expire corrected versions first
        while (this._sampleCount > this.maxSampleCount) {
            for (let ii = 0; ii < this._items.length; ii++) {
                let it = this._items[ii];
                let itRfs = it.recs;
                if (itRfs && itRfs.length > 1) {
                    for (let rfi = 0; rfi < itRfs.length - 1; rfi++) {
                        let toBeExpiredRf = itRfs[rfi];
                        if (toBeExpiredRf.serverPersisted) {
                            // expire recording files first stored to the cache
                            let expiredAudio = toBeExpiredRf.expireAudioData();
                            if (expiredAudio) {
                                this._sampleCount -= expiredAudio.sampleCounts();
                            }
                        }
                    }
                }
            }
        }
    }

    addSprRecFile(item:Item,sprRecFile:SprRecordingFile){
        if(!item.recs) {
            item.recs=new Array<SprRecordingFile>();
        }
        item.recs.push(sprRecFile);
        this._sampleCount += sprRecFile.sampleCount();
    }
}
