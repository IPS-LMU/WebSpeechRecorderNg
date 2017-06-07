/**
 * Created by klausj on 18.08.2015.
 */
/// <reference path="format.ts"/>
//import fm=require('./format')
var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var AudioClip = (function () {
            function AudioClip(buffer) {
                this._buffer = buffer;
            }
            Object.defineProperty(AudioClip.prototype, "buffer", {
                get: function () {
                    return this._buffer;
                },
                enumerable: true,
                configurable: true
            });
            ;
            return AudioClip;
        }());
        audio.AudioClip = AudioClip;
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=persistor.js.map