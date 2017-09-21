export class AudioSystem{
  constructor(public audioContext:AudioContext| null){

  }
}

export class AudioContextProvider
{


    //public static audioContext: AudioContext=new AudioContext();

    // the typical singleton pattern does not pass the Typescript compiler if the strict settings for export modules are used
 // ngc message:  Metadata collected contains an error that will be reported at runtime: Only initialized variables and constants can be referenced because the value of this variable is needed by the template compiler.

  private static _audioSystem:AudioSystem=new AudioSystem(null);
  //private static _audioContext:AudioContext| null;
  //   public static audioContext()
  //   {
  //       if(AudioContext && !this._audioContext){
  //           this._audioContext=new AudioContext();
  //       }
  //       return this._audioContext;
  //   }
  public static audioSystem()
  {

      if (AudioContext && !this._audioSystem.audioContext) {
        this._audioSystem=new AudioSystem(new AudioContext());
      }



    return this._audioSystem;
  }
}
