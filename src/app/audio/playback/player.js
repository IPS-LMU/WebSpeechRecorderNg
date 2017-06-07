/**
 * Created by klausj on 15.11.2015.
 */
/// <reference path="../../../../../typings/webrtc/MediaStream.d.ts"/>
/// <reference path="../../action/action"/>
/// <reference path="../persistor"/>
var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var playback;
        (function (playback) {
            (function (EventType) {
                EventType[EventType["STARTED"] = 0] = "STARTED";
                EventType[EventType["POS_UPDATE"] = 1] = "POS_UPDATE";
                EventType[EventType["STOPPED"] = 2] = "STOPPED";
                EventType[EventType["ENDED"] = 3] = "ENDED";
            })(playback.EventType || (playback.EventType = {}));
            var EventType = playback.EventType;
            var AudioPlayerEvent = (function () {
                function AudioPlayerEvent(type, timePosition) {
                    this._type = type;
                    this._timePosition = timePosition;
                }
                Object.defineProperty(AudioPlayerEvent.prototype, "type", {
                    get: function () {
                        return this._type;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(AudioPlayerEvent.prototype, "timePosition", {
                    get: function () {
                        return this._timePosition;
                    },
                    enumerable: true,
                    configurable: true
                });
                return AudioPlayerEvent;
            }());
            playback.AudioPlayerEvent = AudioPlayerEvent;
            var AudioPlayer = (function () {
                function AudioPlayer(context, listener) {
                    var _this = this;
                    this.context = context;
                    this.listener = listener;
                    this.bufSize = AudioPlayer.DEFAULT_BUFSIZE;
                    this.n = navigator;
                    this.buffPos = 0;
                    this.zeroBufCnt = 0;
                    this.zb = new Float32Array(this.bufSize);
                    this._startAction = new ips.action.Action('Start');
                    this._startAction.disabled = true;
                    this._startAction.onAction = function () { return _this.start(); };
                    this._stopAction = new ips.action.Action('Stop');
                    this._stopAction.disabled = true;
                    this._stopAction.onAction = function () { return _this.stop(); };
                }
                Object.defineProperty(AudioPlayer.prototype, "startAction", {
                    get: function () {
                        return this._startAction;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(AudioPlayer.prototype, "stopAction", {
                    get: function () {
                        return this._stopAction;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(AudioPlayer.prototype, "audioClip", {
                    set: function (audioClip) {
                        var length = 0;
                        var chs = 0;
                        if (audioClip.buffer) {
                            chs = audioClip.buffer.numberOfChannels;
                            if (chs > 0) {
                                length = audioClip.buffer.length;
                                if (chs > this.context.destination.maxChannelCount) {
                                }
                            }
                        }
                        this.audioBuffer = audioClip.buffer;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(AudioPlayer.prototype, "audioBuffer", {
                    set: function (audioBuffer) {
                        this._audioBuffer = audioBuffer;
                        if (audioBuffer) {
                            this._startAction.disabled = false;
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
                AudioPlayer.prototype.start = function () {
                    var _this = this;
                    this.sourceBufferNode = this.context.createBufferSource();
                    this.sourceBufferNode.buffer = this._audioBuffer;
                    this.sourceBufferNode.connect(this.context.destination);
                    this.sourceBufferNode.onended = function () { return _this.onended(); };
                    this.playStartTime = this.context.currentTime;
                    this.sourceBufferNode.start();
                    this.playStartTime = this.context.currentTime;
                    this._startAction.disabled = true;
                    this._stopAction.disabled = false;
                    //this.timerVar = window.setInterval((e)=>this.updatePlayPosition(), 200);
                    if (this.listener) {
                        this.listener.update(new AudioPlayerEvent(EventType.STARTED));
                    }
                };
                // updatePlayPosition() {
                //     var pp = this.context.currentTime - this.playStartTime;
                //     console.log("Play position: " + pp);
                // }
                AudioPlayer.prototype.stop = function () {
                    if (this.sourceBufferNode) {
                        this.sourceBufferNode.stop();
                    }
                    window.clearInterval(this.timerVar);
                };
                AudioPlayer.prototype.onended = function () {
                    window.clearInterval(this.timerVar);
                    this._startAction.disabled = false;
                    this._stopAction.disabled = true;
                    if (this.listener) {
                        this.listener.update(new AudioPlayerEvent(EventType.ENDED));
                    }
                };
                Object.defineProperty(AudioPlayer.prototype, "playPositionTime", {
                    get: function () {
                        return this.context.currentTime - this.playStartTime;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(AudioPlayer.prototype, "playPositionFrames", {
                    get: function () {
                        var ppTime = this.playPositionTime;
                        return this._audioBuffer.sampleRate * ppTime;
                    },
                    enumerable: true,
                    configurable: true
                });
                AudioPlayer.DEFAULT_BUFSIZE = 8192;
                return AudioPlayer;
            }());
            playback.AudioPlayer = AudioPlayer;
        })(playback = audio.playback || (audio.playback = {}));
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=player.js.map