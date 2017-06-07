/**
 * Created by klausj on 26.08.2015.
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var AudioFormat = (function () {
            function AudioFormat(sampleRate, channelCount) {
                this.sampleRate = sampleRate;
                this.channelCount = channelCount;
            }
            return AudioFormat;
        }());
        audio.AudioFormat = AudioFormat;
        var PCMAudioFormat = (function (_super) {
            __extends(PCMAudioFormat, _super);
            function PCMAudioFormat(sampleRate, channelCount, sampleSize, sampleSizeInBits) {
                _super.call(this, sampleRate, channelCount);
                this.sampleSize = sampleSize;
                this.sampleSizeInBits = sampleSizeInBits;
            }
            PCMAudioFormat.prototype.toString = function () {
                return "Audio format: PCM,", this.sampleRate, " Hz,", this.channelCount, " channels, ", this.sampleSizeInBits, " bits";
            };
            return PCMAudioFormat;
        }(AudioFormat));
        audio.PCMAudioFormat = PCMAudioFormat;
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=format.js.map