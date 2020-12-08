import { WavFileFormat } from './wavformat'
import { AudioClip } from '../persistor'
import { PCMAudioFormat } from '../format'
import { BinaryByteReader } from '../../io/BinaryReader'

    export class WavReader {


        private br:BinaryByteReader;
        private format:PCMAudioFormat | null;
        private dataLength:number;

        constructor(data:ArrayBuffer) {
            this.br = new BinaryByteReader(data);
        }

        read():AudioClip | null{


            var rh = this.br.readAscii(4);
            if (rh !== WavFileFormat.RIFF_KEY) {
                console.error("Error ! Expected RIFF header not: ", rh);
            }
            var cl = this.br.readUint32LE();
            if (this.br.pos + cl !== this.br.length()) {
                console.error("Wrong chunksize in RIFF header: ", cl, " (expected: ", this.br.length() - this.br.pos, " )");
            }
            this.dataLength = cl;
            var rt = this.br.readAscii(4);
            if (rt !== WavFileFormat.WAV_KEY) {
                //console.debug(rt)
            }
            var s = this.navigateToChunk('fmt ');
            if (!s) {

            }
            this.format = this.parseFmtChunk();
            var chsArr = this.readData();
            //console.debug("Content length: ", cl);

            //var ac=new ips.audio.AudioClip(this.format,chsArr);
            //TODO use AudioContext.AudioBuffer
            //var ab=
            return null;
        }

        navigateToChunk(chunkString:string):number {
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

        parseFmtChunk():PCMAudioFormat | null {
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

        readData():Array<Float32Array> | null{
            var chkLen = this.navigateToChunk('data');
            var chsArr=null;
            if(this.format) {
              chsArr = new Array<Float32Array>(this.format.channelCount);
              var sampleCount = this.dataLength / this.format.channelCount / this.format.sampleSize;
              for (var ch = 0; ch < this.format.channelCount; ch++) {
                chsArr[ch] = new Float32Array(sampleCount);
              }
              if (this.format.sampleSize == 2) {


                for (var i = 0; i < this.dataLength / 2; i++) {
                  for (var ch = 0; ch < this.format.channelCount; ch++) {
                    var s16Ampl = this.br.readInt16LE();
                    var floatAmpl = s16Ampl / 32768;
                    //console.log("Ampl: ",s16Ampl,floatAmpl);
                    chsArr[ch][i] = floatAmpl;
                  }
                }

              }
            }
            return chsArr;
        }

    }




