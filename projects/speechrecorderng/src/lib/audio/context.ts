
export class AudioContextProvider
{
  private static _audioContext:AudioContext| null=null;
  private static _offlineAudioContext:OfflineAudioContext|null=null;

  public static audioContextInstance():AudioContext|null
  {
    if (!this._audioContext) {
      let debugFail = false;
      if (!window.AudioContext || typeof window.AudioContext !== 'function' || debugFail) {
        this._audioContext=null;
        throw new Error('Browser does not support Web Audio API!');
      } else {
        console.debug("Get new audio context...");
        this._audioContext= new window.AudioContext();
        console.debug("Created new audio context.");
        this._audioContext.addEventListener('statechange', () => {
          console.debug("Audio context state changed: "+this._audioContext?.state);
        });
        console.debug("Created new audio context with state: "+this._audioContext?.state);
      }
    }
    return this._audioContext;
  }

  // public static audioContextInstanceRunning(audioContext?:AudioContext):Promise<AudioContext>{
  //
  //     return new Promise<AudioContext>((resolve,reject)=>{
  //       let aCtx=audioContext?audioContext:AudioContextProvider.audioContextInstance();
  //       if(aCtx) {
  //         if(aCtx.state==='closed') {
  //           reject(new Error('Audio context already closed.'));
  //         }else if(aCtx.state==='running') {
  //           resolve(aCtx);
  //         }else{
  //           aCtx.resume().then(() => {
  //             if(aCtx) {
  //               resolve(aCtx);
  //             }else{
  //               reject(new Error('Could not get audio context'));
  //             }
  //           }).catch(() => {
  //             reject(new Error('Could not resume audio context'));
  //           })
  //         }
  //       }else{
  //         reject(new Error('Could not get audio context from browser'));
  //       }
  //   });
  // }

  // public static decodeAudioData(data:ArrayBuffer,audioContext?:AudioContext):Promise<AudioBuffer>{
  //   return new Promise<AudioBuffer>((resolve,reject)=>{
  //     // decodeAudioData requires an audio context in running state
  //     AudioContextProvider.audioContextInstanceRunning(audioContext).then(
  //       (aCtx)=>{
  //         // Do not use Promise version, which does not work with Safari 13
  //         aCtx.decodeAudioData(data,decodedData => {
  //           resolve(decodedData);
  //         },(reason) => {
  //           reject(reason);
  //         });
  //       }
  //     ).catch((reason)=>{
  //       reject(reason);
  //     })
  //   })
  // }


  public static decodeAudioData(data:ArrayBuffer):Promise<AudioBuffer>{
      return new Promise<AudioBuffer>((resolve,reject)=>{
        if(!this._offlineAudioContext) {
            this._offlineAudioContext = new OfflineAudioContext(1, 44100, 44100);
        }
          // Do not use Promise version, which does not work with Safari 13
          this._offlineAudioContext.decodeAudioData(data,decodedData => {
            resolve(decodedData);
          },(reason) => {
            reject(reason);
          });
        }
      )

  }

}
