import {ArrayAudioBuffer} from "../array_audio_buffer";

export class ArrayAudioBufferSourceNode extends AudioWorkletNode{
    static readonly QUANTUM_FRAME_LEN=128;
    private _arrayAudioBuffer:ArrayAudioBuffer|null=null;

    onended: (()=> void)|null=null;

    constructor(context:AudioContext) {
        super(context,'audio-source-worklet');
        this.channelCountMode='explicit';
        this.port.onmessage=(msgEv:MessageEvent)=>{
            if(msgEv.data){
                let evType=msgEv.data.eventType;
                if(evType){
                    if('ended'===evType){
                       let drainTime=0;
                       if(this._arrayAudioBuffer?.sampleRate){
                          drainTime= ArrayAudioBufferSourceNode.QUANTUM_FRAME_LEN/this._arrayAudioBuffer.sampleRate;
                       }
                       //let dstAny:any=this.context.destination;
                       //console.debug('Destination node tail-time: '+dstAny['tail-time']);
                       window.setTimeout(()=>{
                           this.onended?.call(this);
                       },drainTime*1000);

                    }
                }
            }
        }
    }

    get arrayAudioBuffer(): ArrayAudioBuffer | null {
        return this._arrayAudioBuffer;
    }

    set arrayAudioBuffer(value: ArrayAudioBuffer | null) {
        this._arrayAudioBuffer = value;
        if (this._arrayAudioBuffer?.channelCount) {
            this.channelCount = this._arrayAudioBuffer?.channelCount;

            // TODO fills all buffers for testing now
            for (let chi = 0; chi < this._arrayAudioBuffer.chunkCount; chi++) {
                let trBuffers = new Array<any>(this.channelCount);
                for (let ch = 0; ch < this.channelCount; ch++) {
                    let adCh = this._arrayAudioBuffer.data[ch][chi];
                    let adChCopy = new Float32Array(adCh.length);
                    adChCopy.set(adCh);
                    trBuffers[ch] = adChCopy.buffer;
                }

                this.port.postMessage({
                    cmd:'data',
                    chs: this.channelCount,
                    audioData: trBuffers
                }, trBuffers);
            }
        }
    }

    start(){
        this.port.postMessage({cmd:'start'});
    }
    stop(){
        this.port.postMessage({cmd:'stop'});
    }

}
