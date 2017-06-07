/**
 * Created by klausj on 18.08.2015.
 */
/// <reference path="../persistor"/>
/// <reference path="../format"/>
/// <reference path="../../io/BinaryReader"/>
/// <reference path="../../io/BinaryWriter"/>
//import m=require('./persistor')
//import brm=require('../io/BinaryReader')
//import afm=require('./format')
// Deprecated !!!  Use AudioContext.decodeAudioData() function
// WavReader not tested yet!!
var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var impl;
        (function (impl) {
            var BinaryByteWriter = ips.io.BinaryByteWriter;
            var WavFileFormat = (function () {
                function WavFileFormat() {
                }
                WavFileFormat.RIFF_KEY = 'RIFF';
                WavFileFormat.WAV_KEY = 'WAVE';
                WavFileFormat.PCM = 0x0001;
                return WavFileFormat;
            }());
            impl.WavFileFormat = WavFileFormat;
            var WavReader = (function () {
                function WavReader(data) {
                    this.br = new ips.io.BinaryByteReader(data);
                }
                WavReader.prototype.read = function () {
                    var rh = this.br.readAscii(4);
                    if (rh !== WavFileFormat.RIFF_KEY) {
                        console.log("Error ! Expected RIFF header not: ", rh);
                    }
                    var cl = this.br.readUint32LE();
                    if (this.br.pos + cl !== this.br.length()) {
                        console.log("Wrong chunksize in RIFF header: ", cl, " (expected: ", this.br.length() - this.br.pos, " )");
                    }
                    this.dataLength = cl;
                    var rt = this.br.readAscii(4);
                    if (rt !== WavFileFormat.WAV_KEY) {
                        console.log(rt);
                    }
                    var s = this.navigateToChunk('fmt ');
                    if (!s) {
                    }
                    this.format = this.parseFmtChunk();
                    var chsArr = this.readData();
                    console.log("Content length: ", cl);
                    //var ac=new ips.audio.AudioClip(this.format,chsArr);
                    //TODO use AudioContext.AudioBuffer
                    //var ab=
                    return null;
                };
                WavReader.prototype.navigateToChunk = function (chunkString) {
                    // position after RIFF header
                    this.br.pos = 12;
                    var chkStr = null;
                    var chkLen = -1;
                    while (!this.br.eof()) {
                        chkStr = this.br.readAscii(4);
                        chkLen = this.br.readUint32LE();
                        if (chunkString === chkStr) {
                            console.log("Chunk ", chkStr, " (", chkLen, " bytes)");
                            return chkLen;
                        }
                        this.br.pos += chkLen;
                    }
                    return chkLen;
                };
                WavReader.prototype.parseFmtChunk = function () {
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
                        var af = new ips.audio.PCMAudioFormat(sampleRate, channels, frameSize / channels, sampleSizeInBits);
                        return af;
                    }
                    return null;
                };
                WavReader.prototype.readData = function () {
                    var chkLen = this.navigateToChunk('data');
                    var chsArr = new Array(this.format.channelCount);
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
                    return chsArr;
                };
                return WavReader;
            }());
            impl.WavReader = WavReader;
            var WavWriter = (function () {
                function WavWriter() {
                    this.bw = new BinaryByteWriter();
                }
                WavWriter.prototype.writeFmtChunk = function (audioBuffer) {
                    this.bw.writeUint16(WavFileFormat.PCM, true);
                    var frameSize = WavWriter.DEFAULT_SAMPLE_SIZE_BYTES * audioBuffer.numberOfChannels; // fixed 16-bit for now
                    this.bw.writeUint16(audioBuffer.numberOfChannels, true);
                    this.bw.writeUint32(audioBuffer.sampleRate, true);
                    // dwAvgBytesPerSec
                    this.bw.writeUint32(frameSize * audioBuffer.sampleRate, true);
                    this.bw.writeUint16(frameSize, true);
                    // sample size in bits (PCM format only)
                    this.bw.writeUint16(WavWriter.DEFAULT_SAMPLE_SIZE_BYTES * 8, true);
                };
                WavWriter.prototype.writeDataChunk = function (audioBuffer) {
                    var chData0 = audioBuffer.getChannelData(0);
                    var dataLen = chData0.length;
                    var hDynIntRange = 1 << ((WavWriter.DEFAULT_SAMPLE_SIZE_BYTES * 8) - 1);
                    for (var s = 0; s < dataLen; s++) {
                        // interleaved channel data
                        for (var ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                            var chData = audioBuffer.getChannelData(ch);
                            var valFlt = chData[s];
                            var valInt = Math.round(valFlt * hDynIntRange);
                            this.bw.writeInt16(valInt, true);
                        }
                    }
                };
                WavWriter.prototype.writeChunkHeader = function (name, chkLen) {
                    this.bw.writeAscii(name);
                    this.bw.writeUint32(chkLen, true);
                };
                WavWriter.prototype.write = function (audioBuffer) {
                    this.bw.writeAscii(WavFileFormat.RIFF_KEY);
                    var dataChkByteLen = audioBuffer.getChannelData(0).length * WavWriter.DEFAULT_SAMPLE_SIZE_BYTES * audioBuffer.numberOfChannels;
                    var wavChunkByteLen = (4 + 4) * 3 + 16 + dataChkByteLen;
                    var wavFileDataByteLen = wavChunkByteLen + 8;
                    this.bw.writeUint32(wavChunkByteLen, true); // must be set to file length-8 later
                    this.bw.writeAscii(WavFileFormat.WAV_KEY);
                    this.writeChunkHeader('fmt ', 16);
                    this.writeFmtChunk(audioBuffer);
                    this.writeChunkHeader('data', dataChkByteLen);
                    this.writeDataChunk(audioBuffer);
                    return this.bw.finish();
                };
                WavWriter.PCM = 1;
                WavWriter.DEFAULT_SAMPLE_SIZE_BYTES = 2;
                return WavWriter;
            }());
            impl.WavWriter = WavWriter;
        })(impl = audio.impl || (audio.impl = {}));
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=wavformat.js.map