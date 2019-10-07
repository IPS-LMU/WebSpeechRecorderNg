import { PCMAudioFormat} from './format'
import {Observable} from "rxjs";
import {Observer} from "../utils/observer";

    export class AudioClip {

        private _buffer: AudioBuffer;
        private _selection:Selection=null;
        selectionObserver:Observer<Selection>|null;

        constructor(buffer: AudioBuffer) {
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
        if(this.selectionObserver){
          this.selectionObserver.update(this._selection)
        }
      }

    }

    export interface Reader {
        read(data: Blob): AudioClip;
    }
    export interface Writer {
        write(audioData: AudioClip): Blob;
    }

    export class Selection{
      private _startFrame:number;
      private _endFrame:number;

      constructor(startFrame:number,endFrame:number){
        this._startFrame=startFrame
        this._endFrame=endFrame;
      }
      get endFrame(): number {
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

      toString(){
          return "Selection: from: "+this.leftFrame+" to: "+this.rightFrame+" frame"
      }
    }


