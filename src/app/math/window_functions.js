/**
 * Gaussian window implementation.
 * @author K.Jaensch, klausj@phonetik.uni-muenchen.de
 *
 */
var ips;
(function (ips) {
    var math;
    (function (math) {
        var GaussianWindow = (function () {
            function GaussianWindow(size, sigma) {
                if (sigma === void 0) { sigma = GaussianWindow.DEFAULT_SIGMA; }
                this.buf = new Float32Array(size);
                var center = (size - 1) / 2;
                for (var i = 0; i < size; i++) {
                    var quot = (i - center) / (sigma * center);
                    var exp = -0.5 * quot * quot;
                    var val = Math.exp(exp);
                    this.buf[i] = val;
                }
            }
            GaussianWindow.prototype.getScale = function (i) {
                return this.buf[i];
            };
            GaussianWindow.DEFAULT_SIGMA = 0.3;
            return GaussianWindow;
        }());
        math.GaussianWindow = GaussianWindow;
    })(math = ips.math || (ips.math = {}));
})(ips || (ips = {}));
//# sourceMappingURL=window_functions.js.map