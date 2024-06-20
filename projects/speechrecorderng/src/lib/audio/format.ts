
    export class AudioFormat {
        sampleRate: number;
        channelCount: number;
        constructor(sampleRate: number, channelCount: number) {
            this.sampleRate = sampleRate;
            this.channelCount = channelCount;
        }
    }

    export class PCMAudioFormat extends AudioFormat {
        encodingFloat:boolean=false;
        sampleSize: number;
        sampleSizeInBits: number;
        constructor(sampleRate: number, channelCount: number, sampleSize: number, sampleSizeInBits: number,encodingFloat=false) {
            super(sampleRate, channelCount);
            this.sampleSize = sampleSize;
            this.sampleSizeInBits = sampleSizeInBits;
            this.encodingFloat=encodingFloat;
        }

        toString(): string {
            const encStr=this.encodingFloat?'Encoding: float,':'';

            return 'Audio format: PCM,'+encStr + this.sampleRate + ' Hz,' + this.channelCount + ' channels, ' + this.sampleSizeInBits + ' bits';
        }
    }

