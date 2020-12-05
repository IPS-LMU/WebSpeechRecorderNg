    export class AudioClip {
        private _buffer: AudioBuffer;
        private _selection:Selection=null;
        private selectionObservers:Array<(audioClip:AudioClip)=>void>;

        constructor(buffer: AudioBuffer) {
          this.selectionObservers=new Array<(audioClip:AudioClip)=>void>()
            this._buffer = buffer;
        }

        get buffer() {
            return this._buffer;
        };

      get selection(): Selection {
        return this._selection;
      }

      set selection(value: Selection) {
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

      //   endFrameForSampleRate(sampleRate:number): number {
      //     if(this._sampleRate===sampleRate) {
      //         return this._endFrame;
      //     }else{
      //         return Math.round((this._endFrame*sampleRate)/this._sampleRate);
      //     }
      // }
      get startFrame(): number {
        return this._startFrame;
      }

        // startFrameForSampleRate(sampleRate:number): number {
        //     if(this._sampleRate===sampleRate) {
        //         return this._startFrame;
        //     }else{
        //         return Math.round((this._startFrame*sampleRate)/this._sampleRate);
        //     }
        // }

      get leftFrame(): number {
        return (this._startFrame <= this._endFrame) ? this._startFrame : this._endFrame
      }
      get rightFrame(): number {
        return (this._startFrame <= this._endFrame) ? this._endFrame : this._startFrame
      }

      equals(otherSelection:Selection):boolean{
        if(otherSelection==null){
          return false
        }else{
          return (this._sampleRate==otherSelection._sampleRate && this._startFrame===otherSelection._startFrame && this._endFrame===otherSelection._endFrame)
        }
      }

      toString(){
          return "Selection: from: "+this.leftFrame+" to: "+this.rightFrame+" frame. Refers to sample rate :"+this._sampleRate;
      }
    }


