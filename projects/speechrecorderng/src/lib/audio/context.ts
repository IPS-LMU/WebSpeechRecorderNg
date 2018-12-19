
export class AudioContextProvider
{
  private static _audioContext:AudioContext| null=null;

  public static audioContextInstance():AudioContext
  {

    if (!this._audioContext) {
      let w = <any>window;
      let n = <any>navigator;

      w.AudioContext = w.AudioContext || w.webkitAudioContext;
      let debugFail = false;
      if (!w.AudioContext || typeof w.AudioContext !== 'function' || debugFail) {
        throw new Error('Browser does not support Web Audio API!');
        return;
      } else {
        this._audioContext= new w.AudioContext();
      }

    }
    return this._audioContext;
  }

}
