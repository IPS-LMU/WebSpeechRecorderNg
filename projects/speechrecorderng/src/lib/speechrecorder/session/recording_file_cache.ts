import {RecordingFile, RecordingFileUtils, SprRecordingFile} from "../recording";
import {Item} from "./item";
import {AudioDataHolder} from "../../audio/audio_data_holder";

export class BasicRecFilesCache {

  //public static readonly DEFAULT_MAX_SAMPLES=20*60*48000;  // 20 Minutes mono 48kHz
  // TODO TEST ONLY!!!
  public static readonly DEFAULT_MAX_SAMPLES=30*48000;  // TEST 30 seconds

  protected _sampleCount:number=0;
  maxSampleCount:number=SprItemsCache.DEFAULT_MAX_SAMPLES;
  public currentRecordingFile:RecordingFile|null=null;
}



export class SprItemsCache extends BasicRecFilesCache{


    private _items:Array<Item>=new Array<Item>();

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


    private tryExpire(toBeExpiredRf:SprRecordingFile){
      console.debug("Rec. files cache: " + toBeExpiredRf.toString()+" try expire:");
      if(!toBeExpiredRf.equals(this.currentRecordingFile)) {
        console.debug("Rec. files cache: " + toBeExpiredRf.toString()+" not current file...");
        if (toBeExpiredRf.serverPersisted) {
          console.debug("Rec. files cache: " + toBeExpiredRf.toString()+" is server persisted...");
          // expire recording files first stored to the cache
          let expiredAudio = RecordingFileUtils.expireAudioData(toBeExpiredRf);
          if (expiredAudio) {
            this._sampleCount -= expiredAudio.sampleCounts();
            console.debug("Rec. files cache: Expired: " + toBeExpiredRf.toString()+". Cache samples now: " + this._sampleCount);
          }
        } else {
          console.debug("Rec. files cache: #" + toBeExpiredRf.toString() + " not yet persisted on server.");
        }
      }else{
        console.debug("Rec. files cache: " + toBeExpiredRf.toString()+" is current file.");
      }
    }

  private expire() {
    // expire corrected versions first
    console.debug("Rec. files cache: Expire? current: "+this._sampleCount+", max: "+this.maxSampleCount);
    if (this._sampleCount > this.maxSampleCount) {

      // expire older versions of an item first
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
            this.tryExpire(toBeExpiredRf);
          }
        }
      }

      // if that's not sufficient expire audio data of latest versions as well
      for (let ii = 0; ii < this._items.length; ii++) {
        if (this._sampleCount <= this.maxSampleCount) {
          break;
        }
        let it = this._items[ii];
        let itRfs = it.recs;

        if (itRfs && itRfs.length > 0) {
          for (let rfi = 0; rfi < itRfs.length; rfi++) {
            if (this._sampleCount <= this.maxSampleCount) {
              break;
            }
            let toBeExpiredRf = itRfs[rfi];
            this.tryExpire(toBeExpiredRf);
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
    this._sampleCount += RecordingFileUtils.sampleCount(sprRecFile);
    console.debug("Rec. files cache: Added. Cache samples: "+this._sampleCount);
  }

  setSprRecFileAudioData(sprRecFile:SprRecordingFile, adh:AudioDataHolder|null){
    this.expire();
    console.debug("Rec. files cache: Set audio data after expire. Cache samples: "+this._sampleCount);
    let currSampleCnt=RecordingFileUtils.sampleCount(sprRecFile);
    this._sampleCount-=currSampleCnt;
    console.debug("Rec. files cache: Set audio data subtracted curr sample count: "+currSampleCnt+". Cache samples: "+this._sampleCount);
    RecordingFileUtils.setAudioData(sprRecFile,adh);
    let newSampleCnt=RecordingFileUtils.sampleCount(sprRecFile);
    this._sampleCount+=newSampleCnt;
    console.debug("Rec. files cache: Set audio data added new sample count: "+newSampleCnt+". Cache samples: "+this._sampleCount);
    let fl=adh?.frameLen;
    if(fl){
      sprRecFile.frames=fl;
    }
    console.debug("Rec. files cache: Set audio data. Cache samples: "+this._sampleCount);
  }
}


export class RecFilesCache extends BasicRecFilesCache{

  private _recFiles:Array<RecordingFile>=new Array<RecordingFile>();

  get recFiles(): Array<RecordingFile> {
    return this._recFiles;
  }

  getRecFile(index:number){
    return this._recFiles[index];
  }

  length():number{
    return this._recFiles.length;
  }

  private expire() {
    if (this._sampleCount > this.maxSampleCount) {
      // audio recorder list is sorted: lower index is newer
      for (let rfI = this._recFiles.length-1; rfI >=0; rfI--) {
        if (this._sampleCount <= this.maxSampleCount) {
          break;
        }
        let toBeExpiredRf = this._recFiles[rfI];
        if (toBeExpiredRf.serverPersisted) {
          // expire recording files first stored to the cache
          let expiredAudio = RecordingFileUtils.expireAudioData(toBeExpiredRf);
          if (expiredAudio) {
            this._sampleCount -= expiredAudio.sampleCounts();
            console.debug("Rec. files cache: Expired #"+rfI+". Cache samples: " + this._sampleCount);
          }
        }else{
          console.debug("Rec. files cache: #"+rfI+" not yet server persisted.");
        }
      }
    }
  }

  addRecFile(recFile:RecordingFile){
    this.expire();
    this._recFiles.push(recFile);
    this._sampleCount += RecordingFileUtils.sampleCount(recFile);
    console.debug("Rec. files cache: Added. Cache samples: "+this._sampleCount);
  }

  setRecFileAudioData(recFile:RecordingFile, adh:AudioDataHolder|null){
    this.expire();
    this._sampleCount-=RecordingFileUtils.sampleCount(recFile);
    RecordingFileUtils.setAudioData(recFile,adh);
    this._sampleCount+=RecordingFileUtils.sampleCount(recFile);
    console.debug("Rec. files cache: Set audio data. Cache samples: "+this._sampleCount);
  }
}

