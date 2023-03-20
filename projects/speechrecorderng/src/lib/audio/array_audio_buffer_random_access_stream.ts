import {ArrayAudioBuffer} from "./array_audio_buffer";
import {RandomAccessAudioStream} from "./audio_data_holder";
import {Observable} from "rxjs";
export class ArrayAudioBufferRandomAccessStream implements RandomAccessAudioStream{

  constructor(private _arrayBuffer:ArrayAudioBuffer) {
  }

  close(): void {
  }

  framesObs(framePos: number, frameLen: number, bufs: Float32Array[]): Observable<number> {
    return new Observable<number>(subscriber => {
      let read = this._arrayBuffer.frames(framePos, frameLen, bufs);
      subscriber.next(read);
      subscriber.complete();
    });
  }
}
