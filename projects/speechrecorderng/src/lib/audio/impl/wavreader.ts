import { WavFileFormat } from './wavformat'
import { PCMAudioFormat } from '../format'
import { BinaryByteReader } from '../../io/BinaryReader'

    export class WavReader {

        private br:BinaryByteReader;
        private format:PCMAudioFormat | null=null;
        private dataLength:number=0;

        constructor(data:ArrayBuffer) {
            this.br = new BinaryByteReader(data);
        }

        private readHeader(){
            let rh = this.br.readAscii(4);
            if (rh !== WavFileFormat.RIFF_KEY) {
                let errMsg="Expected RIFF header, not: ", rh;
                throw new Error(errMsg);
            }
            let cl = this.br.readUint32LE();
            if (this.br.pos + cl !== this.br.length()) {
                throw new Error("Wrong chunksize in RIFF header: "+cl+" (expected: "+(this.br.length() - this.br.pos)+ " )");
            }
            this.dataLength = cl;
            let rt = this.br.readAscii(4);
            if (rt !== WavFileFormat.WAV_KEY) {
                let errMsg="Expected "+WavFileFormat.WAV_KEY+" not: ", rt;
                throw new Error(errMsg);
            }
        }

        readFormat():PCMAudioFormat|null{
            this.br.pos=0;
            this.readHeader();
            this.format = this.parseFmtChunk();
            return this.format;
        }

        // Not tested yet!!!
        read():AudioBuffer | null{
            this.br.pos=0;
            let ab:AudioBuffer|null=null;
            this.readHeader();
            let s = this.navigateToChunk('fmt ');
            if (!s) {
                let errMsg="WAV file does not contain a fmt chunk";
                throw new Error(errMsg);
            }
            this.format = this.parseFmtChunk();
            let chsArr = this.readData();
            let sr=this.format?.sampleRate;
            let nChs=this.format?.channelCount;
            if(sr && chsArr && nChs && nChs>0 && nChs==chsArr?.length) {
                ab = new AudioBuffer({
                    length: chsArr[0].length,
                    numberOfChannels: this.format?.channelCount,
                    sampleRate: sr
                });
                for(let ch=0;ch<nChs;ch++) {
                    ab.copyToChannel(chsArr[ch], ch);
                }
            }
            return ab;
        }

        private navigateToChunk(chunkString:string):number {
            // position after RIFF header
            this.br.pos = 12;
            var chkStr = null;
            var chkLen = -1;
            while (!this.br.eof()) {
                chkStr = this.br.readAscii(4);
                chkLen = this.br.readUint32LE();
                if (chunkString === chkStr) {
                    //console.debug("Chunk ", chkStr, " (", chkLen, " bytes)");
                    return chkLen;
                }
                this.br.pos += chkLen;
            }
            return chkLen;
        }

        private parseFmtChunk():PCMAudioFormat | null {
            var fmt = this.br.readUint16LE();
            if (fmt === WavFileFormat.PCM) {
                var channels = this.br.readUint16LE();
                //console.log("Channels: ",channels);
                var sampleRate = this.br.readUint32LE();
                // skip bandwidth
                this.br.skip(4);

                // frame size
                var frameSize = this.br.readUint16LE();

                // sample size in bits (PCM format only)
                var sampleSizeInBits = this.br.readUint16LE();
                //console.log(sampleRate, " ",frameSize," ",sampleSizeInBits);
                var af = new PCMAudioFormat(sampleRate, channels, frameSize / channels, sampleSizeInBits);
                return af;
            }
            return null;
        }

        private readData():Array<Float32Array> | null{
            let chkLen = this.navigateToChunk('data');
            let chsArr=null;
            if(this.format) {
              chsArr = new Array<Float32Array>(this.format.channelCount);
              let sampleCount = this.dataLength / this.format.channelCount / this.format.sampleSize;
              for (let ch = 0; ch < this.format.channelCount; ch++) {
                chsArr[ch] = new Float32Array(sampleCount);
              }
              if (this.format.sampleSize == 2) {
                for (let i = 0; i < this.dataLength / 2; i++) {
                  for (var ch = 0; ch < this.format.channelCount; ch++) {
                    let s16Ampl = this.br.readInt16LE();
                    let floatAmpl = s16Ampl / 32768;
                    //console.log("Ampl: ",s16Ampl,floatAmpl);
                    chsArr[ch][i] = floatAmpl;
                  }
                }
              }
            }
            return chsArr;
        }
    }




