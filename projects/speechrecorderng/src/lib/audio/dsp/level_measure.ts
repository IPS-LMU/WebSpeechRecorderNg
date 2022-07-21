import {DSPUtils} from "../../dsp/utils";
import {SequenceAudioFloat32OutStream} from "../io/stream";
import {Arrays, WorkerHelper} from "../../utils/utils";

export const MIN_DB_LEVEL = -40.0;



export class LevelInfo {

  private readonly _minLinLevels: Array<number>;
  private readonly _maxLinLevels: Array<number>;

  constructor(public readonly channelCount: number,
              public startFrame: number = 0,
              public frameLength: number = 0,
              minLinLevels?: Array<number>,
              maxLinLevels?: Array<number>) {
    this._minLinLevels = this.checkOrInitArray(minLinLevels);
    this._maxLinLevels = this.checkOrInitArray(maxLinLevels);
  }

  get minLinLevels() {
    return this._minLinLevels;
  }

  get maxLinLevels() {
    return this._maxLinLevels;
  }

  private checkOrInitArray(arr: Array<number> | undefined): Array<number> {
    if (arr) {
      if (arr.length !== this.channelCount)
        throw  new Error("Level arrays must be equal to channel count " + this.channelCount);
      return arr;
    } else {
      return new Array<number>(this.channelCount)
    }
  }

  merge(levelInfo: LevelInfo) {
    if (levelInfo === null) {
      return;
    }
    if (this.channelCount !== levelInfo.channelCount) {
      throw new Error("Channel count of level info to merge must be equal. (" + this.channelCount + " != " + levelInfo.channelCount + ")");
    }

    let endFrame = this.startFrame + this.frameLength;
    let mergeEndFrame = levelInfo.startFrame + levelInfo.frameLength;

    if (levelInfo.startFrame < this.startFrame) {
      this.startFrame = levelInfo.startFrame;
    }

    if (mergeEndFrame > endFrame) {
      this.frameLength = mergeEndFrame - this.startFrame;
    }

    for (let ch = 0; ch < this.channelCount; ch++) {

      if (levelInfo.minLinLevels[ch] < this.minLinLevels[ch]) {
        this.minLinLevels[ch] = levelInfo.minLinLevels[ch];
      }
      if (levelInfo.maxLinLevels[ch] > this.maxLinLevels[ch]) {
        this.maxLinLevels[ch] = levelInfo.maxLinLevels[ch];
      }
    }
  }

  levelsLin(): Array<number> {
    let lvlsLin = new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      lvlsLin[ch] = Math.max(Math.abs(this.minLinLevels[ch]), Math.abs(this.maxLinLevels[ch]));
    }
    return lvlsLin;
  }

  powerLevelsDB(): Array<number> {
    let lvlsDb = new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      lvlsDb[ch] = DSPUtils.toPowerLevelInDB(this.levelsLin()[ch]);
    }
    return lvlsDb;
  }

  powerLevelDB(): number {
    let pLvlsDb = this.powerLevelsDB();
    return Math.max(...pLvlsDb);
  }

  clone(): LevelInfo {
    return new LevelInfo(this.channelCount, this.startFrame, this.frameLength, Arrays.cloneNumberArray(this.minLinLevels),
      Arrays.cloneNumberArray(this.maxLinLevels));
  }
}

export class LevelInfos {
  constructor(public readonly bufferLevelInfos: Array<LevelInfo>, public readonly peakLevelInfo: LevelInfo) {
  }

  framesPerBuffer():number{
    if(this.bufferLevelInfos.length>0){
      return this.bufferLevelInfos[0].frameLength;
    }
    return this.peakLevelInfo.frameLength/this.bufferLevelInfos.length;
  }
}


export interface LevelListener {
  channelCount: number;

  update(levelInfo: LevelInfo, peakLevelInfo: LevelInfo): void;

  streamFinished(): void;

  reset(): void;
}

export interface PeakLevelListener {
  update(peakLevel:number): void;
}

export interface PeakLevelListener {

  update(levelInfo: LevelInfo, peakLevelInfo: LevelInfo): void;

  streamFinished(): void;

  reset(): void;
}

export class PeakLevelInterceptor implements LevelListener{
  get peakDbLvl(): number {
    return this._peakDbLvl;
  }
  get channelCount(): number {
    return this._channelCount;
  }

  set channelCount(value: number) {
    this._channelCount = value;
    if(this.levelListener){
      this.levelListener.channelCount=value;
    }
  }

  private _channelCount: number=0;

  private _peakDbLvl = MIN_DB_LEVEL;



  constructor(private levelListener?:LevelListener) {}

