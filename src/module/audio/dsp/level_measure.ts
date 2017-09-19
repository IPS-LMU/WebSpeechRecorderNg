import {DSPUtils} from "../../dsp/utils";
import {SequenceAudioFloat32OutStream} from "../io/stream";
import {Arrays} from "../../utils/utils";


export class LevelInfo {

    constructor(public readonly channelCount:number,
                public startFrame:number=0,
                public frameLength:number=0,
                public minLinLevels?:Array<number>,
                public maxLinLevels?:Array<number>){
        this.minLinLevels=this.checkOrInitArray(minLinLevels);
        this.maxLinLevels=this.checkOrInitArray(maxLinLevels);
    }
    private checkOrInitArray(arr:Array<number>):Array<number>{
        if (arr) {
          if (arr.length !== this.channelCount)
            throw  new Error("Level arrays must be equal to channel count " + this.channelCount);
          return arr;
        } else {
          return new Array<number>(this.channelCount)
        }
    }

    merge(levelInfo:LevelInfo) {
      if(this.channelCount!==levelInfo.channelCount){
        throw new Error("Channel count of level info to merge must be equal. ("+this.channelCount+" != "+levelInfo.channelCount+")");
      }

      let endFrame=this.startFrame+this.frameLength;
      let mergeEndFrame=levelInfo.startFrame+levelInfo.frameLength;

        if(levelInfo.startFrame<this.startFrame){
          this.startFrame=levelInfo.startFrame;
        }

        if(mergeEndFrame>endFrame){
          this.frameLength=mergeEndFrame-this.startFrame;
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

  levelsLin():Array<number>{
    let lvlsLin=new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      lvlsLin[ch]=Math.max(Math.abs(this.minLinLevels[ch]),Math.abs(this.maxLinLevels[ch]));
    }
    return lvlsLin;
  }
  powerLevelsDB():Array<number>{
    let lvlsDb=new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      lvlsDb[ch]=DSPUtils.toPowerLevelInDB(this.levelsLin()[ch]);
    }
    return lvlsDb;
  }

  powerLevelDB():number{
    let pLvlsDb=this.powerLevelsDB();
    return Math.max(...pLvlsDb);
  }

    clone():LevelInfo{
        return new LevelInfo(this.channelCount,this.startFrame,this.frameLength, Arrays.cloneNumberArray(this.minLinLevels),
          Arrays.cloneNumberArray(this.maxLinLevels));
    }
}


export interface LevelListener{
    channelCount:number;
    update(levelInfo:LevelInfo,peakLevelInfo:LevelInfo):void;
    streamFinished():void;
    reset():void;
}

declare function postMessage (message:any, transfer?:Array<any>):void;


export class LevelMeasure implements SequenceAudioFloat32OutStream{



  currentLevelInfos:LevelInfo;
  peakLevelInfo:LevelInfo;

  private workerFunctionURL: string;
  private worker: Worker;
  private channelCount:number;
  private bufferIndex:number=0;
  private frameCount:number=0;

  levelListener:LevelListener;

  constructor() {

    let workerFunctionBlob = new Blob(['(' + this.workerFunction.toString() + ')();'], {type: 'text/javascript'});
    this.workerFunctionURL = window.URL.createObjectURL(workerFunctionBlob);

  }
  setFormat(channels:number,sampleRate:number){
    this.channelCount=channels;
    this.currentLevelInfos=new LevelInfo(this.channelCount);
    this.peakLevelInfo=new LevelInfo(this.channelCount);
    this.worker = new Worker(this.workerFunctionURL);
    this.worker.onmessage = (me) => {
      //console.log("Worker post");
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
          //console.log("Fls: " + fls[0] + " " + fls[1]);
          minLevels[ch] = fls[0];
          maxLevels[ch] = fls[1];
        }
        let bi=new LevelInfo(this.channelCount,this.frameCount,me.data.fraemLength,minLevels,maxLevels);
        this.updateLevels(bi);
      }
    }
  }



  nextStream() {
    this.reset();
  }

  private reset(){
    this.currentLevelInfos=new LevelInfo(this.channelCount);
    this.peakLevelInfo=new LevelInfo(this.channelCount);
      if(this.levelListener) {
          this.levelListener.reset();
          this.levelListener.channelCount=this.channelCount;
      }
  }

  write(bufferData: Array<Float32Array>):number {
    //console.log("measure buffer data: "+bufferData.length+" "+bufferData[0].length);
    let bufArrCopies=new Array<Float32Array>(bufferData.length);
    let buffers=new Array<any>(bufferData.length);
    for(let ch=0;ch<bufferData.length;ch++){
      bufArrCopies[ch]=bufferData[ch].slice();
      buffers[ch]=bufArrCopies[ch].buffer;
    }
    this.worker.postMessage({streamFinished:false,audioData: buffers,chs: this.channelCount,bufferIndex:this.bufferIndex},buffers);
    //console.log("Posted buffer #"+this.bufferIndex);
    this.bufferIndex++;
    return bufArrCopies[0].length;
  }

  flush(){
    this.worker.postMessage({streamFinished:true});

  }

  close(){
    if(this.worker){
      this.worker.terminate();
    }

  }


  workerFunction() {
    self.onmessage = function (msg) {
      let streamFinished = msg.data.streamFinished;
      if (streamFinished) {
        postMessage({streamFinished: true});

      } else {
        var chs = msg.data.chs;
        let frameLength=null;
        var audioData = new Array<Float32Array>(chs);
        var linLevels = new Array<Float32Array>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevels[ch] = new Float32Array(2);
          audioData[ch] = new Float32Array(msg.data.audioData[ch]);
        }

        if (audioData) {

          for (var ch = 0; ch < chs; ch++) {
            let chData = audioData[ch];
            if(frameLength===null){
              frameLength=chData.length;
            }
            for (let s = 0; s < frameLength; s++) {
              if (chData[s] < linLevels[ch][0]) {
                if (chData[s] < -1.0) {
                  console.log("Min: " + chData[s]);
                }
                linLevels[ch][0] = chData[s];
              }
              if (chData[s] > linLevels[ch][1]) {
                if (chData[s] > 1.0) {
                  console.log("Max: " + chData[s]);
                }
                linLevels[ch][1] = chData[s];
              }

            }
          }
        }
        var linLevelBufs = new Array<any>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevelBufs[ch] = linLevels[ch].buffer;

        }

        // TEST delay
        // let v=0;
        // for(let i=0;i<100000000;i++){
        //   v=v+Math.random();
        // }
        // console.log(v);
        // console.log("Processed buffer #"+msg.data.bufferIndex);

        postMessage({streamFinished: false,frameLength: frameLength,linLevelBuffers: linLevelBufs}, linLevelBufs);
      }
    }
  }

  updateLevels(bufferLevelInfo:LevelInfo) {

    this.currentLevelInfos=bufferLevelInfo;
    this.peakLevelInfo.merge(bufferLevelInfo);
    if(this.levelListener) {
        this.levelListener.update(this.currentLevelInfos,this.peakLevelInfo.clone());
    }
  }


  stop(){
    this.worker.terminate();
  }


}
