export class AudioContextProvider
{
    private static _audioContext: AudioContext;

    public static get audioContext()
    {
        if(!this._audioContext){
            this._audioContext=new AudioContext();
        }
        return this._audioContext;
    }
}
