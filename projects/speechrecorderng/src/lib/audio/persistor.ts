import {LevelInfos} from "./dsp/level_measure";

export class AudioClip {

  private _selection:Selection|null=null;
        private _levelInfos:LevelInfos | null=null;
  private selectionObservers:Array<(audioClip:AudioClip)=>void>;

  constructor(private _audioDataHolder:AudioDataHolder) {

    this.selectionObservers=new Array<(audioClip:AudioClip)=>void>()
  }

  get audioDataHolder(): AudioDataHolder {
    return this._audioDataHolder;
  }

  get selection(): Selection|null{
    return this._selection;
  }

  set selection(value: Selection|null) {
    this._selection = value;
    // let obsCnt=this.selectionObservers.length
    // this.selectionObservers.forEach((obs)=> {
    //   console.log("Calling observer")
    //   obs(this)
    // });
    for(let selObs of this.selectionObservers){
      selObs(this)
    }
  }

  get levelInfos(): LevelInfos | null {
    return this._levelInfos;
  }

  set levelInfos(value: LevelInfos | null) {
    this._levelInfos = value;
  }

  addSelectionObserver(selectionObserver:(audioClip:AudioClip)=>void,init=false){
    let obsAlreadyInList=this.selectionObservers.find((obs)=>(obs===selectionObserver))
    if(!obsAlreadyInList) {
      this.selectionObservers.push(selectionObserver)
    }
    if(init){
      selectionObserver(this)
    }
  }

  removeSelectionObserver(selectionObserver:(audioClip:AudioClip)=>void){
    this.selectionObservers=this.selectionObservers.filter((obs)=>{obs!==selectionObserver})
  }
}

export interface Reader {
  read(data: Blob): AudioClip;
}
export interface Writer {
  write(audioData: AudioClip): Blob;
}

export class Selection{
  private _sampleRate:number;
  private _startFrame:number;
  private _endFrame:number;

  constructor(sampleRate:number,startFrame:number,endFrame:number){
    this._sampleRate=sampleRate;
    this._startFrame=startFrame
    this._endFrame=endFrame;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }
  get endFrame():number{
    return this._endFrame;
  }
  get startFrame(): number {
    return this._startFrame;
  }

  get leftFrame(): number {
    return (this._startFrame <= this._endFrame) ? this._startFrame : this._endFrame
  }
  get rightFrame(): number {
    return (this._startFrame <= this._endFrame) ? this._endFrame : this._startFrame
  }

  equals(otherSelection:Selection|null|undefined):boolean{
    if(otherSelection) {
      return (this._sampleRate == otherSelection._sampleRate && this._startFrame === otherSelection._startFrame && this._endFrame === otherSelection._endFrame);
    }
    return false;
  }

  toString(){
    return "Selection: from: "+this.leftFrame+" to: "+this.rightFrame+" frame. Refers to sample rate :"+this._sampleRate;
  }
}


