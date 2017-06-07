/// <reference path="complex"/>
var ips;
(function (ips) {
    var math;
    (function (math) {
        var DFTFloat32 = (function () {
            function DFTFloat32(n) {
                this.n = n;
                this.m = Math.log(n) / Math.log(2);
                //if(n != (1 << m))throw new RuntimeException("length N must be power of 2");
                // lookup tables
                this.cosLookup = new Float32Array(n / 2);
                this.sinLookup = new Float32Array(n / 2);
                for (var i = 0; i < n / 2; i++) {
                    var arc = (-2 * Math.PI * i) / n;
                    this.cosLookup[i] = Math.cos(arc);
                    this.sinLookup[i] = Math.sin(arc);
                }
            }
            DFTFloat32.prototype.processReal = function (srcBuf) {
                var x = srcBuf.slice();
                var y = new Float32Array(srcBuf.length);
                for (var yi = 0; yi < y.length; yi++) {
                    y[yi] = 0.0;
                }
                this.fftCooleyTukey(x, y);
                var rc = new Array(x.length);
                for (var i = 0; i < x.length; i++) {
                    rc[i] = new math.Complex(x[i], y[i]);
                }
                return rc;
            };
            DFTFloat32.prototype.processRealMagnitude = function (srcBuf) {
                var x = srcBuf.slice();
                var y = new Float32Array(srcBuf.length);
                for (var yi = 0; yi < y.length; yi++) {
                    y[yi] = 0.0;
                }
                this.fftCooleyTukey(x, y);
                var rc = new Float32Array(x.length);
                for (var i = 0; i < x.length; i++) {
                    var rcc = new math.Complex(x[i], y[i]);
                    rc[i] = rcc.magnitude();
                }
                return rc;
            };
            DFTFloat32.prototype.fftCooleyTukey = function (real, img) {
                var i;
                var j = 0;
                var k;
                var n1;
                var n2 = this.n / 2;
                var a;
                var c;
                var s;
                var t1;
                var t2;
                for (i = 1; i < this.n - 1; i++) {
                    n1 = n2;
                    while (j >= n1) {
                        j = j - n1;
                        n1 = n1 / 2;
                    }
                    j = j + n1;
                    if (i < j) {
                        t1 = real[i];
                        real[i] = real[j];
                        real[j] = t1;
                        t1 = img[i];
                        img[i] = img[j];
                        img[j] = t1;
                    }
                }
                n1 = 0;
                n2 = 1;
                for (i = 0; i < this.m; i++) {
                    n1 = n2;
                    n2 = n2 + n2;
                    a = 0;
                    for (j = 0; j < n1; j++) {
                        c = this.cosLookup[a];
                        s = this.sinLookup[a];
                        a += 1 << (this.m - i - 1);
                        for (k = j; k < this.n; k = k + n2) {
                            t1 = c * real[k + n1] - s * img[k + n1];
                            t2 = s * real[k + n1] + c * img[k + n1];
                            real[k + n1] = real[k] - t1;
                            img[k + n1] = img[k] - t2;
                            real[k] = real[k] + t1;
                            img[k] = img[k] + t2;
                        }
                    }
                }
            };
            DFTFloat32.prototype.process = function (t) {
                var reals = new Float32Array(this.n);
                var imgs = new Float32Array(this.n);
                var trans = new Array(this.n);
                for (var i = 0; i < this.n; i++) {
                    reals[i] = t[i].real;
                    imgs[i] = t[i].img;
                }
                this.fftCooleyTukey(reals, imgs);
                for (var i = 0; i < this.n; i++) {
                    trans[i] = new math.Complex(reals[i], imgs[i]);
                }
                return trans;
            };
            return DFTFloat32;
        }());
        math.DFTFloat32 = DFTFloat32;
        var DFT = (function () {
            function DFT(n) {
                this.n = n;
                this.m = Math.log(n) / Math.log(2);
                //if(n != (1 << m))throw new RuntimeException("length N must be power of 2");
                // lookup tables
                this.cosLookup = new Array(n / 2);
                this.sinLookup = new Array(n / 2);
                for (var i = 0; i < n / 2; i++) {
                    var arc = (-2 * Math.PI * i) / n;
                    this.cosLookup[i] = Math.cos(arc);
                    this.sinLookup[i] = Math.sin(arc);
                }
            }
            DFT.prototype.processReal = function (srcBuf) {
                var x = srcBuf.slice();
                var y = new Array(srcBuf.length);
                for (var yi = 0; yi < y.length; yi++) {
                    y[yi] = 0.0;
                }
                this.fftCooleyTukey(x, y);
                var rc = new math.Complex[x.length];
                for (var i = 0; i < x.length; i++) {
                    rc[i] = new math.Complex(x[i], y[i]);
                }
                return rc;
            };
            DFT.prototype.fftCooleyTukey = function (real, img) {
                var i;
                var j = 0;
                var k;
                var n1;
                var n2 = this.n / 2;
                var a;
                var c;
                var s;
                var t1;
                var t2;
                for (i = 1; i < this.n - 1; i++) {
                    n1 = n2;
                    while (j >= n1) {
                        j = j - n1;
                        n1 = n1 / 2;
                    }
                    j = j + n1;
                    if (i < j) {
                        t1 = real[i];
                        real[i] = real[j];
                        real[j] = t1;
                        t1 = img[i];
                        img[i] = img[j];
                        img[j] = t1;
                    }
                }
                n1 = 0;
                n2 = 1;
                for (i = 0; i < this.m; i++) {
                    n1 = n2;
                    n2 = n2 + n2;
                    a = 0;
                    for (j = 0; j < n1; j++) {
                        c = this.cosLookup[a];
                        s = this.sinLookup[a];
                        a += 1 << (this.m - i - 1);
                        for (k = j; k < this.n; k = k + n2) {
                            t1 = c * real[k + n1] - s * img[k + n1];
                            t2 = s * real[k + n1] + c * img[k + n1];
                            real[k + n1] = real[k] - t1;
                            img[k + n1] = img[k] - t2;
                            real[k] = real[k] + t1;
                            img[k] = img[k] + t2;
                        }
                    }
                }
            };
            DFT.prototype.process = function (t) {
                var reals = new Array(this.n);
                var imgs = new Array(this.n);
                var trans = new Array(this.n);
                for (var i = 0; i < this.n; i++) {
                    reals[i] = t[i].real;
                    imgs[i] = t[i].img;
                }
                this.fftCooleyTukey(reals, imgs);
                for (var i = 0; i < this.n; i++) {
                    trans[i] = new math.Complex(reals[i], imgs[i]);
                }
                return trans;
            };
            return DFT;
        }());
        math.DFT = DFT;
    })(math = ips.math || (ips.math = {}));
})(ips || (ips = {}));
//# sourceMappingURL=dft.js.map