
export class AudioContextProvider
{
  private static _audioContext:AudioContext| null=null;

  public static audioContextInstance():AudioContext|null
  {
    if (!this._audioContext) {
      let debugFail = false;
      if (!window.AudioContext || typeof window.AudioContext !== 'function' || debugFail) {
        // Typecast to any to query prefixed APIs
        let w:any=window;
        // Check Safari webkit
        if(!w.webkitAudioContext) {
          throw new Error('Browser does not support Web Audio API!');
          this._audioContext = null;
        }else{
          this._audioContext= <AudioContext> new w.webkitAudioContext();
        }
      } else {
        this._audioContext= new window.AudioContext();
      }
    }
    return this._audioContext;
  }

}
