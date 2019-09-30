import { PCMAudioFormat} from './format'

    export class AudioClip {

        private _buffer: AudioBuffer;
        private _selection:Selection=null;

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
      toString(){
          return "Selection: start: "+this.startFrame+" end: "+this.endFrame+" frame"
      }
    }


