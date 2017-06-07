/**
 * Complex math type.
 *
 * @author K.Jaensch, klausj@phonetik.uni-muenchen.de
 *
 */
var ips;
(function (ips) {
    var math;
    (function (math) {
        var Complex = (function () {
            function Complex(real, img) {
                this.real = real;
                this.img = img;
            }
            Complex.fromPolarForm = function (magnitude, argument) {
                var r = Math.cos(argument) * magnitude;
                var i = Math.sin(argument) * magnitude;
                return new Complex(r, i);
            };
            Complex.prototype.magnitude = function () {
                return Math.sqrt((this.real * this.real) + (this.img * this.img));
            };
            Complex.prototype.argument = function () {
                return Math.atan2(this.img, this.real);
            };
            Complex.prototype.add = function (addC) {
                return new Complex(this.real + addC.real, this.img + addC.img);
            };
            Complex.prototype.sub = function (subC) {
                return new Complex(this.real - subC.real, this.img - subC.img);
            };
            Complex.prototype.mult = function (multC) {
                var multR = (this.real * multC.real) - (this.img * multC.img);
                var multI = (this.real * multC.img) + (multC.real * this.img);
                return new Complex(multR, multI);
            };
            Complex.prototype.multReal = function (multF) {
                return new Complex(this.real * multF, this.img * multF);
            };
            Complex.prototype.div = function (divisor) {
                var divReal = divisor.real;
                var divImg = divisor.img;
                var div = (divReal * divReal) + (divImg * divImg);
                var divisionReal = ((this.real * divReal) + (this.img * divImg)) / div;
                var divisionImg = ((divReal * this.img) - (this.real * divImg)) / div;
                return new Complex(divisionReal, divisionImg);
            };
            Complex.prototype.divReal = function (divisor) {
                var div = divisor * divisor;
                var divsionReal = (this.real * divisor) / div;
                var divsionImg = (divisor * this.img) / div;
                return new Complex(divsionReal, divsionImg);
            };
            Complex.prototype.conjugate = function () {
                return new Complex(this.real, -this.img);
            };
            Complex.prototype.equals = function (c) {
                if (c == null)
                    return false;
                return (this.real == c.real && this.img == c.img);
            };
            Complex.prototype.toString = function () {
                return "Real: " + this.real + ", Img: " + this.img;
            };
            return Complex;
        }());
        math.Complex = Complex;
    })(math = ips.math || (ips.math = {}));
})(ips || (ips = {}));
//# sourceMappingURL=complex.js.map