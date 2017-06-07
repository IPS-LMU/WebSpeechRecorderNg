import { PCMAudioFormat} from './format'

    export class AudioClip {
        private _buffer: AudioBuffer;
        private _format: PCMAudioFormat;
        private _data: Array<Float32Array>;

        constructor(buffer: AudioBuffer) {
            this._buffer = buffer;
        }

        get buffer() {
            return this._buffer;
        };
    }

    export interface Reader {
        read(data: Blob): AudioClip;
    }
    export interface Writer {
        write(audioData: AudioClip): Blob;
    }

