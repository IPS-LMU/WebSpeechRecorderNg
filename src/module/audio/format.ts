
    export class AudioFormat {
        sampleRate: number;
        channelCount: number;
        constructor(sampleRate: number, channelCount: number) {
            this.sampleRate = sampleRate;
            this.channelCount = channelCount;
        }
    }

    export class PCMAudioFormat extends AudioFormat {
        sampleSize: number;
        sampleSizeInBits: number;
        constructor(sampleRate: number, channelCount: number, sampleSize: number, sampleSizeInBits: number) {
            super(sampleRate, channelCount);
            this.sampleSize = sampleSize;
            this.sampleSizeInBits = sampleSizeInBits;
        }

        toString(): string {
            return 'Audio format: PCM,' + this.sampleRate + ' Hz,' + this.channelCount + ' channels, ' + this.sampleSizeInBits + ' bits';
        }
    }

