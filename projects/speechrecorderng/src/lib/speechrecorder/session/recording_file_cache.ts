import {RecordingFile, SprRecordingFile} from "../recording";
import {Item} from "./item";
import {AudioDataHolder} from "../../audio/audio_data_holder";

export class SprItemsCache {

    //public static readonly DEFAULT_MAX_SAMPLES=20*60*48000;  // 20 Minutes mono 48kHz
   // TODO TEST ONLY!!!
    public static readonly DEFAULT_MAX_SAMPLES=30*48000;  // TEST 30 seconds
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
    if (this._sampleCount > this.maxSampleCount) {
      for (let ii = 0; ii < this._items.length; ii++) {
        if (this._sampleCount <= this.maxSampleCount) {
          break;
        }
        let it = this._items[ii];
        let itRfs = it.recs;
        if (itRfs && itRfs.length > 1) {
          for (let rfi = 0; rfi < itRfs.length - 1; rfi++) {
            if (this._sampleCount <= this.maxSampleCount) {
              break;
            }
            let toBeExpiredRf = itRfs[rfi];
            if (toBeExpiredRf.serverPersisted) {
              // expire recording files first stored to the cache
              let expiredAudio = toBeExpiredRf.expireAudioData();
              if (expiredAudio) {
                this._sampleCount -= expiredAudio.sampleCounts();
                console.info("Rec. files cache: Expired. Cache samples: " + this._sampleCount);
              }
            }
          }
        }
      }
    }
  }

    addSprRecFile(item:Item,sprRecFile:SprRecordingFile){
        this.expire();
        if(!item.recs) {
            item.recs=new Array<SprRecordingFile>();
        }
        item.recs.push(sprRecFile);
        this._sampleCount += sprRecFile.sampleCount();
      console.info("Rec. files cache: Added. Cache samples: "+this._sampleCount);
    }

    setSprRecFileAudioData(sprRecFile:SprRecordingFile, adh:AudioDataHolder|null){
      this._sampleCount-=sprRecFile.sampleCount();
      sprRecFile.audioDataHolder=adh;
      this._sampleCount+=sprRecFile.sampleCount();
      console.info("Rec. files cache: Set audio data. Cache samples: "+this._sampleCount);
    }
}
