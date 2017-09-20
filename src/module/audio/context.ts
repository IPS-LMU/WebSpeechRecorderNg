export class AudioContextProvider
{


    //public static audioContext: AudioContext=new AudioContext();

    // the typical singleton pattern does not pass the Typescript compiler if the strict settings for export modules are used

     private static _audioContext:AudioContext | null=null;
    public static get audioContext()
    {
        if(AudioContext && !this._audioContext){
            this._audioContext=new AudioContext();
        }
        return this._audioContext;
    }
}
