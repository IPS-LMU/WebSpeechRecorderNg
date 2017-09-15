import {min} from "rxjs/operator/min";
import {DSPUtils} from "../../dsp/utils";
import {buffer} from "rxjs/operator/buffer";
import {SequenceAudioFloat32OutStream} from "../io/stream";

export class LevelInfos {

  private channelCount:number;
    constructor(public minLinLevels: Array<number>,
                public maxLinLevels: Array<number>,
                private minLinPeakLevels: Array<number>,
                private maxLinPeakLevels: Array<number>) {
        this.channelCount=minLinLevels.length;
       // TODO check other arrays
    }


    // get minLinLevels(): Array<number> {
    //     //return this.minLinLevels;
    // }
    //
    // get maxLinLevels(): Array<number> {
    //     //return this.minLinLevels;
    // }

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
}

export interface LevelListener{
    channelCount:number;
    update(levelInfos:LevelInfos):void;
    streamFinished():void;
    reset():void;
}

declare function postMessage (message:any, transfer?:Array<any>):void;
// export class LevelStatus{
//
//   constructor(readonly minLinLevels:Array<number>,
//               readonly maxLinLevels:Array<number>,
//               readonly minLinPeakLevels:Array<number>,
//               readonly maxLinPeakLevels:Array<number>){
//
//   }
//
//
//
// }





export class LevelMeasure implements SequenceAudioFloat32OutStream{


  minLinPeakLevels: Array<number>;
  maxLinPeakLevels: Array<number>;
  minLinLevels: Array<number>;
  maxLinLevels: Array<number>;

  private workerFunctionURL: string;
  private worker: Worker;
  private channelCount:number;
  private bufferIndex:number=0;

  levelListener:LevelListener;

  constructor() {

    this.reset();
    let workerFunctionBlob = new Blob(['(' + this.workerFunction.toString() + ')();'], {type: 'text/javascript'});
    this.workerFunctionURL = window.URL.createObjectURL(workerFunctionBlob);

  }
  setFormat(channels:number,sampleRate:number){
    this.channelCount=channels;
    this.maxLinPeakLevels = new Array<number>(this.channelCount);
      this.minLinPeakLevels = new Array<number>(this.channelCount);
      this.maxLinLevels = new Array<number>(this.channelCount);
      this.minLinLevels = new Array<number>(this.channelCount);
      this.reset();
    this.worker = new Worker(this.workerFunctionURL);
    this.worker.onmessage = (me) => {
      console.log("Worker post");
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
          console.log("Fls: " + fls[0] + " " + fls[1]);
          minLevels[ch] = fls[0];
          maxLevels[ch] = fls[1];
        }

        this.updateLevels(minLevels, maxLevels);
      }
    }
  }



  nextStream() {
    this.reset();
  }

  private reset(){
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.minLinLevels[ch] = 0.0;
      this.maxLinLevels[ch] = 0.0;
      this.minLinPeakLevels[ch] = 0.0;
      this.maxLinPeakLevels[ch] = 0.0;
    }
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
        var audioData = new Array<Float32Array>(chs);
        var linLevels = new Array<Float32Array>(chs);
        for (let ch = 0; ch < chs; ch++) {
          linLevels[ch] = new Float32Array(2);
          audioData[ch] = new Float32Array(msg.data.audioData[ch]);
        }

        if (audioData) {

          for (var ch = 0; ch < chs; ch++) {
            let chData = audioData[ch];
            for (let s = 0; s < chData.length; s++) {
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

        postMessage({streamFinished: false, linLevelBuffers: linLevelBufs}, linLevelBufs);
      }
    }
  }

  updateLevels(minLinLevels: Array<number>, maxLinLevels: Array<number>) {
    console.log("Level channel 0: "+minLinLevels[0]+" "+maxLinLevels[0]);
    for (let ch = 0; ch < this.channelCount; ch++) {
      if (minLinLevels[ch] < this.minLinPeakLevels[ch]) {
        this.minLinPeakLevels[ch] = minLinLevels[ch];
      }
      if (maxLinLevels[ch] > this.maxLinPeakLevels[ch]) {
        this.maxLinPeakLevels[ch] = this.maxLinPeakLevels[ch];
      }
    }
    this.minLinLevels = minLinLevels;
    this.maxLinLevels = maxLinLevels;
    if(this.levelListener) {
        let lvlInfos = new LevelInfos(minLinLevels, this.maxLinLevels, this.minLinPeakLevels, this.maxLinPeakLevels);
        this.levelListener.update(lvlInfos);
    }
    console.log("Peak level channel 0: "+this.peakLevelsLin()+",  "+this.peakPowerLevelsDB()[0]+" dB");
  }



  peakLevelsLin():Array<number>{
    let pkLvlsLin=new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      pkLvlsLin[ch]=Math.max(Math.abs(this.minLinPeakLevels[ch]),Math.abs(this.maxLinPeakLevels[ch]));
    }
    return pkLvlsLin;
  }


  peakPowerLevelsDB():Array<number>{
    let pkLvlsDb=new Array<number>(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      pkLvlsDb[ch]=DSPUtils.toPowerLevelInDB(this.peakLevelsLin()[ch]);
    }
    return pkLvlsDb;
  }


  stop(){
    this.worker.terminate();
  }


}
