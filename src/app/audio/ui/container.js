var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var ui;
        (function (ui) {
            var AudioClipUIContainer = (function () {
                function AudioClipUIContainer(container) {
                    var _this = this;
                    this.dragStartMouseY = null;
                    this.dragStartY = null;
                    this.dividerPosition = 0.5;
                    this.ce = container;
                    this.dc = this.createCanvas();
                    this.ce.appendChild(this.dc);
                    this.dc.style.cursor = 'ns-resize';
                    this.dc.style.zIndex = '3';
                    this.dc.addEventListener('mouseover', function (e) {
                        _this.dividerCursorPosition(e, true);
                    });
                    this.dc.addEventListener('mousemove', function (e) {
                    }, false);
                    this.dc.addEventListener('mouseleave', function (e) {
                        _this.dividerCursorPosition(e, false);
                    });
                    this.dc.addEventListener('mousedown', function (e) {
                        _this.dragStartMouseY = e.clientY;
                        _this.dragStartY = _this.dc.offsetTop;
                        console.log("drag start ", _this.dragStartY, _this.dragStartMouseY);
                        document.onmouseup = function (e) {
                            if (_this.dragStartY != null) {
                                _this.dividerDrag(e);
                                _this.layout();
                                document.onmousemove = null;
                                document.onmouseup = null;
                                _this.dragStartY = null;
                            }
                        };
                        document.onmousemove = function (e) {
                            if (_this.dragStartY != null) {
                                _this.dividerDrag(e);
                                _this.layoutScaled();
                            }
                        };
                    });
                    this.dc.addEventListener('mouseup', function (e) {
                    });
                    this.as = new ui.AudioSignal(this.ce);
                    this.so = new ui.Sonagram(this.ce);
                    this.so.init();
                    window.addEventListener('resize', function () {
                        console.log("Window resize event received");
                        _this.layout();
                    }, true);
                    this.layout();
                }
                AudioClipUIContainer.prototype.canvasMousePos = function (c, e) {
                    var cr = c.getBoundingClientRect();
                    var p = new ui.Point();
                    p.x = e.x - cr.left;
                    p.y = e.y - cr.top;
                    return p;
                };
                AudioClipUIContainer.prototype.dividerCursorPosition = function (e, show) {
                    if (this.dc) {
                        var w = this.dc.width;
                        var h = this.dc.height;
                        var g = this.dc.getContext("2d");
                        var pp = this.canvasMousePos(this.dc, e);
                        var offX = e.layerX - this.dc.offsetLeft;
                        var offY = e.layerY - this.dc.offsetTop;
                    }
                };
                AudioClipUIContainer.prototype.dividerDrag = function (e) {
                    if (this.dc) {
                        var dragOffset = e.clientY - this.dragStartMouseY;
                        console.log("Drag offset: ", dragOffset);
                        var newTop = (this.dragStartY + dragOffset);
                        this.dc.style.top = newTop.toString() + 'px';
                        var ceHeight = this.ce.offsetHeight;
                        this.dividerPosition = (this.dc.offsetTop + AudioClipUIContainer.DIVIDER_PIXEL_SIZE / 2) / ceHeight;
                        if (this.dividerPosition > 1.0) {
                            this.dividerPosition = 1.0;
                        }
                        if (this.dividerPosition < 0.0) {
                            this.dividerPosition = 0.0;
                        }
                        this.drawDivider();
                    }
                };
                AudioClipUIContainer.prototype.drawDivider = function () {
                    var w = this.dc.width;
                    var h = this.dc.height;
                    var g = this.dc.getContext("2d");
                    g.fillStyle = 'white';
                    g.fillRect(0, 0, w, h);
                    g.fillStyle = 'black';
                    g.fillRect(5, 5, w - 10, 1);
                };
                AudioClipUIContainer.prototype.createCanvas = function () {
                    var c = document.createElement('canvas');
                    c.width = 0;
                    c.height = 0;
                    c.className = 'audioSignalCC';
                    return c;
                };
                AudioClipUIContainer.prototype.layoutScaled = function () {
                    var offW = this.ce.offsetWidth;
                    var offH = this.ce.offsetHeight;
                    var psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    var asTop = 0;
                    var asH = Math.round(psH * this.dividerPosition);
                    var soH = Math.round(psH * (1 - this.dividerPosition));
                    var soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    var wStr = offW.toString() + 'px';
                    var dTop = asH;
                    var dTopStr = dTop.toString() + 'px';
                    this.dc.style.top = dTopStr;
                    this.dc.style.left = '0px';
                    this.dc.style.width = wStr;
                    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    this.dc.width = offW;
                    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    this.dc.style.width = wStr;
                    this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
                    this.drawDivider();
                    this.so.layoutBounds(0, soTop, offW, soH, false);
                    this.as.layoutBounds(0, 0, offW, asH, false);
                };
                AudioClipUIContainer.prototype.layout = function () {
                    var offW = this.ce.offsetWidth;
                    var offH = this.ce.offsetHeight;
                    var psH = offH - AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    var asTop = 0;
                    var asH = Math.round(psH * this.dividerPosition);
                    var soH = Math.round(psH * (1 - this.dividerPosition));
                    var soTop = asH + AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    var wStr = offW.toString() + 'px';
                    var dTop = asH;
                    var dTopStr = dTop.toString() + 'px';
                    this.dc.style.top = dTopStr;
                    this.dc.style.left = '0px';
                    this.dc.style.width = wStr;
                    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    this.dc.width = offW;
                    this.dc.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE;
                    this.dc.style.width = wStr;
                    this.dc.style.height = AudioClipUIContainer.DIVIDER_PIXEL_SIZE.toString() + 'px';
                    this.drawDivider();
                    this.as.layoutBounds(0, 0, offW, asH, true);
                    this.so.layoutBounds(0, soTop, offW, soH, true);
                };
                AudioClipUIContainer.prototype.setData = function (audioData) {
                    //this.audioData = audioData;
                    this.as.setData(audioData);
                    this.so.setData(audioData);
                    this.layout();
                };
                Object.defineProperty(AudioClipUIContainer.prototype, "playFramePosition", {
                    get: function () {
                        return this._playFramePosition;
                    },
                    set: function (playFramePosition) {
                        this._playFramePosition = playFramePosition;
                        this.as.playFramePosition = playFramePosition;
                        this.so.playFramePosition = playFramePosition;
                    },
                    enumerable: true,
                    configurable: true
                });
                AudioClipUIContainer.DIVIDER_PIXEL_SIZE = 10;
                return AudioClipUIContainer;
            }());
            ui.AudioClipUIContainer = AudioClipUIContainer;
        })(ui = audio.ui || (audio.ui = {}));
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=container.js.map