  update(levelInfo: LevelInfo, peakLevelInfo: LevelInfo): void{
    let peakDBVal = levelInfo.powerLevelDB();
    if (this.peakDbLvl < peakDBVal) {
      this._peakDbLvl = peakDBVal;
    }
  }

  streamFinished(): void{
    if(this.levelListener){
      this.levelListener.streamFinished();
    }
  }

  reset(): void{
    this._peakDbLvl = MIN_DB_LEVEL;
    if(this.levelListener){
      this.levelListener.reset();
    }
  }
}

declare function postMessage(message: any, transfer?: Array<any>): void;


export class LevelMeasure {

  private readonly workerURL: string;
  private worker: Worker|null=null;

  constructor() {
    this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
  }

  calcBufferLevelInfos(audioBuffer: AudioBuffer, bufferTimeLength: number): Promise<LevelInfos> {
    return new Promise<LevelInfos>((resolve)=>{
      let chs = audioBuffer.numberOfChannels;
      let bufferFrameLength=Math.round(audioBuffer.sampleRate*bufferTimeLength);
      let buffers = new Array<any>(chs);
      for (let ch = 0; ch < chs; ch++) {
        let adCh=audioBuffer.getChannelData(ch);
        let adChCopy=new Float32Array(adCh.length);
        adChCopy.set(adCh);
        buffers[ch] = adChCopy.buffer;
      }

      this.worker = new Worker(this.workerURL);
      this.worker.onmessage = (me) => {

        let linLevelArrs=new Array<Float32Array>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevelArrs[ch] = new Float32Array(me.data.linLevelBuffers[ch]);
        }

        let bufferCount=Math.ceil(me.data.frameLength/me.data.bufferFrameLength);
        let framePos=0;
        let bufferLevelInfos=new Array<LevelInfo>();
        let peakLevelInfo=new LevelInfo(chs);
        for(let bi=0;bi<bufferCount;bi++) {
          let minLevels = new Array<number>(chs);
          let maxLevels = new Array<number>(chs);
          for (let ch = 0; ch < chs; ch++) {
            let linLvlArrPos=bi*2;
            minLevels[ch]=linLevelArrs[ch][linLvlArrPos];
            maxLevels[ch]=linLevelArrs[ch][linLvlArrPos+1];
          }
          let bli = new LevelInfo(chs, framePos, me.data.bufferFrameLength, minLevels, maxLevels);
          bufferLevelInfos.push(bli);
          peakLevelInfo.merge(bli);
        }
        this.terminateWorker();
        resolve(new LevelInfos(bufferLevelInfos, peakLevelInfo));
      };

      this.worker.postMessage({bufferFrameLength:bufferFrameLength,audioData: buffers, chs: chs}, buffers);

    });

  }


  private terminateWorker() {
    this.worker?.terminate();

  }

  /*
   *  Method used as worker code.
   */
  workerFunction() {
    self.onmessage = function (msg:MessageEvent) {

      let chs = msg.data.chs;
      let bufferFrameLength = msg.data.bufferFrameLength;

      let audioData = new Array<Float32Array>(chs);
      let linLevels = new Array<Float32Array>(chs);

      for (let ch = 0; ch < chs; ch++) {
        audioData[ch] = new Float32Array(msg.data.audioData[ch]);
      }
      let frameLength = audioData[0].length;
      let bufferCount=Math.ceil(frameLength/bufferFrameLength);
      for (let ch = 0; ch < chs; ch++) {
        linLevels[ch] = new Float32Array(bufferCount*2);
      }
      if (audioData && chs > 0) {
        for (let ch = 0; ch < chs; ch++) {
          let chData = audioData[ch];

          for (let s = 0; s < frameLength; s++) {
            let bi = Math.floor(s / bufferFrameLength);
            let lvlArrPos = bi * 2;
            //let bs = s % bufferFrameLength;
            let chSample=chData[s];
            if (chSample < linLevels[ch][lvlArrPos]) {
              linLevels[ch][lvlArrPos] = chSample;
            }
            lvlArrPos++;
            if (chSample > linLevels[ch][lvlArrPos]) {
              linLevels[ch][lvlArrPos] = chSample;
            }
          }
        }
        const linLevelBufs = new Array<any>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevelBufs[ch] = linLevels[ch].buffer;
        }
        postMessage({bufferFrameLength:bufferFrameLength,frameLength:frameLength,linLevelBuffers: linLevelBufs}, linLevelBufs);
      }
    }
  }
}


export class StreamLevelMeasure implements SequenceAudioFloat32OutStream {

  currentLevelInfos: LevelInfo|null=null;
  peakLevelInfo: LevelInfo|null=null;

