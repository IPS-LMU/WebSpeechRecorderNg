export class ArrayAudioBuffer {

  private _chunkCount=0;
  private _frameLen:number=0;
  private _sealed=false;

  constructor(private _channelCount: number, private _sampleRate: number, private _data: Array<Array<Float32Array>>) {
    this.updateFrameLen();
  }

  private updateFrameLen(){
    this._frameLen=0;
    this._chunkCount=0;
    if(this._data.length>0) {
      let ch0Data = this.data[0];
      for (let ch0Chk of ch0Data) {
        this._chunkCount++;
        this._frameLen += ch0Chk.length;
      }
    }
  }

  seal(){
    this._sealed=true;
  }

  sealed():boolean{
    return this._sealed;
  }

  static fromAudioBuffer(audioBuffer:AudioBuffer,chunkFrameSize=8192):ArrayAudioBuffer{
    let aab:ArrayAudioBuffer;
    let chs=audioBuffer.numberOfChannels;
    let frameLength=audioBuffer.length;
    //let chunksSize=Math.ceil(frameLength/chunkFrameSize);
    let framePos=0;
    let data=new Array<Array<Float32Array>>(chs);
    for(let ch=0;ch<chs;ch++) {
      data[ch]=new Array<Float32Array>();
    }
    let toCopy=frameLength-framePos;
      while(toCopy>0){

        let toCopyChunk=chunkFrameSize;
        if(toCopyChunk>toCopy){
          // last chunk, the rest
          toCopyChunk=toCopy;
        }
        for(let ch=0;ch<chs;ch++) {
          data[ch].push(audioBuffer.getChannelData(ch).slice(framePos, framePos + toCopyChunk));
        }
        framePos+=toCopyChunk;
        toCopy-=toCopyChunk;
      }
    aab=new ArrayAudioBuffer(chs,audioBuffer.sampleRate,data);
    return aab;
  }

  appendAudioBuffer(audioBuffer:AudioBuffer){
    let chs=audioBuffer.numberOfChannels;
    if(this._channelCount!== chs){
      throw new Error('Cannot append audio buffer with '+chs+' channels to this array audio buffer with '+this._channelCount+' channels. Number of channels must match.');
    }
    let sr=audioBuffer.sampleRate;
    if(sr!==this._sampleRate){
      throw new Error('Cannot append audio buffer with samplerate '+sr+' to this array audio buffer with samplerate '+this._sampleRate+'. Samplerates must match.');
    }

    for(let ch=0;ch<chs;ch++) {
      let chAbSlice=audioBuffer.getChannelData(ch).slice();
      //console.debug("Append audio buffer ch: "+ch+": "+chAbSlice.length);
      this._data[ch].push(chAbSlice);
    }
    this.updateFrameLen();
  }


  get channelCount(): number {
    return this._channelCount;
  }

  frames(framePos:number,frameLen:number,bufs:Float32Array[]):number{

    let ccFramePos=0;
    let trgFramePos=framePos;
    let ch0Data = this.data[0];
    let cPos=0;
    let filled=0;
    let ci=0;

    while(filled<frameLen && ci<this._chunkCount){
      // Current chunk
      let cc0=ch0Data[ci];
      let ccLen=cc0.length;
      let ccFrameEndPos=ccFramePos+ccLen;

      if(trgFramePos>=ccFramePos && trgFramePos<ccFrameEndPos){
        let toCp=frameLen-filled;
        cPos=trgFramePos-ccFramePos;
        if(cPos+toCp>ccLen){
          toCp=ccLen-cPos;
        }
        for(let ch=0;ch<bufs.length;ch++){
          let cc=this.data[ch][ci];

          for(let i=0;i<toCp;i++){
            bufs[ch][filled+i]=cc[cPos+i];
          }
        }
        filled+=toCp;
        trgFramePos+=toCp;
        cPos+=toCp;
        ccFramePos+=toCp;
        if(cPos>=ccLen){
          ccFramePos=ccFrameEndPos;
          cPos=0;
          ci++;
        }

      }else{
        // next chunk
        ccFramePos=ccFrameEndPos;
        cPos=0;
        ci++;
      }
    }
    return filled;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  get frameLen(): number {
    return this._frameLen;
  }

  get chunkCount(): number {
    return this._chunkCount;
  }

  get data(): Array<Array<Float32Array>> {
    return this._data;
  }

}
