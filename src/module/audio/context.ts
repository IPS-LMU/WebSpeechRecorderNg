export class AudioContextProvider
{
    public static audioContext: AudioContext=new AudioContext();

    // the typical singelton pattern does not pass the Typescript compiler if the strict settings for export modules are used

    // public static get audioContext()
    // {
    //     // if(!this._audioContext){
    //     //     this._audioContext=new AudioContext();
    //     // }
    //     return this._audioContext;
    // }
}