  private readonly workerURL: string;
  private worker: Worker|null=null;
  private channelCount: number=0;
  private bufferIndex: number = 0;
  private frameCount: number = 0;

  levelListener: LevelListener|null=null;
  peakLevelListener: ((peakLvlInDb:number)=>void)|null=null;
  private peakLevelInDb:number=MIN_DB_LEVEL;

  constructor() {
    this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
  }

  setFormat(channels: number, sampleRate: number) {
    this.channelCount = channels;
    this.currentLevelInfos = new LevelInfo(this.channelCount);
    this.peakLevelInfo = new LevelInfo(this.channelCount);
    this.worker = new Worker(this.workerURL);
    this.worker.onmessage = (me) => {
      let streamFinished = me.data.streamFinished;
      if (streamFinished) {
        if (this.levelListener) {
          this.levelListener.streamFinished()
        }
      } else {

        let minLevels = new Array<number>(this.channelCount);
        let maxLevels = new Array<number>(this.channelCount);
        for (let ch = 0; ch < this.channelCount; ch++) {
          let fls = new Float32Array(me.data.linLevelBuffers[ch]);
          minLevels[ch] = fls[0];
          maxLevels[ch] = fls[1];
        }
        let bi = new LevelInfo(this.channelCount, this.frameCount, me.data.fraemLength, minLevels, maxLevels);
        this.updateLevels(bi);
      }
    }
  }


  nextStream() {
    this.reset();
  }

  private reset() {
    this.currentLevelInfos = new LevelInfo(this.channelCount);
    this.peakLevelInfo = new LevelInfo(this.channelCount);
    if (this.levelListener) {
      this.levelListener.reset();
      this.levelListener.channelCount = this.channelCount;
    }
    if (this.peakLevelListener) {
      this.peakLevelInDb=MIN_DB_LEVEL;
      this.peakLevelListener(this.peakLevelInDb);
    }
  }

  write(bufferData: Array<Float32Array>): number {
    let bufArrCopies = new Array<Float32Array>(bufferData.length);
    let buffers = new Array<any>(bufferData.length);
    for (let ch = 0; ch < bufferData.length; ch++) {
      bufArrCopies[ch] = bufferData[ch].slice();
      buffers[ch] = bufArrCopies[ch].buffer;
    }
    this.worker?.postMessage({
      streamFinished: false,
      audioData: buffers,
      chs: this.channelCount,
      bufferIndex: this.bufferIndex
    }, buffers);
    this.bufferIndex++;
    return bufArrCopies[0].length;
  }

  flush() {
    this.worker?.postMessage({streamFinished: true});

  }

  close() {
      this.worker?.terminate();
  }

  /*
   *  Method used as worker code.
   */
  workerFunction() {
    self.onmessage = function (msg:MessageEvent) {
      let streamFinished = msg.data.streamFinished;
      if (streamFinished) {
        postMessage({streamFinished: true});
      } else {
        let chs = msg.data.chs;
        let frameLength = null;
        let audioData = new Array<Float32Array>(chs);
        let linLevels = new Array<Float32Array>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevels[ch] = new Float32Array(2);
          audioData[ch] = new Float32Array(msg.data.audioData[ch]);
        }

        if (audioData) {
          for (let ch = 0; ch < chs; ch++) {
            let chData = audioData[ch];
            if (frameLength === null) {
              frameLength = chData.length;
            }
            for (let s = 0; s < frameLength; s++) {
              let chSample=chData[s];
              if (chSample < linLevels[ch][0]) {
                linLevels[ch][0] = chSample;
              }
              if (chSample > linLevels[ch][1]) {
                linLevels[ch][1] = chSample;
              }
            }
          }
        }
        let linLevelBufs = new Array<any>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevelBufs[ch] = linLevels[ch].buffer;
        }
        postMessage({streamFinished: false, frameLength: frameLength, linLevelBuffers: linLevelBufs}, linLevelBufs);
      }
    }
  }

  updateLevels(bufferLevelInfo: LevelInfo) {

    this.currentLevelInfos = bufferLevelInfo;
    if(this.peakLevelInfo) {
      this.peakLevelInfo.merge(bufferLevelInfo);
      if (this.levelListener) {
        this.levelListener.update(this.currentLevelInfos, this.peakLevelInfo.clone());
      }
      if(this.peakLevelListener){
        let peakDBVal = bufferLevelInfo.powerLevelDB();
        if (this.peakLevelInDb < peakDBVal) {
          this.peakLevelInDb = peakDBVal;
          // the event comes from outside of an Angular zone
          this.peakLevelListener(this.peakLevelInDb);
        }
      }
    }
  }


  stop() {
    this.worker?.terminate();
  }


}
